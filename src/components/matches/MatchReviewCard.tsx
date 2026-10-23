/**
 * After the match, in its report: the coach's written review (FPF dossier: "avaliação dos jogos",
 * a reflection and not only statistics). What went well, what to improve, what to train next.
 * Saved in match_reviews, which only the team's coaching staff can read.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { tx } from '@/lib/i18n/ui';

const db = supabase as any; // newer than the generated types

export interface MatchReview { positives: string | null; improve: string | null; next_focus: string | null }

export const reviewIsEmpty = (r: MatchReview | null | undefined) => !r || ![r.positives, r.improve, r.next_focus].some((v) => v?.trim());

/** The written review of a match (the report and its PDF read it). */
export function useMatchReview(matchId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['match-review', matchId],
    enabled: !!user && !!matchId,
    queryFn: async (): Promise<MatchReview | null> =>
      ((await db.from('match_reviews').select('positives, improve, next_focus').eq('match_id', matchId).maybeSingle()).data ?? null) as MatchReview | null,
  });
}

const FIELDS: { key: keyof MatchReview; label: () => string; hint: () => string }[] = [
  { key: 'positives', label: () => tx('O que correu bem'), hint: () => tx('Ex.: boa pressão depois da perda; saídas curtas do guarda-redes') },
  { key: 'improve', label: () => tx('O que temos de melhorar'), hint: () => tx('Ex.: muito espaço entre linhas; bolas paradas defensivas') },
  { key: 'next_focus', label: () => tx('O que vamos treinar a seguir'), hint: () => tx('Ex.: jogos reduzidos com transição defensiva') },
];

export function MatchReviewCard({ matchId, includeInPdf, onIncludeInPdf }: { matchId: string; includeInPdf: boolean; onIncludeInPdf: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: saved, isLoading, isError } = useMatchReview(matchId);
  const [draft, setDraft] = useState<MatchReview>({ positives: '', improve: '', next_focus: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft({ positives: saved?.positives ?? '', improve: saved?.improve ?? '', next_focus: saved?.next_focus ?? '' }); }, [saved]);

  if (isLoading || isError) return null;
  const changed = FIELDS.some((f) => (draft[f.key] ?? '').trim() !== (saved?.[f.key] ?? ''));

  const save = async () => {
    setSaving(true);
    try {
      const row = Object.fromEntries(FIELDS.map((f) => [f.key, (draft[f.key] ?? '').trim().slice(0, f.key === 'next_focus' ? 2000 : 4000) || null])) as unknown as MatchReview;
      const { error } = reviewIsEmpty(row)
        ? await db.from('match_reviews').delete().eq('match_id', matchId)
        : await db.from('match_reviews').upsert({ match_id: matchId, ...row }, { onConflict: 'match_id' });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['match-review', matchId] });
      qc.invalidateQueries({ queryKey: ['dossier'] });
      toast.success(tx('Balanço do jogo guardado.'));
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4" />{tx('Balanço do jogo')}</CardTitle>
        <CardDescription>{tx('A reflexão do treinador sobre o jogo, para o dossier de treino. Só a equipa técnica vê.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`review-${f.key}`}>{f.label()}</Label>
            <Textarea id={`review-${f.key}`} rows={2} maxLength={f.key === 'next_focus' ? 2000 : 4000} value={draft[f.key] ?? ''} placeholder={f.hint()}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeInPdf} onCheckedChange={(v) => onIncludeInPdf(v === true)} />
            {tx('Pôr o balanço no PDF')}
          </label>
          <Button onClick={save} disabled={!changed || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tx('Guardar balanço')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
