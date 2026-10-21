// TreinON drill & session library — free coaching content for teams without staff.
import { tx } from '@/lib/i18n/ui';

export type AgeBand = 'sub7' | 'sub9' | 'sub11' | 'sub13' | 'sub15' | 'sub17' | 'sub19' | 'senior';

export const AGE_BANDS: { value: AgeBand; label: string; short: string }[] = [
  { value: 'sub7', get label() { return tx('Petizes (Sub-7)'); }, get short() { return tx('Sub-7'); } },
  { value: 'sub9', get label() { return tx('Traquinas (Sub-8/9)'); }, get short() { return tx('Sub-9'); } },
  { value: 'sub11', get label() { return tx('Benjamins (Sub-10/11)'); }, get short() { return tx('Sub-11'); } },
  { value: 'sub13', get label() { return tx('Infantis (Sub-12/13)'); }, get short() { return tx('Sub-13'); } },
  { value: 'sub15', get label() { return tx('Iniciados (Sub-14/15)'); }, get short() { return tx('Sub-15'); } },
  { value: 'sub17', get label() { return tx('Juvenis (Sub-16/17)'); }, get short() { return tx('Sub-17'); } },
  { value: 'sub19', get label() { return tx('Juniores (Sub-18/19)'); }, get short() { return tx('Sub-19'); } },
  { value: 'senior', get label() { return tx('Seniores'); }, get short() { return tx('Seniores'); } },
];

export type DrillCategory =
  | 'aquecimento'
  | 'tecnica'
  | 'passe'
  | 'finalizacao'
  | 'posse'
  | 'defesa'
  | 'transicao'
  | 'jogo'
  | 'guarda_redes'
  | 'fisico'
  | 'bolas_paradas';

export const DRILL_CATEGORIES: { value: DrillCategory; label: string }[] = [
  { value: 'aquecimento', get label() { return tx('Aquecimento'); } },
  { value: 'tecnica', get label() { return tx('Técnica individual'); } },
  { value: 'passe', get label() { return tx('Passe e receção'); } },
  { value: 'finalizacao', get label() { return tx('Finalização'); } },
  { value: 'posse', get label() { return tx('Posse de bola'); } },
  { value: 'defesa', get label() { return tx('Defesa'); } },
  { value: 'transicao', get label() { return tx('Transições'); } },
  { value: 'jogo', get label() { return tx('Jogo reduzido'); } },
  { value: 'guarda_redes', get label() { return tx('Guarda-redes'); } },
  { value: 'fisico', get label() { return tx('Coordenação e físico'); } },
  { value: 'bolas_paradas', get label() { return tx('Bolas paradas'); } },
];

export type Equipment = 'bolas' | 'cones' | 'coletes' | 'balizas_pequenas' | 'balizas' | 'escada' | 'arcos' | 'estacas';

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  get bolas() { return tx('Bolas'); },
  get cones() { return tx('Cones/sinalizadores'); },
  get coletes() { return tx('Coletes'); },
  get balizas_pequenas() { return tx('Balizas pequenas (ou 2 cones)'); },
  get balizas() { return tx('Balizas'); },
  get escada() { return tx('Escada de coordenação'); },
  get arcos() { return tx('Arcos'); },
  get estacas() { return tx('Estacas'); },
};

/** Basic kit every team has: a low-resource drill needs nothing else. */
export const BASIC_EQUIPMENT: Equipment[] = ['bolas', 'cones', 'coletes'];

// ─── Diagram (coordinates in a 100 × 64 box) ───────────────────────────────
export type Pt = [number, number];
export type DiagramEl =
  | { t: 'a'; at: Pt; n?: string }          // attacker / team A
  | { t: 'd'; at: Pt; n?: string }          // defender / team B
  | { t: 'n'; at: Pt; n?: string }          // neutral / joker
  | { t: 'gk'; at: Pt }
  | { t: 'cone'; at: Pt }
  | { t: 'ball'; at: Pt }
  | { t: 'goal'; at: Pt; side: 'left' | 'right' | 'top' | 'bottom'; small?: boolean }
  | { t: 'pass'; from: Pt; to: Pt }         // solid arrow
  | { t: 'run'; from: Pt; to: Pt }          // dashed arrow (movement without ball)
  | { t: 'drive'; from: Pt; to: Pt }        // dotted arrow (with ball)
  | { t: 'shot'; from: Pt; to: Pt }         // thick arrow
  | { t: 'zone'; at: Pt; w: number; h: number; label?: string }
  | { t: 'line'; from: Pt; to: Pt }         // pitch line (halfway, etc.)
  | { t: 'text'; at: Pt; text: string };

export interface Drill {
  id: string;
  name: string;
  category: DrillCategory;
  ages: AgeBand[];
  players: { min: number; max: number };
  minutes: number;
  space: string;
  equipment: Equipment[];
  intensity: 'baixa' | 'media' | 'alta';
  objective: string;
  setup: string;
  howTo: string[];
  coachingPoints: string[];
  progressions?: string[];
  diagram: DiagramEl[];
}

export interface SessionPlan {
  id: string;
  name: string;
  ages: AgeBand[];
  theme: string;
  minutes: number;
  summary: string;
  /** Drill ids in order, with the time given to each block. */
  blocks: { drillId: string; minutes: number; note?: string }[];
}

export interface AgeGuide {
  age: AgeBand;
  format: string;
  priorities: string[];
  avoid: string[];
  sessionShape: string;
}

export const isLowResource = (d: Pick<Drill, 'equipment'>) =>
  d.equipment.every((e) => BASIC_EQUIPMENT.includes(e) || e === 'balizas_pequenas');
