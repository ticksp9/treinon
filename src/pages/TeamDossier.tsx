/**
 * /dossier — the team's training dossier (FPF certification, criterion 4.2) in one place:
 * what it must contain, how far each part is, where to fill it, the coordinator's review and the PDF.
 * Coaches see their teams; the club's coordinators and admins choose any team they supervise.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, BookOpenCheck, CheckCircle2, ChevronRight, CircleDashed, FileDown, Info, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { useSeasonContext } from '@/hooks/useSeasonContext';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { longDate, tx } from '@/lib/i18n/ui';
import { dossierScore, dossierSections, type DossierState } from '@/lib/dossier';
import { downloadDossierPdf } from '@/lib/dossier-pdf';
import { useDossierData } from '@/components/dossier/useDossierData';

const db = supabase as any; // newer than the generated types

const STATE_ICON: Record<DossierState, JSX.Element> = {
  done: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  partial: <AlertCircle className="h-5 w-5 text-amber-500" />,
  missing: <CircleDashed className="h-5 w-5 text-destructive" />,
  info: <Info className="h-5 w-5 text-muted-foreground" />,
};

export default function TeamDossier() {
  const { user } = useAuth();
  const { scopeTeams, defaultTeamId, activeTeamId } = useActiveTeam();
  const { selectedSeason } = useSeasonContext();
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({
    queryKey: ['dossier-teams', user?.id, activeTeamId],
    enabled: !!user,
    queryFn: async () => scopeTeams(((await supabase.from('teams').select('id, name, category').order('name')).data ?? []) as { id: string; name: string; category: string | null }[]),
  });
  const [teamId, setTeamId] = useState<string | null>(null);
  useEffect(() => { if (!teamId || !teams.some((t) => t.id === teamId)) setTeamId(defaultTeamId(teams)); }, [teams, teamId, defaultTeamId]);

  const season = selectedSeason ? { id: selectedSeason.id, name: selectedSeason.name, start_date: selectedSeason.start_date, end_date: selectedSeason.end_date } : null;
  const { data, isLoading } = useDossierData(teamId, season);
  const sections = useMemo(() => (data ? dossierSections(data.counts) : []), [data]);
  const score = dossierScore(sections);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const review = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const { error } = await db.from('dossier_reviews').insert({ team_id: data.team.id, season_id: data.season.id, note: note.trim() || null });
      if (error) throw error;
      setNote('');
      await qc.invalidateQueries({ queryKey: ['dossier'] });
      toast.success(tx('Dossier marcado como revisto.'));
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setBusy(false); }
  };

  const pdf = async () => {
    if (!data) return;
    setBusy(true);
    try { await downloadDossierPdf(data, sections); } finally { setBusy(false); }
  };

  return (
    <AppLayout title={tx('Dossier de treino')}>
      <div className="space-y-6">
        <PageHeader
          title={tx('Dossier de treino')}
          description={tx('Tudo o que a FPF pede no dossier de cada equipa, com a mesma estrutura para todas. Preenche-se no dia a dia na app; aqui vê-se o que falta e descarrega-se o PDF.')}
          icon={<BookOpenCheck className="h-6 w-6 text-primary" />}
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>{tx('Equipa')}</Label>
            <Select value={teamId ?? ''} onValueChange={setTeamId}>
              <SelectTrigger className="w-64"><SelectValue placeholder={tx('Selecione uma equipa')} /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {data && (
            <Button onClick={pdf} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}{tx('Descarregar dossier (PDF)')}
            </Button>
          )}
        </div>

        {!season && <p className="text-sm text-muted-foreground">{tx('Escolha primeiro a época (no topo do ecrã).')}</p>}
        {season && isLoading && <p className="py-10 text-center text-sm text-muted-foreground">{tx('A carregar…')}</p>}

        {data && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>{data.team.name} · {tx('Época {{name}}', { name: data.season.name })}</span>
                  <Badge variant={score === 100 ? 'default' : 'outline'} className="text-sm">{tx('{{p}}% completo', { p: score })}</Badge>
                </CardTitle>
                <Progress value={score} className="h-2" />
              </CardHeader>
              <CardContent className="space-y-1.5">
                {sections.map((s) => (
                  <Link key={s.key} to={s.link} className="flex items-center gap-3 rounded-md border px-3 py-2.5 transition hover:border-primary hover:bg-primary/5">
                    {STATE_ICON[s.state]}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{s.title}</span>
                      <span className="block text-xs text-muted-foreground">{s.detail} · {s.hint}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />{tx('Supervisão do coordenador')}</CardTitle>
                <CardDescription>{tx('A FPF pede que o dossier seja supervisionado pelo Diretor ou Coordenador Técnico. Cada revisão fica registada com a data.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.reviews.length === 0 && <p className="text-sm text-muted-foreground">{tx('Ainda não revisto pelo coordenador.')}</p>}
                {data.reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-md border px-3 py-2 text-sm">
                    <p className="font-medium">{longDate(new Date(r.created_at), 'dateTime')} · {r.reviewer || '—'}</p>
                    {r.note && <p className="whitespace-pre-line text-muted-foreground">{r.note}</p>}
                  </div>
                ))}
                {data.canReview ? (
                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <Label htmlFor="review-note">{tx('Nota da revisão (opcional)')}</Label>
                    <Textarea id="review-note" rows={2} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder={tx('Ex.: falta o balanço das semanas 5 e 6; avaliações comportamentais em dia.')} />
                    <Button onClick={review} disabled={busy}><ShieldCheck className="mr-2 h-4 w-4" />{tx('Marcar como revisto')}</Button>
                  </div>
                ) : (
                  <p className={cn('text-xs text-muted-foreground')}>{tx('Só o coordenador desta equipa ou o administrador do clube marcam a revisão.')}</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
