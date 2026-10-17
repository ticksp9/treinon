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
    { n: 1, name: 'Proteção e dor', goal: 'Acalmar a lesão e recuperar o movimento.', criteria: ['Dor em repouso até 2/10', 'Marcha normal, sem coxear', 'Movimento quase completo'] },
    { n: 2, name: 'Força e mobilidade', goal: 'Recuperar força e controlo.', criteria: ['Exercícios de força sem dor', 'Força perto do outro lado (≈80%)', 'Equilíbrio num só apoio'] },
    { n: 3, name: 'Corrida', goal: 'Voltar a correr, em linha reta e depois mais depressa.', criteria: ['Corrida contínua sem dor', 'Acelerações e travagens sem dor', 'Sem reação no dia seguinte'] },
    { n: 4, name: 'Treino individual com bola', goal: 'Gestos do futebol, sem adversário.', criteria: ['Mudanças de direção sem dor', 'Passe e remate sem dor', 'Sem reação no dia seguinte'] },
    { n: 5, name: 'Treino com a equipa', goal: 'Parte do treino da equipa, primeiro sem contacto.', criteria: ['Exercícios com a equipa sem contacto', 'Sessões completas sem dor', 'Confiança do jogador'] },
    { n: 6, name: 'Treino completo e regresso ao jogo', goal: 'Treinar sem limites e voltar a jogar.', criteria: ['Treino completo com contacto', 'Sem dor nem reação', 'Alta dada pelo departamento médico'] },
  ],
  concussion: [
    { n: 1, name: 'Repouso relativo', goal: 'Atividades do dia a dia que não agravem os sintomas (24–48 h). Primeiro volta a escola.', criteria: ['Pelo menos 24 h nesta fase', 'Sintomas a melhorar', 'Regressou às aulas sem agravar'] },
    { n: 2, name: 'Exercício aeróbico leve', goal: 'Caminhar, bicicleta estática, sem esforço intenso.', criteria: ['Pelo menos 24 h nesta fase', 'Sem sintomas durante e depois'] },
    { n: 3, name: 'Exercício específico individual', goal: 'Corrida e exercícios com bola, sem cabeceamentos nem contacto.', criteria: ['Pelo menos 24 h nesta fase', 'Sem sintomas durante e depois'] },
    { n: 4, name: 'Treino sem contacto', goal: 'Exercícios da equipa mais exigentes, sem contacto.', criteria: ['Pelo menos 24 h nesta fase', 'Sem sintomas', 'Regressou totalmente às aulas'] },
    { n: 5, name: 'Treino com contacto', goal: 'Treino normal, depois de autorização médica.', criteria: ['Autorização médica', 'Sem sintomas durante e depois'] },
    { n: 6, name: 'Regresso ao jogo', goal: 'Pode voltar a jogar.', criteria: ['Treino com contacto sem sintomas', 'Alta dada pelo departamento médico'] },
  ],
};
export const PROTOCOL_LABEL: Record<RehabProtocol, string> = { standard: 'Regresso por fases', concussion: 'Protocolo de concussão' };

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
