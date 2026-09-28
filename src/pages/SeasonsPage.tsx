import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CalendarRange, Plus, Lock, Archive, FileDown, Play, MoreVertical, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSeasonContext } from '@/hooks/useSeasonContext';
import {
  activateSeason,
  archiveSeason,
  canDeleteSeason,
  closeSeason,
  countSeasonDependencies,
  dedupeSeasons,
  deleteSeason,
  detectRenamedSeason,
  formatSeasonPeriod,
  getSeasonCounts,
  getSeasonDataRange,
  getSeasonEditRules,
  SEASON_STATUS_LABEL,
  type SeasonRow,
} from '@/lib/season-service';
import { EditSeasonDialog } from '@/components/seasons/EditSeasonDialog';
import { RepairSeasonDialog } from '@/components/seasons/RepairSeasonDialog';

import { generateSeasonReportPdf } from '@/lib/generateSeasonReportPdf';

export default function SeasonsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { seasons, activeSeason, selectedSeason, setSelectedSeason, refresh } = useSeasonContext();

  const [closing, setClosing] = useState<SeasonRow | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [closedSuggestion, setClosedSuggestion] = useState<SeasonRow | null>(null);
  const [deleting, setDeleting] = useState<SeasonRow | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [editing, setEditing] = useState<SeasonRow | null>(null);
  const [repairing, setRepairing] = useState<SeasonRow | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const groups = dedupeSeasons(seasons);
  const duplicates = groups.flatMap((g) => g.duplicates);
  const visibleSeasons = showDuplicates ? seasons : groups.map((g) => g.season);

  const countsQueries = useQueries({
    queries: visibleSeasons.map((s) => ({
      queryKey: ['season-counts', s.id],
      queryFn: () => getSeasonCounts(s.id),
    })),
  });
  const countsById = new Map(visibleSeasons.map((s, i) => [s.id, countsQueries[i]?.data]));

  const depsQueries = useQueries({
    queries: visibleSeasons.map((s) => ({
      queryKey: ['season-deps', s.id],
      queryFn: () => countSeasonDependencies(s.id),
    })),
  });
  const depsById = new Map(visibleSeasons.map((s, i) => [s.id, depsQueries[i]?.data]));

  const { data: closingCounts } = useQuery({
    queryKey: ['season-counts', closing?.id],
    queryFn: () => getSeasonCounts(closing!.id),
    enabled: !!closing,
  });

  const { data: activeRange } = useQuery({
    queryKey: ['season-data-range', activeSeason?.id],
    queryFn: () => getSeasonDataRange(activeSeason!.id),
    enabled: !!activeSeason,
  });
  const renamedAnomaly = detectRenamedSeason(activeSeason, activeRange);

  function invalidate() {
    refresh();
    qc.invalidateQueries({ queryKey: ['season-counts'] });
    qc.invalidateQueries({ queryKey: ['season-deps'] });
    qc.invalidateQueries({ queryKey: ['season-data-range'] });
  }


  const close = useMutation({
    mutationFn: (id: string) => closeSeason(id),
    onSuccess: () => {
      toast.success('Época terminada. Os dados ficam consultáveis.');
      setClosedSuggestion(closing);
      setClosing(null);
      setConfirmChecked(false);
      invalidate();
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveSeason(id),
    onSuccess: () => {
      toast.success('Época arquivada');
      invalidate();
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const activate = useMutation({
    mutationFn: (id: string) => activateSeason(id),
    onSuccess: (_r, id) => {
      toast.success('Época ativada');
      setSelectedSeason(id);
      invalidate();
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSeason(id),
    onSuccess: (_r, id) => {
      toast.success('Época eliminada');
      if (selectedSeason?.id === id) setSelectedSeason(activeSeason?.id ?? null);
      setDeleting(null);
      setDeleteConfirmName('');
      invalidate();
    },
    onError: (e: any) => toast.error('Não foi possível eliminar: ' + e.message),
  });

  return (
    <AppLayout title="Épocas">
      <div className="space-y-4 max-w-5xl">
        <PageHeader
          title="Épocas Desportivas"
          description="Termine a época atual, crie a próxima e consulte o histórico."
          icon={<CalendarRange className="w-6 h-6 text-primary" />}
          actions={
            <Button onClick={() => nav('/seasons/wizard')}>
              <Plus className="w-4 h-4 mr-1" /> Iniciar nova época
            </Button>
          }
        />

        {seasons.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Ainda não existem épocas. Comece por criar a primeira.
            </CardContent>
          </Card>
        )}

        {duplicates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <span>Existem {duplicates.length} registos duplicados destas épocas — use Eliminar para limpar.</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowDuplicates((v) => !v)}>
              {showDuplicates ? 'Ocultar duplicados' : 'Ver duplicados'}
            </Button>
          </div>
        )}

        {renamedAnomaly && activeSeason && (
          <div className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-sm text-amber-700 dark:text-amber-400 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                A época <strong>{activeSeason.name}</strong> contém jogos/treinos desde {activeRange?.minDate}, anteriores ao
                seu início ({activeSeason.start_date}). Provavelmente é a época anterior que foi renomeada.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setRepairing(activeSeason)}>
              Corrigir: esta época é na verdade a época anterior
            </Button>
          </div>
        )}



        <div className="space-y-2">
          {visibleSeasons.map((s) => {
            const c = countsById.get(s.id);
            const deps = depsById.get(s.id);
            const deletable = canDeleteSeason(s.status, deps ?? 1);
            return (
              <Card key={s.id} className={s.id === selectedSeason?.id ? 'border-primary/50' : undefined}>
                <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <Badge variant={s.is_active ? 'default' : s.status === 'planning' ? 'outline' : 'secondary'}>
                        {SEASON_STATUS_LABEL[s.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatSeasonPeriod(s.start_date, s.end_date)}</p>
                    <p className="text-xs text-muted-foreground">
                      {c ? `${c.matches} jogos · ${c.trainings} treinos · ${c.players} jogadores ativos` : '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.status === 'planning' && (
                      <Button size="sm" onClick={() => activate.mutate(s.id)} disabled={activate.isPending}>
                        <Play className="w-4 h-4 mr-1" /> Ativar época {s.name}
                      </Button>
                    )}
                    {s.status === 'active' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setClosing(s); setConfirmChecked(false); }}>
                          <Lock className="w-4 h-4 mr-1" /> Terminar época
                        </Button>
                        <Button size="sm" onClick={() => nav('/seasons/wizard')}>
                          <Plus className="w-4 h-4 mr-1" /> Criar nova época
                        </Button>
                      </>
                    )}
                    {s.status === 'closed' && (
                      <Button size="sm" variant="outline" onClick={() => archive.mutate(s.id)} disabled={archive.isPending}>
                        <Archive className="w-4 h-4 mr-1" /> Arquivar
                      </Button>
                    )}
                    {(s.status === 'closed' || s.status === 'archived') && (
                      <Button size="sm" variant="ghost" onClick={() => generateSeasonReportPdf(s.id, s.name)}>
                        <FileDown className="w-4 h-4 mr-1" /> Ver resumo
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedSeason(s.id)}>
                      {s.id === selectedSeason?.id ? 'Selecionada' : 'Selecionar'}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ações da época">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setSelectedSeason(s.id)}>Selecionar</DropdownMenuItem>
                        {s.status === 'planning' && (
                          <DropdownMenuItem onClick={() => activate.mutate(s.id)}>Ativar</DropdownMenuItem>
                        )}
                        {s.status === 'active' && (
                          <DropdownMenuItem onClick={() => { setClosing(s); setConfirmChecked(false); }}>
                            Terminar
                          </DropdownMenuItem>
                        )}
                        {s.status === 'closed' && (
                          <DropdownMenuItem onClick={() => archive.mutate(s.id)}>Arquivar</DropdownMenuItem>
                        )}
                        {s.status === 'active' && (
                          <DropdownMenuItem onClick={() => nav('/seasons/wizard')}>Criar nova época</DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          disabled={!getSeasonEditRules(s.status).canEdit}
                          onClick={() => getSeasonEditRules(s.status).canEdit && setEditing(s)}
                          title={getSeasonEditRules(s.status).reason}
                        >
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          disabled={!deletable}
                          onClick={() => deletable && setDeleting(s)}
                          title={
                            deletable
                              ? undefined
                              : s.status !== 'planning'
                                ? 'Só épocas em planeamento podem ser eliminadas.'
                                : 'Esta época tem dados associados — arquive-a em alternativa.'
                          }
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Terminar época — dupla confirmação */}
      <AlertDialog open={!!closing} onOpenChange={(o) => { if (!o) { setClosing(null); setConfirmChecked(false); } }}>
        <AlertDialogContent className="max-h-[85vh] overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar a época {closing?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Período: {closing ? formatSeasonPeriod(closing.start_date, closing.end_date) : ''}
                </p>
                <ul className="list-disc pl-5">
                  <li>{closingCounts?.matches ?? '—'} jogos</li>
                  <li>{closingCounts?.trainings ?? '—'} treinos</li>
                  <li>{closingCounts?.evaluations ?? '—'} avaliações</li>
                  <li>{closingCounts?.players ?? '—'} jogadores inscritos</li>
                </ul>
                <p>
                  Os dados desta época ficam guardados e consultáveis, mas deixam de poder ser alterados após arquivar.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox id="confirm-close" checked={confirmChecked} onCheckedChange={(v) => setConfirmChecked(!!v)} />
                  <Label htmlFor="confirm-close" className="text-sm">Confirmo que quero terminar esta época.</Label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmChecked || close.isPending}
              onClick={(e) => { e.preventDefault(); if (closing) close.mutate(closing.id); }}
            >
              Terminar época
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sugestão pós-fecho */}
      <AlertDialog open={!!closedSuggestion} onOpenChange={(o) => { if (!o) setClosedSuggestion(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar a nova época agora?</AlertDialogTitle>
            <AlertDialogDescription>
              A época {closedSuggestion?.name} foi terminada. Quer criar já a época seguinte (julho a junho)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mais tarde</AlertDialogCancel>
            <AlertDialogAction onClick={() => nav('/seasons/wizard')}>Criar nova época</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Eliminar época */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteConfirmName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar a época {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Esta ação não pode ser anulada. Escreva o nome da época para confirmar.</p>
                <div className="space-y-1">
                  <Label htmlFor="delete-confirm">Nome da época</Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmName}
                    placeholder={deleting?.name}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending || deleteConfirmName.trim() !== deleting?.name}
              onClick={(e) => { e.preventDefault(); if (deleting) remove.mutate(deleting.id); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditSeasonDialog
        season={editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSaved={invalidate}
      />
      <RepairSeasonDialog
        season={repairing}
        onOpenChange={(o) => { if (!o) setRepairing(null); }}
        onDone={invalidate}
      />
    </AppLayout>

  );
}
