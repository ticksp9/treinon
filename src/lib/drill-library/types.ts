// TreinON drill & session library — free coaching content for teams without staff.

export type AgeBand = 'sub7' | 'sub9' | 'sub11' | 'sub13' | 'sub15' | 'sub17' | 'sub19' | 'senior';

export const AGE_BANDS: { value: AgeBand; label: string; short: string }[] = [
  { value: 'sub7', label: 'Petizes (Sub-7)', short: 'Sub-7' },
  { value: 'sub9', label: 'Traquinas (Sub-8/9)', short: 'Sub-9' },
  { value: 'sub11', label: 'Benjamins (Sub-10/11)', short: 'Sub-11' },
  { value: 'sub13', label: 'Infantis (Sub-12/13)', short: 'Sub-13' },
  { value: 'sub15', label: 'Iniciados (Sub-14/15)', short: 'Sub-15' },
  { value: 'sub17', label: 'Juvenis (Sub-16/17)', short: 'Sub-17' },
  { value: 'sub19', label: 'Juniores (Sub-18/19)', short: 'Sub-19' },
  { value: 'senior', label: 'Seniores', short: 'Seniores' },
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
  { value: 'aquecimento', label: 'Aquecimento' },
  { value: 'tecnica', label: 'Técnica individual' },
  { value: 'passe', label: 'Passe e receção' },
  { value: 'finalizacao', label: 'Finalização' },
  { value: 'posse', label: 'Posse de bola' },
  { value: 'defesa', label: 'Defesa' },
  { value: 'transicao', label: 'Transições' },
  { value: 'jogo', label: 'Jogo reduzido' },
  { value: 'guarda_redes', label: 'Guarda-redes' },
  { value: 'fisico', label: 'Coordenação e físico' },
  { value: 'bolas_paradas', label: 'Bolas paradas' },
];

export type Equipment = 'bolas' | 'cones' | 'coletes' | 'balizas_pequenas' | 'balizas' | 'escada' | 'arcos' | 'estacas';

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bolas: 'Bolas',
  cones: 'Cones/sinalizadores',
  coletes: 'Coletes',
  balizas_pequenas: 'Balizas pequenas (ou 2 cones)',
  balizas: 'Balizas',
  escada: 'Escada de coordenação',
  arcos: 'Arcos',
  estacas: 'Estacas',
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
