import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Archive, Lock, Plus } from 'lucide-react';
import { useSeasonContextQuery, useSeasonsList } from '@/hooks/useSeasonContext';
import { closeSeason, archiveSeason } from '@/lib/season-service';
import { generateSeasonReportPdf } from '@/lib/generateSeasonReportPdf';

export default function SeasonClosePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: ctx } = useSeasonContextQuery();
  const { data: seasons = [] } = useSeasonsList();
  const seasonId = ctx?.activeSeasonId ?? null;
  const season = seasons.find((s) => s.id === seasonId) || null;

  const { data: summary } = useQuery({
    queryKey: ['season-close-summary', seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const [matches, trainings, attendance, evaluations, charges] = await Promise.all([
        supabase.from('matches').select('id', { count: 'exact', head: true }).eq('season_id', seasonId as any),
        supabase.from('training_sessions').select('id', { count: 'exact', head: true }).eq('season_id', seasonId as any),
        supabase.from('training_attendance').select('id', { count: 'exact', head: true }).eq('season_id', seasonId as any),
        supabase.from('player_evaluations').select('id', { count: 'exact', head: true }).eq('season_id', seasonId as any),
        supabase.from('charges').select('id', { count: 'exact', head: true }).eq('season_id', seasonId as any),
      ]);
      return {
        matches: matches.count || 0,
        trainings: trainings.count || 0,
        attendance: attendance.count || 0,
        evaluations: evaluations.count || 0,
        charges: charges.count || 0,
      };
    },
  });

  const close = useMutation({
    mutationFn: () => closeSeason(seasonId!),
    onSuccess: () => { toast.success('Época fechada'); qc.invalidateQueries({ queryKey: ['season-context'] }); qc.invalidateQueries({ queryKey: ['seasons-list'] }); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
  const archive = useMutation({
    mutationFn: () => archiveSeason(seasonId!),
    onSuccess: () => { toast.success('Época arquivada (imutável)'); qc.invalidateQueries({ queryKey: ['season-context'] }); qc.invalidateQueries({ queryKey: ['seasons-list'] }); nav('/seasons'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  if (!seasonId || !season) {
    return <div className="p-6"><Card><CardContent className="py-10 text-center text-muted-foreground">Sem época ativa.</CardContent></Card></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Fechar Época</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">{season.name}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{season.start_date} → {season.end_date}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Stat label="Jogos" value={summary?.matches ?? 0} />
            <Stat label="Treinos" value={summary?.trainings ?? 0} />
            <Stat label="Presenças" value={summary?.attendance ?? 0} />
            <Stat label="Avaliações" value={summary?.evaluations ?? 0} />
            <Stat label="Cobranças" value={summary?.charges ?? 0} />
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => generateSeasonReportPdf(seasonId, season.name)}>
              Exportar relatório (PDF)
            </Button>
            <Button onClick={() => nav('/seasons/new')}><Plus className="w-4 h-4 mr-1" /> Criar próxima época</Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary" disabled={season.status !== 'active'}>
                  <Lock className="w-4 h-4 mr-1" /> Fechar época
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Fechar época {season.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A época deixa de ser editável como ativa, mas continua consultável e pode ainda ser reativada por um admin. Esta ação não apaga dados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => close.mutate()}>Fechar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={season.status === 'archived'}>
                  <Archive className="w-4 h-4 mr-1" /> Arquivar (imutável)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Arquivar época {season.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ao arquivar, nenhum registo desta época pode voltar a ser alterado. Continuará disponível apenas para consulta e relatórios. Esta ação é irreversível.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => archive.mutate()}>Arquivar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
