/**
 * The team's training dossier (FPF certification, criterion 4.2): what it must contain and how far
 * each part is filled. The same structure for every team ("padronizado, com estrutura comum").
 */
import { tx } from '@/lib/i18n/ui';

export type DossierState = 'done' | 'partial' | 'missing' | 'info';

export interface DossierCounts {
  players: number;
  playersWithBehaviour: number;     // evaluated on behaviour this season
  playersWithPerformance: number;   // evaluated on technique/tactics/physical/mental this season
  hasObjectives: boolean;
  periods: number;
  mesocycles: number;
  weeksSoFar: number;               // weeks of the season up to this one
  weeksPlanned: number;             // …with the week's objective
  weeksOver: number;                // weeks already finished
  weeksReviewed: number;            // …with the weekly review
  sessionsDone: number;             // sessions that already happened (not cancelled)
  sessionsRecorded: number;         // …recorded (closed or with contents)
  matchesPlayed: number;
  matchesEvaluated: number;         // with ratings, notes on our players, notes on the opponent or a written review
  // phase 2 (all optional, so older callers keep working)
  teamObjectives?: number;          // objectives of the team with a target…
  teamObjectivesMeasurable?: number;// …with indicator and target
  teamObjectivesEvaluated?: number; // …already with a verdict
  playersWithObjectives?: number;   // players with at least one individual objective
  guidelinesModel?: boolean;        // the club's game model for this team's format is written
  guidelinesStages?: number;        // stages of the guiding document with their objectives
  slots?: number;                   // weekly training slots of the team (club map)
  slotsWithSpace?: number;          // …with the space used
  needsFullPitch?: boolean;         // Sub-15 to Sub-19 without a full-pitch session
  hasMaterials?: boolean;
  matchesReviewed?: number;         // matches with the coach's written review
}

export interface DossierSection {
  key: string;
  title: string;
  /** what the FPF asks, in one line */
  hint: string;
  state: DossierState;
  detail: string;
  /** where in the app it is filled */
  link: string;
}

const ratio = (a: number, b: number): DossierState => (b === 0 ? 'info' : a >= b ? 'done' : a === 0 ? 'missing' : 'partial');

export function dossierSections(c: DossierCounts): DossierSection[] {
  const tObj = c.teamObjectives ?? 0, tMeasurable = c.teamObjectivesMeasurable ?? 0, tEval = c.teamObjectivesEvaluated ?? 0;
  const slots = c.slots ?? 0, withSpace = c.slotsWithSpace ?? 0;
  const objectivesState: DossierState = c.hasObjectives && tMeasurable > 0 ? 'done' : c.hasObjectives || tObj > 0 ? 'partial' : 'missing';
  return [
    {
      key: 'guidelines', title: tx('Documento orientador do clube'), hint: tx('Modelo de jogo do formato da equipa e objetivos de cada etapa.'),
      state: c.guidelinesModel && (c.guidelinesStages ?? 0) > 0 ? 'done' : c.guidelinesModel || (c.guidelinesStages ?? 0) > 0 ? 'partial' : 'missing',
      detail: [c.guidelinesModel ? tx('Modelo de jogo escrito') : tx('Modelo de jogo por escrever'), tx('{{n}} etapas com objetivos', { n: c.guidelinesStages ?? 0 })].join(' · '),
      link: '/documento-orientador',
    },
    {
      key: 'squad', title: tx('Plantel'), hint: tx('Lista de jogadores da equipa.'),
      state: c.players > 0 ? 'done' : 'missing', detail: c.players === 1 ? tx('1 jogador') : tx('{{n}} jogadores', { n: c.players }), link: '/players',
    },
    {
      key: 'behaviour', title: tx('Fichas individuais: avaliação comportamental'), hint: tx('Obrigatória para todos os escalões (3 estrelas).'),
      state: c.players === 0 ? 'missing' : ratio(c.playersWithBehaviour, c.players),
      detail: tx('{{a}} de {{b}} jogadores avaliados nesta época', { a: c.playersWithBehaviour, b: c.players }), link: '/players',
    },
    {
      key: 'performance', title: tx('Fichas individuais: avaliação de desempenho'), hint: tx('Técnica, tática, física e mental: a partir da fase de especialização.'),
      state: c.players === 0 ? 'info' : c.playersWithPerformance >= c.players ? 'done' : 'info',
      detail: tx('{{a}} de {{b}} jogadores avaliados nesta época', { a: c.playersWithPerformance, b: c.players }), link: '/players',
    },
    {
      key: 'objectives', title: tx('Objetivos do escalão'), hint: tx('O que a equipa deve desenvolver, com indicador, meta e prazo, e o seu controlo.'),
      state: objectivesState,
      detail: [c.hasObjectives ? tx('Texto definido') : tx('Texto por definir'), tx('{{n}} objetivos com meta', { n: tMeasurable }), tObj ? tx('{{a}} de {{b}} avaliados', { a: tEval, b: tObj }) : ''].filter(Boolean).join(' · '),
      link: '/training?tab=planeamento',
    },
    {
      key: 'individual', title: tx('Objetivos individuais'), hint: tx('Um objetivo com meta para cada jogador (obrigatório nas 4 e 5 estrelas).'),
      state: c.players === 0 || !(c.playersWithObjectives ?? 0) ? 'info' : ratio(c.playersWithObjectives ?? 0, c.players),
      detail: tx('{{a}} de {{b}} jogadores com objetivos', { a: c.playersWithObjectives ?? 0, b: c.players }), link: '/players',
    },
    {
      key: 'annual', title: tx('Planeamento anual'), hint: tx('Períodos da época com prioridade e controlo.'),
      state: c.periods > 0 ? 'done' : 'missing', detail: c.periods === 1 ? tx('1 período') : tx('{{n}} períodos', { n: c.periods }), link: '/training?tab=planeamento',
    },
    {
      key: 'meso', title: tx('Mesociclos'), hint: tx('Blocos de semanas com uma prioridade.'),
      state: c.mesocycles > 0 ? 'done' : 'missing', detail: c.mesocycles === 1 ? tx('1 mesociclo') : tx('{{n}} mesociclos', { n: c.mesocycles }), link: '/training?tab=planeamento',
    },
    {
      key: 'micro', title: tx('Microciclos (semanas)'), hint: tx('Objetivo, conteúdos e intensidade de cada semana; balanço no fim.'),
      state: c.weeksSoFar === 0 ? 'info' : ratio(c.weeksPlanned, c.weeksSoFar) === 'done' && c.weeksReviewed < c.weeksOver ? 'partial' : ratio(c.weeksPlanned, c.weeksSoFar),
      detail: tx('{{a}} de {{b}} semanas planeadas · {{c}} de {{d}} com balanço', { a: c.weeksPlanned, b: c.weeksSoFar, c: c.weeksReviewed, d: c.weeksOver }),
      link: '/training?tab=planeamento',
    },
    {
      key: 'sessions', title: tx('Registo das unidades de treino'), hint: tx('O que se fez em cada treino, como correu, presenças.'),
      state: ratio(c.sessionsRecorded, c.sessionsDone),
      detail: tx('{{a}} de {{b}} treinos registados', { a: c.sessionsRecorded, b: c.sessionsDone }), link: '/training?tab=attendance',
    },
    {
      key: 'space', title: tx('Mapa de ocupação do espaço'), hint: tx('Horário semanal com o espaço de cada treino (Sub-15 a Sub-19: um treino em campo inteiro).'),
      state: slots === 0 ? 'missing' : withSpace < slots || c.needsFullPitch ? 'partial' : 'done',
      detail: slots === 0 ? tx('Sem horário no mapa do clube') : [tx('{{a}} de {{b}} treinos com o espaço indicado', { a: withSpace, b: slots }), c.needsFullPitch ? tx('falta um treino em campo inteiro') : ''].filter(Boolean).join(' · '),
      link: '/mapa',
    },
    {
      key: 'materials', title: tx('Material e equipamento'), hint: tx('O material da equipa, adequado ao escalão.'),
      state: c.hasMaterials ? 'done' : 'missing', detail: c.hasMaterials ? tx('Registado') : tx('Por registar'), link: '/training?tab=planeamento',
    },
    {
      key: 'matches', title: tx('Convocatórias e avaliação dos jogos'), hint: tx('Não só estatísticas: notas dos jogadores e reflexão do jogo.'),
      state: ratio(c.matchesEvaluated, c.matchesPlayed),
      detail: [tx('{{a}} de {{b}} jogos avaliados', { a: c.matchesEvaluated, b: c.matchesPlayed }), c.matchesPlayed ? tx('{{n}} com balanço escrito', { n: c.matchesReviewed ?? 0 }) : ''].filter(Boolean).join(' · '), link: '/matches',
    },
  ];
}

/** 0–100: how complete the dossier is (the "info" parts do not count). */
export function dossierScore(sections: DossierSection[]): number {
  const counted = sections.filter((s) => s.state !== 'info');
  if (counted.length === 0) return 0;
  const pts = counted.reduce((a, s) => a + (s.state === 'done' ? 1 : s.state === 'partial' ? 0.5 : 0), 0);
  return Math.round((pts / counted.length) * 100);
}
