/**
 * After the match, in its report: what the coach saw of the opponent — the team, their formation
 * and notes on their players. Saved as the opponent sheet's observation of this match (Scouting),
 * so it is there the next time we play them; new players also join the sheet's squad.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Binoculars, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/i18n/ui';
import {
  cleanPlayerNotes, findSquadPlayer, MAX_PLAYER_NOTES, opponentResult, sheetForMatch,
  type Opponent, type OpponentObservation, type OpponentPlayer, type OpponentPlayerNote,
} from '@/lib/opponent-scouting';

const db = supabase as any; // newer than the generated types
const emptyRow = (): OpponentPlayerNote => ({ number: '', name: '', note: '', key: false });

/** The notes about the opponent saved for a match (the report's PDF reads them). */
export function useMatchOpponentObservation(matchId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['match-opponent-observation', matchId],
    enabled: !!user && !!matchId,
    queryFn: async () =>
      ((await db.from('scout_opponent_observations').select('notes, formation, player_notes').eq('match_id', matchId).maybeSingle()).data ?? null) as
        Pick<OpponentObservation, 'notes' | 'formation' | 'player_notes'> | null,
  });
}

interface MatchInfo {
  id: string; opponent_name: string; match_date: string; goals_for: number | null; goals_against: number | null;
  sport_type: string | null;
  team: { name: string; club_id: string | null; category: string | null; sport_type: string | null } | null;
}

export function OpponentMatchNotes({ matchId }: { matchId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['match-opponent-notes', matchId],
    enabled: !!user && !!matchId,
    queryFn: async () => {
      const [m, sheets, obs] = await Promise.all([
        supabase.from('matches').select('id, opponent_name, match_date, goals_for, goals_against, sport_type, team:teams(name, club_id, category, sport_type)').eq('id', matchId).maybeSingle(),
        db.from('scout_opponents').select('id, name, sport_type, club_id'),
        db.from('scout_opponent_observations').select('*').eq('match_id', matchId).maybeSingle(),
      ]);
      return {
        match: (m.data ?? null) as unknown as MatchInfo | null,
        sheets: (sheets.data ?? []) as Pick<Opponent, 'id' | 'name' | 'sport_type' | 'club_id'>[],
        observation: (obs.data ?? null) as OpponentObservation | null,
      };
    },
  });

  const [teamNotes, setTeamNotes] = useState('');
  const [formation, setFormation] = useState('');
  const [rows, setRows] = useState<OpponentPlayerNote[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // what was already written for this match
  useEffect(() => {
    if (!data || dirty) return;
    const o = data.observation;
    setTeamNotes(o?.notes ?? '');
    setFormation(o?.formation ?? '');
    const saved = (o?.player_notes ?? []) as OpponentPlayerNote[];
    setRows(saved.length ? saved.map((r) => ({ ...emptyRow(), ...r })) : [emptyRow()]);
  }, [data, dirty]);

  if (isLoading || !data?.match) return null;
  const match = data.match;
  const sport = match.sport_type || match.team?.sport_type || null;
  const sheet = data.observation
    ? data.sheets.find((s) => s.id === data.observation!.opponent_id) ?? null
    : sheetForMatch(data.sheets, match.opponent_name, null, sport);

  const change = (fn: () => void) => { fn(); setDirty(true); };
  const setRow = (i: number, patch: Partial<OpponentPlayerNote>) =>
    change(() => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r))));

  const save = async () => {
    const players = cleanPlayerNotes(rows);
    if (!teamNotes.trim() && !formation.trim() && players.length === 0) {
      toast.error(tx('Escreva alguma coisa sobre o adversário antes de guardar.'));
      return;
    }
    setSaving(true);
    try {
      // the opponent's sheet: the one already linked, one with the same name, or a new one
      let opponentId = sheet?.id ?? null;
      if (!opponentId) {
        const { data: created, error } = await db.from('scout_opponents').insert({
          name: match.opponent_name.trim().slice(0, 120),
          club_id: match.team?.club_id ?? null,
          category: match.team?.category ?? null,
          sport_type: sport || 'football_11',
        }).select('id').single();
        if (error) throw error;
        opponentId = created.id;
      }
      const row = {
        notes: teamNotes.trim().slice(0, 8000) || null,
        formation: formation.trim().slice(0, 20) || null,
        player_notes: players,
        observed_on: match.match_date.slice(0, 10),
        against: match.team?.name ?? null,
        result: opponentResult(match.goals_for, match.goals_against),
      };
      const { error: obsError } = data.observation
        ? await db.from('scout_opponent_observations').update(row).eq('id', data.observation.id)
        : await db.from('scout_opponent_observations').insert({ ...row, opponent_id: opponentId, match_id: matchId });
      if (obsError) throw obsError;

      // players seen for the first time join the sheet's squad; key players are marked
      const { data: squad } = await db.from('scout_opponent_players').select('id, shirt_number, name, is_key').eq('opponent_id', opponentId);
      const known = (squad ?? []) as Pick<OpponentPlayer, 'id' | 'shirt_number' | 'name' | 'is_key'>[];
      for (const p of players) {
        const found = findSquadPlayer(known, p);
        if (!found) {
          await db.from('scout_opponent_players').insert({ opponent_id: opponentId, shirt_number: p.number || null, name: p.name || null, notes: p.note || null, is_key: p.key });
        } else if (p.key && !found.is_key) {
          await db.from('scout_opponent_players').update({ is_key: true }).eq('id', found.id);
        }
      }
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ['match-opponent-notes', matchId] });
      qc.invalidateQueries({ queryKey: ['match-opponent-observation', matchId] });
      qc.invalidateQueries({ queryKey: ['scout-observations', opponentId] });
      toast.success(tx('Notas sobre o adversário guardadas. Também ficam na ficha de {{name}} em Scouting.', { name: match.opponent_name }));
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
          <Binoculars className="h-4 w-4" />
          {tx('Sobre o adversário: {{name}}', { name: match.opponent_name })}
        </CardTitle>
        <CardDescription>
          {tx('Como jogaram, o que resultou contra eles e os jogadores a ter em conta. Fica também na ficha do adversário em Scouting, para o próximo jogo.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div className="space-y-1.5">
            <Label htmlFor="opp-team-notes">{tx('Notas sobre a equipa')}</Label>
            <Textarea id="opp-team-notes" rows={4} maxLength={8000} value={teamNotes}
              onChange={(e) => change(() => setTeamNotes(e.target.value))}
              placeholder={tx('Ex.: pressionam alto na saída de bola; o lateral esquerdo sobe muito e deixa espaço nas costas; perigosos nos cantos.')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opp-formation">{tx('Formação deles')}</Label>
            <Input id="opp-formation" maxLength={20} value={formation} placeholder="4-3-3"
              onChange={(e) => change(() => setFormation(e.target.value))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{tx('Notas sobre jogadores deles')}</Label>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[3.5rem_1fr_auto_auto] items-start gap-2 sm:grid-cols-[3.5rem_10rem_1fr_auto_auto]">
              <Input inputMode="numeric" maxLength={3} value={r.number} placeholder={tx('N.º')} aria-label={tx('Número')}
                onChange={(e) => setRow(i, { number: e.target.value.replace(/\D/g, '') })} />
              <Input maxLength={120} value={r.name} placeholder={tx('Nome (opcional)')} aria-label={tx('Nome')}
                className="sm:col-auto" onChange={(e) => setRow(i, { name: e.target.value })} />
              <Button type="button" size="icon" variant={r.key ? 'default' : 'outline'} className="h-10 w-10 shrink-0"
                onClick={() => setRow(i, { key: !r.key })} aria-pressed={r.key}
                aria-label={r.key ? tx('Deixar de marcar como jogador-chave') : tx('Marcar como jogador-chave')}
                title={tx('Jogador-chave')}>
                <Star className={cn('h-4 w-4', r.key && 'fill-current')} />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-muted-foreground"
                onClick={() => change(() => setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : [emptyRow()])))}
                aria-label={tx('Retirar')}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Textarea rows={2} maxLength={1000} value={r.note}
                className="col-span-4 sm:col-span-1 sm:col-start-3 sm:row-start-1"
                placeholder={tx('Ex.: rápido, finta para dentro com o pé direito; não defende')}
                onChange={(e) => setRow(i, { note: e.target.value })} />
            </div>
          ))}
          {rows.length < MAX_PLAYER_NOTES && (
            <Button type="button" variant="outline" size="sm" onClick={() => change(() => setRows((rs) => [...rs, emptyRow()]))}>
              <Plus className="mr-1 h-4 w-4" />{tx('Juntar jogador')}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tx('Guardar notas')}
          </Button>
          {sheet && (
            <Link to={`/scouting/adversarios/${sheet.id}`} className="text-sm text-primary underline-offset-2 hover:underline">
              {tx('Abrir a ficha de {{name}}', { name: sheet.name })}
            </Link>
          )}
          {dirty && <span className="text-xs text-muted-foreground">{tx('Alterações por guardar')}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
