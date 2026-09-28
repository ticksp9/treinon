import { describe, it, expect } from 'vitest';
import { computeStockHealth, computeConsumptionByTeam, computeMaintenanceStatus } from '@/hooks/useInventory';

describe('computeStockHealth', () => {
  it('classifies items correctly', () => {
    const items = [
      { current_stock: 0, minimum_stock: 5, reorder_point: 3 },
      { current_stock: 2, minimum_stock: 5, reorder_point: 3 },
      { current_stock: 50, minimum_stock: 5, reorder_point: 3 },
    ];
    const h = computeStockHealth(items);
    expect(h.critical).toBe(1);
    expect(h.low).toBe(1);
    expect(h.ok).toBe(1);
    expect(h.total).toBe(3);
  });

  it('handles empty array', () => {
    const h = computeStockHealth([]);
    expect(h.total).toBe(0);
  });
});

describe('computeConsumptionByTeam', () => {
  it('aggregates consumption by team', () => {
    const movements = [
      { movement_type: 'issue_to_team', related_team_id: 't1', total_cost: 100, quantity: 5 },
      { movement_type: 'consumption', related_team_id: 't1', total_cost: 50, quantity: 2 },
      { movement_type: 'issue_to_team', related_team_id: 't2', total_cost: 200, quantity: 10 },
      { movement_type: 'inbound', related_team_id: 't1', total_cost: 300, quantity: 20 },
    ];
    const teams = [{ id: 't1', name: 'Sub-13' }, { id: 't2', name: 'Sub-15' }];
    const result = computeConsumptionByTeam(movements, teams);
    expect(result.length).toBe(2);
    expect(result[0].team_id).toBe('t2');
    expect(result[0].total_cost).toBe(200);
    expect(result[1].total_cost).toBe(150);
  });

  it('ignores movements without team', () => {
    const movements = [{ movement_type: 'issue_to_team', related_team_id: null, total_cost: 100, quantity: 5 }];
    expect(computeConsumptionByTeam(movements, []).length).toBe(0);
  });
});

describe('computeMaintenanceStatus', () => {
  it('counts statuses', () => {
    const logs = [
      { status: 'completed', scheduled_date: '2025-01-01' },
      { status: 'scheduled', scheduled_date: '2020-01-01' },
      { status: 'overdue', scheduled_date: '2025-06-01' },
    ];
    const r = computeMaintenanceStatus(logs);
    expect(r.completed).toBe(1);
    expect(r.overdue).toBe(2);
  });
});

describe('multi-tenant isolation', () => {
  it('stock health is computed per-club data only', () => {
    const clubA = [{ current_stock: 0, minimum_stock: 5, reorder_point: 3 }];
    const clubB = [{ current_stock: 100, minimum_stock: 5, reorder_point: 3 }];
    expect(computeStockHealth(clubA).critical).toBe(1);
    expect(computeStockHealth(clubB).critical).toBe(0);
  });
});
