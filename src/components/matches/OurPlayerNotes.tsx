/**
 * After the match, in its report: the coach's notes about each of our players.
 * Saved in match_player_notes, which only the team's coaching staff can read (parents and players
 * see their own lineup rows, so these notes are not kept there).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { tx } from '@/lib/i18n/ui';

const db = supabase as any; // newer than the generated types

export interface PlayerNoteRow { player_id: string; note: string }
interface LineupLike { player_id: string; minutes_played: number | null; player: { name: string; number: number | null } | null }

/** The notes about our players saved for a match (the report and its PDF read them). */
export function useMatchPlayerNotes(matchId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['match-player-notes', matchId],
    enabled: !!user && !!matchId,
    queryFn: async (): Promise<PlayerNoteRow[]> =>
      ((await db.from('match_player_notes').select('player_id, note').eq('match_id', matchId)).data ?? []) as PlayerNoteRow[],
  });
}

/** Played first, then by shirt number; one row per player. */
export function orderForNotes<T extends LineupLike>(lineups: T[]): T[] {
  const seen = new Set<string>();
  return lineups
    .filter((l) => (seen.has(l.player_id) ? false : (seen.add(l.player_id), true)))
    .sort((a, b) => Number((b.minutes_played ?? 0) > 0) - Number((a.minutes_played ?? 0) > 0) || (a.player?.number ?? 99) - (b.player?.number ?? 99));
}

export function OurPlayerNotes({ matchId, lineups, includeInPdf, onIncludeInPdf }: {
  matchId: string;
  lineups: LineupLike[];
  includeInPdf: boolean;
  onIncludeInPdf: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: saved, isLoading } = useMatchPlayerNotes(matchId);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const players = useMemo(() => orderForNotes(lineups), [lineups]);

  const savedMap = useMemo(() => Object.fromEntries((saved ?? []).map((r) => [r.player_id, r.note])), [saved]);
  useEffect(() => { setDraft(savedMap); }, [savedMap]);

  if (isLoading || players.length === 0) return null;
  const changed = players.some((p) => (draft[p.player_id] ?? '').trim() !== (savedMap[p.player_id] ?? ''));

  const save = async () => {
    setSaving(true);
    try {
      const upserts: { match_id: string; player_id: string; note: string }[] = [];
      const removals: string[] = [];
      for (const p of players) {
        const now = (draft[p.player_id] ?? '').trim().slice(0, 2000);
        const before = savedMap[p.player_id] ?? '';
        if (now === before) continue;
        if (now) upserts.push({ match_id: matchId, player_id: p.player_id, note: now });
        else removals.push(p.player_id);
      }
      if (upserts.length) {
        const { error } = await db.from('match_player_notes').upsert(upserts, { onConflict: 'match_id,player_id' });
        if (error) throw error;
      }
      if (removals.length) {
        const { error } = await db.from('match_player_notes').delete().eq('match_id', matchId).in('player_id', removals);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ['match-player-notes', matchId] });
      toast.success(tx('Notas sobre os jogadores guardadas.'));
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="h-4 w-4" />
          {tx('Notas sobre os nossos jogadores')}
        </CardTitle>
        <CardDescription>
          {tx('O que cada um fez bem, o que tem de melhorar, a atitude. Só a equipa técnica vê estas notas: os pais e os jogadores não.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {players.map((p) => {
          const value = draft[p.player_id] ?? '';
          const shown = open[p.player_id] || !!value;
          const played = (p.minutes_played ?? 0) > 0;
          return (
            <div key={p.player_id} className="rounded-md border px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 text-center font-mono text-xs text-muted-foreground">{p.player?.number ?? '–'}</span>
                <span className="flex-1 truncate text-sm font-medium">{p.player?.name ?? '—'}</span>
                <span className="font-mono text-xs text-muted-foreground">{played ? `${p.minutes_played}'` : tx('Não jogou')}</span>
                {!shown && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen((o) => ({ ...o, [p.player_id]: true }))}>
                    {tx('+ Nota')}
                  </Button>
                )}
              </div>
              {shown && (
                <Textarea rows={2} maxLength={2000} className="mt-1.5" value={value} autoFocus={open[p.player_id] && !savedMap[p.player_id]}
                  aria-label={tx('Nota sobre {{name}}', { name: p.player?.name ?? '' })}
                  placeholder={tx('Ex.: boa leitura do jogo; perdeu muitas bolas no 1×1; treinar o pé esquerdo')}
                  onChange={(e) => setDraft((d) => ({ ...d, [p.player_id]: e.target.value }))} />
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeInPdf} onCheckedChange={(v) => onIncludeInPdf(v === true)} />
            {tx('Pôr estas notas no PDF')}
          </label>
          <Button onClick={save} disabled={!changed || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tx('Guardar notas')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
