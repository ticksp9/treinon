import { tx } from '@/lib/i18n/ui';
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
    get label() { return tx('Técnica'); },
    color: 'text-blue-500',
    attributes: [
      { key: 'short_pass', get label() { return tx('Passe curto'); } },
      { key: 'long_pass', get label() { return tx('Passe longo'); } },
      { key: 'reception', get label() { return tx('Receção'); } },
      { key: 'driving', get label() { return tx('Condução'); } },
      { key: 'dribble', get label() { return tx('Drible'); } },
      { key: 'shot', get label() { return tx('Remate'); } },
      { key: 'finishing', get label() { return tx('Finalização'); } },
      { key: 'cross', get label() { return tx('Cruzamento'); } },
      { key: '1v1_offensive', get label() { return tx('1x1 ofensivo'); } },
      { key: '1v1_defensive', get label() { return tx('1x1 defensivo'); } },
    ],
  },
  {
    key: 'tactical',
    get label() { return tx('Tática'); },
    color: 'text-purple-500',
    attributes: [
      { key: 'positioning_off', get label() { return tx('Posicionamento ofensivo'); } },
      { key: 'positioning_def', get label() { return tx('Posicionamento defensivo'); } },
      { key: 'game_reading', get label() { return tx('Leitura de jogo'); } },
      { key: 'decision_making', get label() { return tx('Tomada de decisão'); } },
      { key: 'transition_off', get label() { return tx('Transição ofensiva'); } },
      { key: 'transition_def', get label() { return tx('Transição defensiva'); } },
    ],
  },
  {
    key: 'physical',
    get label() { return tx('Física'); },
    color: 'text-orange-500',
    attributes: [
      { key: 'speed', get label() { return tx('Velocidade'); } },
      { key: 'acceleration', get label() { return tx('Aceleração'); } },
      { key: 'endurance', get label() { return tx('Resistência'); } },
      { key: 'agility', get label() { return tx('Agilidade'); } },
      { key: 'strength', get label() { return tx('Força'); } },
      { key: 'mobility', get label() { return tx('Mobilidade'); } },
    ],
  },
  {
    key: 'mental',
    get label() { return tx('Mental'); },
    color: 'text-emerald-500',
    attributes: [
      { key: 'attitude', get label() { return tx('Atitude'); } },
      { key: 'commitment', get label() { return tx('Compromisso'); } },
      { key: 'concentration', get label() { return tx('Concentração'); } },
      { key: 'leadership', get label() { return tx('Liderança'); } },
      { key: 'resilience', get label() { return tx('Resiliência'); } },
      { key: 'discipline', get label() { return tx('Disciplina'); } },
      { key: 'learning', get label() { return tx('Capacidade de aprendizagem'); } },
    ],
  },
];

export const EVALUATION_CONTEXTS: { value: string; label: string }[] = [
  { value: 'training', get label() { return tx('Treino'); } },
  { value: 'match', get label() { return tx('Jogo'); } },
  { value: 'period', get label() { return tx('Período'); } },
  { value: 'assessment', get label() { return tx('Avaliação formal'); } },
  { value: 'other', get label() { return tx('Outro'); } },
];

export const PLAYER_STATUS_OPTIONS: { value: string; label: string; tone: string }[] = [
  { value: 'active', get label() { return tx('Ativo'); }, tone: 'bg-emerald-500/10 text-emerald-600' },
  { value: 'injured', get label() { return tx('Lesionado'); }, tone: 'bg-red-500/10 text-red-600' },
  { value: 'suspended', get label() { return tx('Suspenso'); }, tone: 'bg-amber-500/10 text-amber-600' },
  { value: 'loan', get label() { return tx('Emprestado'); }, tone: 'bg-sky-500/10 text-sky-600' },
  { value: 'inactive', get label() { return tx('Inativo'); }, tone: 'bg-muted text-muted-foreground' },
  { value: 'away', get label() { return tx('Afastado'); }, tone: 'bg-zinc-500/10 text-zinc-600' },
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
