/**
 * The club's guiding document (FPF certification, criterion 4.1): the game model for each format
 * (7, 9 and 11, and futsal) and, for each stage of development, the objectives of teaching the game,
 * the motor and psychological development, the competencies by position and the coach's profile.
 * One per club (a coach without a club keeps their own).
 */
import { tx } from '@/lib/i18n/ui';

export type GameFormat = '7' | '9' | '11' | 'futsal';
export const GAME_FORMATS: { value: GameFormat; readonly label: string }[] = [
  { value: '7', get label() { return tx('Futebol de 7'); } },
  { value: '9', get label() { return tx('Futebol de 9'); } },
  { value: '11', get label() { return tx('Futebol de 11'); } },
  { value: 'futsal', get label() { return tx('Futsal'); } },
];

export interface GameModel { system?: string; attack?: string; defence?: string; toAttack?: string; toDefend?: string; setPieces?: string }
export const MODEL_FIELDS: { key: keyof GameModel; readonly label: string; readonly hint: string }[] = [
  { key: 'system', get label() { return tx('Sistema tático'); }, get hint() { return tx('Ex.: 1-3-3-2'); } },
  { key: 'attack', get label() { return tx('Organização ofensiva'); }, get hint() { return tx('Ex.: sair a jogar curto desde o guarda-redes; dar largura e profundidade.'); } },
  { key: 'toDefend', get label() { return tx('Transição defensiva'); }, get hint() { return tx('Ex.: reagir logo à perda; o mais próximo pressiona a bola.'); } },
  { key: 'defence', get label() { return tx('Organização defensiva'); }, get hint() { return tx('Ex.: bloco médio, equipa curta, fechar o corredor central.'); } },
  { key: 'toAttack', get label() { return tx('Transição ofensiva'); }, get hint() { return tx('Ex.: primeiro passe para a frente; atacar o espaço com velocidade.'); } },
  { key: 'setPieces', get label() { return tx('Esquemas táticos (bolas paradas)'); }, get hint() { return tx('Ex.: cantos, livres e lançamentos: rotinas simples.'); } },
];

export interface Stage { name: string; ages: string; game: string; motor: string; psych: string; positions: string; coach: string }
export const STAGE_FIELDS: { key: Exclude<keyof Stage, 'name' | 'ages'>; readonly label: string }[] = [
  { key: 'game', get label() { return tx('Objetivos do ensino do jogo'); } },
  { key: 'positions', get label() { return tx('Competências por posição'); } },
  { key: 'motor', get label() { return tx('Capacidades motoras'); } },
  { key: 'psych', get label() { return tx('Desenvolvimento psicológico e social'); } },
  { key: 'coach', get label() { return tx('Perfil do treinador'); } },
];

export interface Guidelines {
  vision?: string;
  models?: Partial<Record<GameFormat, GameModel>>;
  stages?: Stage[];
  /** how the club models the game: the training action with all the coaches, meetings… */
  process?: string;
}

const emptyStage = (name: string, ages: string, game = ''): Stage => ({ name, ages, game, motor: '', psych: '', positions: '', coach: '' });
export const newStage = () => emptyStage('', '');

/** A start for the stages of development (the club changes everything). */
export function defaultStages(): Stage[] {
  return [
    emptyStage(tx('Petizes e Traquinas'), tx('Sub-7 a Sub-9 · futebol de 5'), tx('Gostar do jogo; relação com a bola (condução, drible, remate); jogar para a frente, para a baliza.')),
    emptyStage(tx('Benjamins'), tx('Sub-10 e Sub-11 · futebol de 7'), tx('Passe e receção; ocupar o espaço (largura e profundidade); perceber quando a equipa tem e não tem a bola.')),
    emptyStage(tx('Infantis'), tx('Sub-12 e Sub-13 · futebol de 9'), tx('Princípios de jogo ofensivos e defensivos; cooperação em pequenos grupos; primeiras noções de posição.')),
    emptyStage(tx('Iniciados'), tx('Sub-14 e Sub-15 · futebol de 11'), tx('O modelo de jogo do clube no futebol de 11; relações setoriais; transições.')),
    emptyStage(tx('Juvenis e Juniores'), tx('Sub-16 a Sub-19 · futebol de 11'), tx('Especialização por posição; jogar em vários sistemas; preparar a passagem aos seniores.')),
  ];
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Only the known fields, trimmed to their size (what goes to the database). */
export function cleanGuidelines(g: Guidelines): Guidelines {
  const models: Partial<Record<GameFormat, GameModel>> = {};
  for (const f of GAME_FORMATS) {
    const m = g.models?.[f.value];
    if (!m) continue;
    const out: GameModel = {};
    for (const k of MODEL_FIELDS) { const v = str(m[k.key], 4000).trim(); if (v) out[k.key] = v; }
    if (Object.keys(out).length) models[f.value] = out;
  }
  const stages = (g.stages ?? []).slice(0, 12)
    .map((s) => ({ name: str(s.name, 120).trim(), ages: str(s.ages, 120).trim(), game: str(s.game, 4000).trim(), motor: str(s.motor, 4000).trim(), psych: str(s.psych, 4000).trim(), positions: str(s.positions, 4000).trim(), coach: str(s.coach, 4000).trim() }))
    .filter((s) => Object.values(s).some(Boolean));
  return { vision: str(g.vision, 6000).trim(), models, stages, process: str(g.process, 4000).trim() };
}

/** How much of it is written: the FPF asks the model for 7, 9 and 11 and the objectives of each stage. */
export function guidelinesProgress(g: Guidelines | null | undefined) {
  const formats = (['7', '9', '11'] as GameFormat[]).filter((f) => {
    const m = g?.models?.[f];
    return !!m && MODEL_FIELDS.filter((k) => k.key !== 'setPieces').every((k) => !!m[k.key]?.trim());
  }).length;
  const stages = (g?.stages ?? []).filter((s) => s.game?.trim()).length;
  return { formats, stages, hasVision: !!g?.vision?.trim(), total: g?.stages?.length ?? 0 };
}

/** Age of a team from its category ("Sub-13", "Infantis", "Seniores"…); null when unknown. */
export function ageOfCategory(category: string | null | undefined): number | null {
  const c = (category ?? '').toLowerCase();
  const m = c.match(/sub\s*-?\s*(\d{1,2})/);
  if (m) return Number(m[1]);
  const names: [string, number][] = [['petiz', 7], ['traquin', 9], ['benjamin', 11], ['infant', 13], ['iniciad', 15], ['juven', 17], ['junior', 19], ['júnior', 19], ['senior', 99], ['sénior', 99], ['veteran', 99]];
  return names.find(([k]) => c.includes(k))?.[1] ?? null;
}

/** The game format of a team: from its sport type, else from its age. */
export function formatOfTeam(team: { category?: string | null; sport_type?: string | null }): GameFormat | null {
  const s = team.sport_type ?? '';
  if (s === 'futsal') return 'futsal';
  if (s === 'football_7' || s === 'football_5') return '7';
  if (s === 'football_9') return '9';
  if (s === 'football_11') return '11';
  const age = ageOfCategory(team.category);
  if (age == null) return null;
  return age <= 11 ? '7' : age <= 13 ? '9' : '11';
}

/** Materials a team of this age usually needs (a start the coach changes). */
export function materialSuggestion(team: { category?: string | null; sport_type?: string | null }): string {
  const age = ageOfCategory(team.category);
  const common = tx('sinalizadores (30), cones (12), coletes de 2 cores (20), mini-balizas (4), escada de coordenação, arcos, estacas, bomba de ar, caixa de primeiros socorros');
  if (team.sport_type === 'futsal') return `${tx('Bolas de futsal (1 por jogador)')}; ${common}`;
  if (age != null && age <= 9) return `${tx('Bolas n.º 3 (1 por jogador); balizas de futebol de 5 (3×2 m)')}; ${common}`;
  if (age != null && age <= 13) return `${tx('Bolas n.º 4 (1 por jogador); balizas de futebol de 7/9 (6×2 m)')}; ${common}`;
  return `${tx('Bolas n.º 5 (1 por jogador); balizas de futebol de 11 (7,32×2,44 m) e balizas móveis')}; ${common}`;
}
