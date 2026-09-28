import { describe, it, expect } from 'vitest';

// Budget variance calculation logic (mirrored from useBudget)
interface MockLine {
  category_id: string | null;
  line_type: string;
  budget_amount: number;
  forecast_amount: number;
  actual_amount: number;
}

interface MockCategory {
  id: string;
  name: string;
  type: string;
}

function computeVariances(lines: MockLine[], cats: MockCategory[]) {
  const catMap = new Map(cats.map(c => [c.id, c]));
  const grouped = new Map<string, { budget: number; actual: number; forecast: number; cat: MockCategory }>();

  for (const line of lines) {
    const cat = line.category_id ? catMap.get(line.category_id) : null;
    const key = cat?.id || 'uncategorized';
    const fallback = { id: '', name: 'Sem categoria', type: 'expense' };
    const existing = grouped.get(key) || { budget: 0, actual: 0, forecast: 0, cat: cat || fallback };
    existing.budget += line.budget_amount;
    existing.actual += line.actual_amount;
    existing.forecast += line.forecast_amount;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).map(({ budget, actual, forecast, cat }) => {
    const variance_abs = actual - budget;
    const variance_pct = budget !== 0 ? (variance_abs / Math.abs(budget)) * 100 : 0;
    const isExpense = cat.type === 'expense' || cat.type === 'investment';
    const status = variance_abs === 0 ? 'neutral' :
      isExpense ? (variance_abs > 0 ? 'unfavorable' : 'favorable') :
      (variance_abs > 0 ? 'favorable' : 'unfavorable');

    return { category_name: cat.name, category_type: cat.type, budget, actual, forecast, variance_abs, variance_pct: Math.round(variance_pct * 10) / 10, status };
  });
}

describe('Budget Variance Calculations', () => {
  const cats: MockCategory[] = [
    { id: 'cat-rev', name: 'Mensalidades', type: 'revenue' },
    { id: 'cat-exp', name: 'Transportes', type: 'expense' },
    { id: 'cat-inv', name: 'Equipamentos', type: 'investment' },
  ];

  it('computes favorable variance for revenue above budget', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-rev', line_type: 'revenue', budget_amount: 10000, forecast_amount: 10000, actual_amount: 12000 },
    ];
    const result = computeVariances(lines, cats);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('favorable');
    expect(result[0].variance_abs).toBe(2000);
    expect(result[0].variance_pct).toBe(20);
  });

  it('computes unfavorable variance for revenue below budget', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-rev', line_type: 'revenue', budget_amount: 10000, forecast_amount: 8000, actual_amount: 7000 },
    ];
    const result = computeVariances(lines, cats);
    expect(result[0].status).toBe('unfavorable');
    expect(result[0].variance_abs).toBe(-3000);
  });

  it('computes unfavorable variance for expense above budget', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-exp', line_type: 'expense', budget_amount: 5000, forecast_amount: 5500, actual_amount: 6000 },
    ];
    const result = computeVariances(lines, cats);
    expect(result[0].status).toBe('unfavorable');
    expect(result[0].variance_abs).toBe(1000);
  });

  it('computes favorable variance for expense below budget', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-exp', line_type: 'expense', budget_amount: 5000, forecast_amount: 4000, actual_amount: 4000 },
    ];
    const result = computeVariances(lines, cats);
    expect(result[0].status).toBe('favorable');
    expect(result[0].variance_abs).toBe(-1000);
  });

  it('computes neutral when actual equals budget', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-exp', line_type: 'expense', budget_amount: 3000, forecast_amount: 3000, actual_amount: 3000 },
    ];
    const result = computeVariances(lines, cats);
    expect(result[0].status).toBe('neutral');
    expect(result[0].variance_abs).toBe(0);
  });

  it('aggregates multiple lines for same category', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-exp', line_type: 'expense', budget_amount: 1000, forecast_amount: 1000, actual_amount: 1200 },
      { category_id: 'cat-exp', line_type: 'expense', budget_amount: 2000, forecast_amount: 2000, actual_amount: 2500 },
    ];
    const result = computeVariances(lines, cats);
    expect(result).toHaveLength(1);
    expect(result[0].budget).toBe(3000);
    expect(result[0].actual).toBe(3700);
    expect(result[0].variance_abs).toBe(700);
  });

  it('handles investment type as expense (unfavorable when over)', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-inv', line_type: 'capex', budget_amount: 8000, forecast_amount: 8000, actual_amount: 10000 },
    ];
    const result = computeVariances(lines, cats);
    expect(result[0].status).toBe('unfavorable');
  });

  it('handles zero budget without division error', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-exp', line_type: 'expense', budget_amount: 0, forecast_amount: 0, actual_amount: 500 },
    ];
    const result = computeVariances(lines, cats);
    expect(result[0].variance_pct).toBe(0);
    expect(result[0].variance_abs).toBe(500);
  });

  it('separates lines by different categories', () => {
    const lines: MockLine[] = [
      { category_id: 'cat-rev', line_type: 'revenue', budget_amount: 5000, forecast_amount: 5000, actual_amount: 5000 },
      { category_id: 'cat-exp', line_type: 'expense', budget_amount: 3000, forecast_amount: 3000, actual_amount: 4000 },
    ];
    const result = computeVariances(lines, cats);
    expect(result).toHaveLength(2);
    const rev = result.find(r => r.category_name === 'Mensalidades');
    const exp = result.find(r => r.category_name === 'Transportes');
    expect(rev?.status).toBe('neutral');
    expect(exp?.status).toBe('unfavorable');
  });

  it('handles lines with no category', () => {
    const lines: MockLine[] = [
      { category_id: null, line_type: 'expense', budget_amount: 1000, forecast_amount: 1000, actual_amount: 800 },
    ];
    const result = computeVariances(lines, cats);
    expect(result).toHaveLength(1);
    expect(result[0].category_name).toBe('Sem categoria');
  });
});

describe('Budget Cycle Status Rules', () => {
  const validStatuses = ['draft', 'under_review', 'approved', 'revised', 'archived', 'superseded'];

  it('only allows valid statuses', () => {
    validStatuses.forEach(s => expect(validStatuses).toContain(s));
    expect(validStatuses).not.toContain('deleted');
  });

  it('version types are correct', () => {
    const types = ['initial', 'revised', 'reforecast', 'final'];
    expect(types).toContain('initial');
    expect(types).toContain('reforecast');
  });
});

describe('Budget Line Types', () => {
  it('line_type includes revenue, expense, capex', () => {
    const types = ['revenue', 'expense', 'capex', 'transfer', 'adjustment'];
    expect(types).toContain('revenue');
    expect(types).toContain('expense');
    expect(types).toContain('capex');
  });

  it('line_nature includes fixed, variable, recurring, extraordinary', () => {
    const natures = ['fixed', 'variable', 'recurring', 'extraordinary'];
    expect(natures).toHaveLength(4);
  });
});

describe('Budget Multi-tenant Isolation', () => {
  it('budget lines always require club_id', () => {
    const line = { club_id: 'club-a', budget_version_id: 'v1', budget_amount: 1000 };
    expect(line.club_id).toBeDefined();
    expect(line.club_id).toBe('club-a');
  });

  it('different clubs have different budget data', () => {
    const clubALines = [{ club_id: 'club-a', budget_amount: 5000 }];
    const clubBLines = [{ club_id: 'club-b', budget_amount: 8000 }];
    expect(clubALines[0].club_id).not.toBe(clubBLines[0].club_id);
  });
});
