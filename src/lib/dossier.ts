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
  matchesEvaluated: number;         // with ratings, notes on our players or notes on the opponent
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
  return [
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
      key: 'objectives', title: tx('Objetivos do escalão'), hint: tx('O que a equipa deve desenvolver na época.'),
      state: c.hasObjectives ? 'done' : 'missing', detail: c.hasObjectives ? tx('Definidos') : tx('Por definir'), link: '/training?tab=planeamento',
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
      key: 'matches', title: tx('Convocatórias e avaliação dos jogos'), hint: tx('Não só estatísticas: notas dos jogadores e reflexão do jogo.'),
      state: ratio(c.matchesEvaluated, c.matchesPlayed),
      detail: tx('{{a}} de {{b}} jogos avaliados', { a: c.matchesEvaluated, b: c.matchesPlayed }), link: '/matches',
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
