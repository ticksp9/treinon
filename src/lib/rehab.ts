import { tx } from '@/lib/i18n/ui';
/**
 * Getting back to play, by phases passed on criteria (not on days):
 *  - standard: the usual path from pain control to the match (control → chaos);
 *  - concussion: the graded return of the Amsterdam 2022 consensus — at least 24 hours in each
 *    step, back one step if symptoms come back, and no match before the last one.
 */

export type RehabProtocol = 'standard' | 'concussion';
export interface RehabPhase { n: number; name: string; goal: string; criteria: string[] }

export const PHASES: Record<RehabProtocol, RehabPhase[]> = {
  standard: [
    { n: 1, get name() { return tx('Proteção e dor'); }, get goal() { return tx('Acalmar a lesão e recuperar o movimento.'); }, get criteria() { return ['Dor em repouso até 2/10', 'Marcha normal, sem coxear', 'Movimento quase completo'].map((s) => tx(s)); } },
    { n: 2, get name() { return tx('Força e mobilidade'); }, get goal() { return tx('Recuperar força e controlo.'); }, get criteria() { return ['Exercícios de força sem dor', 'Força perto do outro lado (≈80%)', 'Equilíbrio num só apoio'].map((s) => tx(s)); } },
    { n: 3, get name() { return tx('Corrida'); }, get goal() { return tx('Voltar a correr, em linha reta e depois mais depressa.'); }, get criteria() { return ['Corrida contínua sem dor', 'Acelerações e travagens sem dor', 'Sem reação no dia seguinte'].map((s) => tx(s)); } },
    { n: 4, get name() { return tx('Treino individual com bola'); }, get goal() { return tx('Gestos do futebol, sem adversário.'); }, get criteria() { return ['Mudanças de direção sem dor', 'Passe e remate sem dor', 'Sem reação no dia seguinte'].map((s) => tx(s)); } },
    { n: 5, get name() { return tx('Treino com a equipa'); }, get goal() { return tx('Parte do treino da equipa, primeiro sem contacto.'); }, get criteria() { return ['Exercícios com a equipa sem contacto', 'Sessões completas sem dor', 'Confiança do jogador'].map((s) => tx(s)); } },
    { n: 6, get name() { return tx('Treino completo e regresso ao jogo'); }, get goal() { return tx('Treinar sem limites e voltar a jogar.'); }, get criteria() { return ['Treino completo com contacto', 'Sem dor nem reação', 'Alta dada pelo departamento médico'].map((s) => tx(s)); } },
  ],
  concussion: [
    { n: 1, get name() { return tx('Repouso relativo'); }, get goal() { return tx('Atividades do dia a dia que não agravem os sintomas (24–48 h). Primeiro volta a escola.'); }, get criteria() { return ['Pelo menos 24 h nesta fase', 'Sintomas a melhorar', 'Regressou às aulas sem agravar'].map((s) => tx(s)); } },
    { n: 2, get name() { return tx('Exercício aeróbico leve'); }, get goal() { return tx('Caminhar, bicicleta estática, sem esforço intenso.'); }, get criteria() { return ['Pelo menos 24 h nesta fase', 'Sem sintomas durante e depois'].map((s) => tx(s)); } },
    { n: 3, get name() { return tx('Exercício específico individual'); }, get goal() { return tx('Corrida e exercícios com bola, sem cabeceamentos nem contacto.'); }, get criteria() { return ['Pelo menos 24 h nesta fase', 'Sem sintomas durante e depois'].map((s) => tx(s)); } },
    { n: 4, get name() { return tx('Treino sem contacto'); }, get goal() { return tx('Exercícios da equipa mais exigentes, sem contacto.'); }, get criteria() { return ['Pelo menos 24 h nesta fase', 'Sem sintomas', 'Regressou totalmente às aulas'].map((s) => tx(s)); } },
    { n: 5, get name() { return tx('Treino com contacto'); }, get goal() { return tx('Treino normal, depois de autorização médica.'); }, get criteria() { return ['Autorização médica', 'Sem sintomas durante e depois'].map((s) => tx(s)); } },
    { n: 6, get name() { return tx('Regresso ao jogo'); }, get goal() { return tx('Pode voltar a jogar.'); }, get criteria() { return ['Treino com contacto sem sintomas', 'Alta dada pelo departamento médico'].map((s) => tx(s)); } },
  ],
};
export const PROTOCOL_LABEL: Record<RehabProtocol, string> = { standard: 'Regresso por fases', get concussion() { return tx('Protocolo de concussão'); } };

export const phaseOf = (protocol: string | null | undefined, phase: number | null | undefined): RehabPhase | null => {
  const list = PHASES[(protocol as RehabProtocol) ?? 'standard'] ?? PHASES.standard;
  return phase ? list[phase - 1] ?? null : null;
};

export type Checks = Record<string, number[]>;
export const isChecked = (checks: Checks | null | undefined, phase: number, i: number) => !!checks?.[String(phase)]?.includes(i);
export function toggleCheck(checks: Checks | null | undefined, phase: number, i: number): Checks {
  const cur = new Set(checks?.[String(phase)] ?? []);
  if (cur.has(i)) cur.delete(i); else cur.add(i);
  return { ...(checks ?? {}), [String(phase)]: [...cur].sort((a, b) => a - b) };
}
export function phaseComplete(protocol: RehabProtocol, phase: number, checks: Checks | null | undefined): boolean {
  const p = PHASES[protocol][phase - 1];
  return !!p && p.criteria.every((_, i) => isChecked(checks, phase, i));
}

export interface HistoryEntry { phase: number; at: string; by?: string | null; back?: boolean }

/** The fields to save when the player moves to another phase. */
export function moveTo(current: { rehab_phase: number | null; rehab_history: HistoryEntry[] | null }, target: number, by: string | null, today = new Date()) {
  const at = today.toISOString().slice(0, 10);
  return {
    rehab_phase: target,
    rehab_phase_since: at,
    rehab_history: [...(current.rehab_history ?? []), { phase: target, at, by, ...(current.rehab_phase && target < current.rehab_phase ? { back: true } : {}) }],
  };
}

/** Concussion: each step needs at least 24 hours. */
export function hoursInPhase(since: string | null | undefined, now = new Date()): number | null {
  if (!since) return null;
  const [y, m, d] = since.split('-').map(Number);
  return (now.getTime() - new Date(y, m - 1, d).getTime()) / 3_600_000;
}

/** How many of the last 7 days each exercise was done. */
export function adherence(logs: { exercise_id: string; done_on: string }[], today = new Date(), days = 7): Map<string, number> {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)).toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);
  const out = new Map<string, number>();
  for (const l of logs) if (l.done_on >= from && l.done_on <= to) out.set(l.exercise_id, (out.get(l.exercise_id) ?? 0) + 1);
  return out;
}
