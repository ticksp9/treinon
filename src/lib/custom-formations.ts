/**
 * The coach's own formations (e.g. 4-1-2-1 in football 9). Only the code is stored: the
 * layout is built from it (see buildFormationFromCode), so a match or a board that uses a
 * custom formation opens on any device even before this list is loaded.
 */
import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildFormationFromCode, formationCodeProblem, isBuiltInFormation, normalizeFormationCode, parseFormationCode, setCustomFormations } from './tactical-formations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

let codes: Record<string, string[]> = {};
let version = 0;
const listeners = new Set<() => void>();
const publish = (next: Record<string, string[]>) => {
  codes = next;
  setCustomFormations(codes);
  version += 1;
  listeners.forEach((l) => l());
};

/** Re-render when the list of formations changes (use the value as a useMemo dependency). */
export function useFormationsVersion(): number {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version, () => version);
}

export async function loadCustomFormations(userId: string): Promise<void> {
  const { data, error } = await db.from('custom_formations').select('sport_type, code').eq('owner_id', userId).order('created_at');
  if (error) return; // offline or table not there yet: the built-in ones still work
  const next: Record<string, string[]> = {};
  for (const r of (data ?? []) as { sport_type: string; code: string }[]) (next[r.sport_type] ??= []).push(r.code);
  publish(next);
}

export const customFormationCodes = (sport: string) => codes[sport] ?? [];

/**
 * Adds a formation typed by the coach. Returns the normalised code, or the reason it
 * cannot be used. A code that already exists (built in or his own) is simply returned.
 */
export async function addCustomFormation(userId: string | undefined, sport: string, input: string): Promise<{ code?: string; error?: string }> {
  const problem = formationCodeProblem(sport, input);
  if (problem) return { error: problem };
  const code = normalizeFormationCode(parseFormationCode(input)!);
  if (isBuiltInFormation(sport, code) || customFormationCodes(sport).includes(code)) return { code };
  if (!buildFormationFromCode(sport, code)) return { error: 'Formação inválida.' };
  // usable right away, even if saving fails (e.g. no network on the pitch)
  publish({ ...codes, [sport]: [...customFormationCodes(sport), code] });
  if (userId) {
    const { error } = await db.from('custom_formations').upsert({ owner_id: userId, sport_type: sport, code }, { onConflict: 'owner_id,sport_type,code' });
    if (error) return { code, error: 'A formação fica disponível agora, mas não foi guardada na conta: ' + error.message };
  }
  return { code };
}

export async function removeCustomFormation(userId: string | undefined, sport: string, code: string): Promise<void> {
  publish({ ...codes, [sport]: customFormationCodes(sport).filter((c) => c !== code) });
  if (userId) await db.from('custom_formations').delete().eq('owner_id', userId).eq('sport_type', sport).eq('code', code);
}

/** Asks the coach for a new formation; returns its code when it can be used. */
export async function promptNewFormation(userId: string | undefined, sport: string, notify: (msg: string, ok: boolean) => void): Promise<string | null> {
  const typed = window.prompt('Nova formação: escreva as linhas da defesa para o ataque, sem o guarda-redes (ex.: 4-1-2-1)');
  if (typed == null || !typed.trim()) return null;
  const r = await addCustomFormation(userId, sport, typed);
  if (!r.code) { notify(r.error ?? 'Formação inválida.', false); return null; }
  if (r.error) notify(r.error, false); else notify(`Formação ${r.code} adicionada.`, true);
  return r.code;
}
