// Catálogo central de atributos para a ficha de desenvolvimento do jogador.
// Mantido em código (type-safe) e armazenado por avaliação no campo `attributes` (JSONB).

export type AttributeCategory = 'technical' | 'tactical' | 'physical' | 'mental';

export interface AttributeDef {
  key: string;
  label: string;
}

export interface CategoryDef {
  key: AttributeCategory;
  label: string;
  color: string; // semantic accent class
  attributes: AttributeDef[];
}

export const ATTRIBUTE_CATALOG: CategoryDef[] = [
  {
    key: 'technical',
    label: 'Técnica',
    color: 'text-blue-500',
    attributes: [
      { key: 'short_pass', label: 'Passe curto' },
      { key: 'long_pass', label: 'Passe longo' },
      { key: 'reception', label: 'Receção' },
      { key: 'driving', label: 'Condução' },
      { key: 'dribble', label: 'Drible' },
      { key: 'shot', label: 'Remate' },
      { key: 'finishing', label: 'Finalização' },
      { key: 'cross', label: 'Cruzamento' },
      { key: '1v1_offensive', label: '1x1 ofensivo' },
      { key: '1v1_defensive', label: '1x1 defensivo' },
    ],
  },
  {
    key: 'tactical',
    label: 'Tática',
    color: 'text-purple-500',
    attributes: [
      { key: 'positioning_off', label: 'Posicionamento ofensivo' },
      { key: 'positioning_def', label: 'Posicionamento defensivo' },
      { key: 'game_reading', label: 'Leitura de jogo' },
      { key: 'decision_making', label: 'Tomada de decisão' },
      { key: 'transition_off', label: 'Transição ofensiva' },
      { key: 'transition_def', label: 'Transição defensiva' },
    ],
  },
  {
    key: 'physical',
    label: 'Física',
    color: 'text-orange-500',
    attributes: [
      { key: 'speed', label: 'Velocidade' },
      { key: 'acceleration', label: 'Aceleração' },
      { key: 'endurance', label: 'Resistência' },
      { key: 'agility', label: 'Agilidade' },
      { key: 'strength', label: 'Força' },
      { key: 'mobility', label: 'Mobilidade' },
    ],
  },
  {
    key: 'mental',
    label: 'Mental',
    color: 'text-emerald-500',
    attributes: [
      { key: 'attitude', label: 'Atitude' },
      { key: 'commitment', label: 'Compromisso' },
      { key: 'concentration', label: 'Concentração' },
      { key: 'leadership', label: 'Liderança' },
      { key: 'resilience', label: 'Resiliência' },
      { key: 'discipline', label: 'Disciplina' },
      { key: 'learning', label: 'Capacidade de aprendizagem' },
    ],
  },
];

export const EVALUATION_CONTEXTS: { value: string; label: string }[] = [
  { value: 'training', label: 'Treino' },
  { value: 'match', label: 'Jogo' },
  { value: 'period', label: 'Período' },
  { value: 'assessment', label: 'Avaliação formal' },
  { value: 'other', label: 'Outro' },
];

export const PLAYER_STATUS_OPTIONS: { value: string; label: string; tone: string }[] = [
  { value: 'active', label: 'Ativo', tone: 'bg-emerald-500/10 text-emerald-600' },
  { value: 'injured', label: 'Lesionado', tone: 'bg-red-500/10 text-red-600' },
  { value: 'suspended', label: 'Suspenso', tone: 'bg-amber-500/10 text-amber-600' },
  { value: 'loan', label: 'Emprestado', tone: 'bg-sky-500/10 text-sky-600' },
  { value: 'inactive', label: 'Inativo', tone: 'bg-muted text-muted-foreground' },
  { value: 'away', label: 'Afastado', tone: 'bg-zinc-500/10 text-zinc-600' },
];

// Score 1-10 per attribute, stored as { [category]: { [attr_key]: number } }
export type AttributeScores = Partial<
  Record<AttributeCategory, Record<string, number>>
>;

export function getCategory(key: AttributeCategory): CategoryDef | undefined {
  return ATTRIBUTE_CATALOG.find((c) => c.key === key);
}

export function emptyAttributeScores(): AttributeScores {
  const out: AttributeScores = {};
  for (const cat of ATTRIBUTE_CATALOG) {
    out[cat.key] = {};
    for (const a of cat.attributes) {
      out[cat.key]![a.key] = 5;
    }
  }
  return out;
}

/** Average of a single category (returns null if no scores). */
export function categoryAverage(
  scores: AttributeScores,
  category: AttributeCategory,
): number | null {
  const bag = scores[category];
  if (!bag) return null;
  const values = Object.values(bag).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Overall average across all categories present (1-10). */
export function overallAverage(scores: AttributeScores): number | null {
  const cats: number[] = [];
  for (const cat of ATTRIBUTE_CATALOG) {
    const v = categoryAverage(scores, cat.key);
    if (v != null) cats.push(v);
  }
  if (cats.length === 0) return null;
  return cats.reduce((a, b) => a + b, 0) / cats.length;
}

/** Round 1-10 to integer for compatibility with legacy *_rating columns. */
export function roundedOverall(scores: AttributeScores): number | null {
  const v = overallAverage(scores);
  return v == null ? null : Math.max(1, Math.min(10, Math.round(v)));
}

export function categoryRounded(
  scores: AttributeScores,
  category: AttributeCategory,
): number | null {
  const v = categoryAverage(scores, category);
  return v == null ? null : Math.max(1, Math.min(10, Math.round(v)));
}
