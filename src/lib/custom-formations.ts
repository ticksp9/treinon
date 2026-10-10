/**
 * The coach's own formations (e.g. 4-1-2-1 in football 9). Only the code is stored: the
 * layout is built from it (see buildFormationFromCode), so a match or a board that uses a
 * custom formation opens on any device even before this list is loaded.
 */
import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildFormationFromCode, formationCodeProblem, isBuiltInFormation, normalizeFormationCode, parseFormationCode, setCustomFormations, type CustomFormationEntry, type FormationLayout } from './tactical-formations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

/** mine: what I can change and delete */
let codes: Record<string, CustomFormationEntry[]> = {};
/** of the coaches I share a team with (read only): an assistant sees the head coach's drawings */
let shared: Record<string, CustomFormationEntry[]> = {};
let version = 0;
const listeners = new Set<() => void>();

/** Mine first; a colleague's formation fills in what I do not have — including the drawing of a formation I have without one. */
export function mergeFormationEntries(mine: CustomFormationEntry[], others: CustomFormationEntry[]): CustomFormationEntry[] {
  const out = mine.map((e) => ({ ...e }));
  for (const o of others) {
    const own = out.find((e) => e.code === o.code);
    if (!own) out.push({ ...o });
    else if (!own.layout && o.layout) own.layout = o.layout;
  }
  return out;
}
const publish = (next: Record<string, CustomFormationEntry[]>, nextShared = shared) => {
  codes = next;
  shared = nextShared;
  const sports = new Set([...Object.keys(codes), ...Object.keys(shared)]);
  setCustomFormations(Object.fromEntries([...sports].map((sp) => [sp, mergeFormationEntries(codes[sp] ?? [], shared[sp] ?? [])])));
  version += 1;
  listeners.forEach((l) => l());
};

/** Re-render when the list of formations changes (use the value as a useMemo dependency). */
export function useFormationsVersion(): number {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version, () => version);
}

export async function loadCustomFormations(userId: string): Promise<void> {
  // the database returns mine and those of the coaches I share a team with
  const { data, error } = await db.from('custom_formations').select('owner_id, sport_type, code, layout').order('created_at');
  if (error) return; // offline or table not there yet: the built-in ones still work
  const next: Record<string, CustomFormationEntry[]> = {};
  const others: Record<string, CustomFormationEntry[]> = {};
  for (const r of (data ?? []) as { owner_id: string; sport_type: string; code: string; layout: FormationLayout | null }[]) {
    ((r.owner_id === userId ? next : others)[r.sport_type] ??= []).push({ code: r.code, layout: r.layout });
  }
  publish(next, others);
}

/**
 * Keeps the list fresh while the app is open: when I or a coach of my teams adds, draws or
 * deletes a formation, everyone's list follows within a second. Also refreshes when the
 * app comes back to the foreground, in case the live connection dropped (tablet asleep).
 * Returns the function that stops watching.
 */
export function watchCustomFormations(userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const refresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { loadCustomFormations(userId); }, 250); // several rows changed at once = one reload
  };
  const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  // the database only delivers the rows this user may read (his and his colleagues')
  const channel = supabase
    .channel(`custom-formations-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_formations' }, refresh)
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    supabase.removeChannel(channel);
  };
}

/** the formations the coach created (not his drawings of the ones that come with the app) */
export const customFormationCodes = (sport: string) => (codes[sport] ?? []).map((e) => e.code).filter((c) => !isBuiltInFormation(sport, c));
/** has the coach saved his own drawing of this formation? */
export const hasFormationLayout = (sport: string, code: string) => !!(codes[sport] ?? []).find((e) => e.code === code)?.layout;

/** Saves where the coach dragged the positions, as the drawing of that formation from now on. */
export async function saveFormationLayout(userId: string | undefined, sport: string, code: string, layout: FormationLayout | null): Promise<string | null> {
  const others = (codes[sport] ?? []).filter((e) => e.code !== code);
  // resetting a formation that comes with the app = forgetting it; one of his own stays in the list
  const keep = layout || !isBuiltInFormation(sport, code);
  publish({ ...codes, [sport]: keep ? [...others, { code, layout }] : others });
  if (!userId) return null;
  const q = keep
    ? db.from('custom_formations').upsert({ owner_id: userId, sport_type: sport, code, layout }, { onConflict: 'owner_id,sport_type,code' })
    : db.from('custom_formations').delete().eq('owner_id', userId).eq('sport_type', sport).eq('code', code);
  const { error } = await q;
  return error ? error.message : null;
}

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
  publish({ ...codes, [sport]: [...(codes[sport] ?? []), { code }] });
  if (userId) {
    const { error } = await db.from('custom_formations').upsert({ owner_id: userId, sport_type: sport, code }, { onConflict: 'owner_id,sport_type,code' });
    if (error) return { code, error: 'A formação fica disponível agora, mas não foi guardada na conta: ' + error.message };
  }
  return { code };
}

export async function removeCustomFormation(userId: string | undefined, sport: string, code: string): Promise<void> {
  publish({ ...codes, [sport]: (codes[sport] ?? []).filter((e) => e.code !== code) });
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
