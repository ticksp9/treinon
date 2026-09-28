import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CalendarPlus, Check, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';

import { useSeasonContext, useSeasonScope } from '@/hooks/useSeasonContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  createSeason,
  findSeasonByName,
  getPreviousSeason,
  suggestNextSeason,
  suggestNextSeasonFromList,
  SeasonAlreadyExistsError,
} from '@/lib/season-service';
import {
  attentionRows,
  buildClubProposals,
  buildCoachProposals,
  groupProposalsByAgeGroup,
  loadTransitionSource,
  matchTeamForAgeGroup,
  splitCoachProposals,
  type ProposalRow,
} from '@/lib/season-roster-service';
import { applyWizardTransition } from '@/lib/season-transition-service';
import { AddTransitionPlayerDialog } from '@/components/season-transition/AddTransitionPlayerDialog';
import { describeTransition } from '@/lib/age-group-rules';

const INACTIVE_SOURCE = ['left', 'loaned_out'];


const ACTION_LABEL: Record<string, string> = { stays: 'mantém', promotes: 'sobe', leaves: 'sai', unknown: 'verificar' };
const ACTION_CLASS: Record<string, string> = {
  stays: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  promotes: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  leaves: 'bg-muted text-muted-foreground border-border',
  unknown: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
};

export default function SeasonCreateWizard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { scope } = useSeasonScope();
  const role = useUserRole();
  const isClubMode = !!role.clubId;
  const { seasons, activeSeason, refresh, setSelectedSeason } = useSeasonContext();

  // Previous season = most recent active/closed/archived season (not only the active one).
  const { data: previousFetched, isLoading: loadingPrevious } = useQuery({
    queryKey: ['previous-season', scope?.clubId ?? 'solo', scope?.ownerId ?? 'none'],
    queryFn: () => (scope ? getPreviousSeason(scope) : Promise.resolve(null)),
    enabled: !!scope,
  });

  const previous = useMemo(
    () => previousFetched ?? activeSeason ?? seasons.find((s) => s.status === 'closed') ?? seasons[0] ?? null,
    [previousFetched, activeSeason, seasons],
  );
  const hasPrevious = !!previous;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => suggestNextSeason(null));
  const [initialised, setInitialised] = useState(false);

  // Coach options
  const [keepSame, setKeepSame] = useState(true);
  const [targetAgeGroupId, setTargetAgeGroupId] = useState<string>('');
  const [targetTeamId, setTargetTeamId] = useState<string>('');

  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [manualRows, setManualRows] = useState<ProposalRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);


  useEffect(() => {
    if (initialised) return;
    if (seasons.length === 0) return;
    setForm(seasons.length > 0 ? suggestNextSeasonFromList(seasons) : suggestNextSeason(previous));
    setInitialised(true);
  }, [seasons, previous, initialised]);

  const { data: source } = useQuery({
    queryKey: ['transition-source', previous?.id ?? 'none', role.clubId ?? 'solo'],
    queryFn: () => loadTransitionSource(previous?.id ?? null, role.clubId ?? null),
    enabled: step >= 2,
  });

  // Rebuild proposals whenever the source or the coach options change.
  useEffect(() => {
    if (!source) return;
    const built = isClubMode
      ? buildClubProposals(source, form.reference_date)
      : buildCoachProposals(source, form.reference_date, {
          keepSameAgeGroup: keepSame,
          targetAgeGroupId: keepSame ? null : targetAgeGroupId || null,
          targetTeamId: targetTeamId || null,
        });
    setRows(built);
  }, [source, isClubMode, form.reference_date, keepSame, targetAgeGroupId, targetTeamId]);

  // Manually added players survive rebuilds of the automatic proposal.
  const allRows = useMemo(() => {
    const ids = new Set(rows.map((r) => r.player_id));
    return [...rows, ...manualRows.filter((m) => !ids.has(m.player_id))];
  }, [rows, manualRows]);

  const coachSplit = useMemo(() => splitCoachProposals(allRows), [allRows]);

  const groupName = (id: string | null) => source?.ageGroups.find((g) => g.id === id)?.name ?? '—';
  const teamName = (id: string | null) => source?.teams.find((t) => t.id === id)?.name ?? '—';

  function patchRow(playerId: string, patch: Partial<ProposalRow>) {
    setRows((prev) => prev.map((r) => (r.player_id === playerId ? { ...r, ...patch, manual: true } : r)));
    setManualRows((prev) => prev.map((r) => (r.player_id === playerId ? { ...r, ...patch, manual: true } : r)));
  }
  function toggleRow(playerId: string, selected: boolean) {
    patchRow(playerId, { selected });
  }
  function setRowGroup(playerId: string, groupId: string) {
    const current = allRows.find((r) => r.player_id === playerId);
    const group = source?.ageGroups.find((g) => g.id === groupId) ?? null;
    patchRow(playerId, {
      target_age_group_id: groupId,
      target_team_id: matchTeamForAgeGroup(group, source?.teams ?? []),
      action: current?.birth_date
        ? describeTransition(current.current_age_group_id, groupId, source?.ageGroups ?? [])
        : 'unknown',
    });
  }

  function resetSelection() {
    const defaults = (row: ProposalRow) =>
      !INACTIVE_SOURCE.includes(row.current_status)
      && (row.action === 'stays' || row.action === 'unknown' || (isClubMode && row.action === 'promotes'));
    setRows((prev) => prev.map((r) => ({ ...r, selected: defaults(r), manual: false })));
    setManualRows((prev) => prev.map((r) => ({ ...r, selected: defaults(r), manual: false })));
  }

  function selectAllEligible() {
    const allowed = (row: ProposalRow) =>
      row.action !== 'leaves' && !(!isClubMode && row.action === 'promotes');
    setRows((prev) => prev.map((r) => (allowed(r) ? { ...r, selected: true } : r)));
    setManualRows((prev) => prev.map((r) => (allowed(r) ? { ...r, selected: true } : r)));
  }


  const create = useMutation({
    mutationFn: async (withTransition: boolean) => {
      if (!scope) throw new Error('Sem contexto de utilizador');
      if (withTransition && !previous) {
        throw new Error("Sem época anterior: usa 'Criar sem transitar jogadores'.");
      }
      if (withTransition && selectedCount === 0) {
        throw new Error('Nenhum jogador selecionado para transitar.');
      }
      const duplicate = await findSeasonByName(scope, form.name);
      if (duplicate) throw new SeasonAlreadyExistsError(duplicate);
      const season = await createSeason(scope, {
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        reference_date: form.reference_date,
        previous_season_id: previous?.id ?? null,
      });
      let transitioned = 0;
      if (withTransition && previous) {
        const result = await applyWizardTransition({
          fromSeasonId: previous.id,
          toSeasonId: season.id,
          mode: isClubMode ? 'club_auto' : 'coach_manual',
          referenceDate: form.reference_date,
          rows: allRows.map((r) => ({
            player_id: r.player_id,
            player_name: r.name,
            birth_date: r.birth_date,
            birth_year: r.birth_year,
            from_age_group_id: r.current_age_group_id,
            target_team_id: r.target_team_id,
            target_age_group_id: r.target_age_group_id,
            selected: r.selected,
            action: r.action,
            manual: r.manual,
            reason: r.action === 'unknown' ? 'no_birth_date' : r.action,
          })),
          warnings: allRows.filter((r) => r.warning).map((r) => `${r.name}: ${r.warning}`),
          ageGroups: source?.ageGroups ?? [],
        });
        transitioned = result.enrolled;
      }
      return {
        season,
        transitioned,
        promoted: withTransition ? allRows.filter((r) => r.selected && r.action === 'promotes').length : 0,
        added: withTransition ? manualRows.filter((r) => r.selected).length : 0,

        withTransition,
      };
    },
    onSuccess: ({ season, transitioned, promoted, added, withTransition }) => {
      if (withTransition) {
        toast.success(
          `Transição aplicada: ${transitioned} jogadores transitaram, ${promoted} subiram de escalão, ${added} adicionados.`,
        );
      } else {
        toast.success(`Época ${season.name} criada em planeamento. Ative-a quando quiser começar.`);
      }
      qc.invalidateQueries();
      qc.refetchQueries({ queryKey: ['players'] });
      qc.refetchQueries({ queryKey: ['season-enrollments'] });
      qc.refetchQueries({ queryKey: ['seasons-list'] });

      refresh();
      nav('/seasons');
    },
    onError: (e: any) => {
      if (e instanceof SeasonAlreadyExistsError) {
        toast.error(`Já existe a época ${e.season.name}.`);
        setSelectedSeason(e.season.id);
        refresh();
        nav('/seasons');
        return;
      }
      console.error('[season-wizard] falha ao criar época/transição', e);
      toast.error('Erro: ' + (e?.message ?? 'operação falhou'));
    },
  });



  const selectedCount = allRows.filter((r) => r.selected).length;
  const promotedCount = allRows.filter((r) => r.selected && r.action === 'promotes').length;
  const leavingCount = allRows.filter((r) => r.action === 'leaves').length;
  const verifyCount = allRows.filter((r) => r.action === 'unknown').length;
  const verifyIncludedCount = allRows.filter((r) => r.action === 'unknown' && r.selected).length;
  const excludedCount = allRows.filter((r) => !r.selected).length;

  return (
    <AppLayout title="Nova época">
      <div className="space-y-4 max-w-4xl">
        <PageHeader
          title="Iniciar nova época"
          description={`Passo ${step} de 3`}
          icon={<CalendarPlus className="w-6 h-6 text-primary" />}
        />

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle className="text-base">1. Dados da época</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                {previous && (
                  <p className="text-xs text-muted-foreground">Sugerido a partir da época {previous.name}.</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Início</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Fim</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Data de referência</Label>
                  <Input type="date" value={form.reference_date} onChange={(e) => setForm({ ...form, reference_date: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A data de referência é usada para calcular idades e escalões.
              </p>
              <div className="flex justify-end">
                <Button disabled={!form.name || !form.start_date || !form.end_date} onClick={() => setStep(2)}>
                  Seguinte <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && !isClubMode && (
          <Card>
            <CardHeader><CardTitle className="text-base">2. Transição de jogadores (treinador)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Na nova época, continua na mesma equipa e no mesmo escalão?</Label>
                <Select value={keepSame ? 'yes' : 'no'} onValueChange={(v) => setKeepSame(v === 'yes')}>
                  <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Sim, mesma equipa e escalão</SelectItem>
                    <SelectItem value="no">Não, mudo de escalão/equipa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!keepSame && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Novo escalão</Label>
                    <Select value={targetAgeGroupId} onValueChange={setTargetAgeGroupId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar escalão" /></SelectTrigger>
                      <SelectContent>
                        {(source?.ageGroups || []).map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Nova equipa</Label>
                    <Select value={targetTeamId} onValueChange={setTargetTeamId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar equipa" /></SelectTrigger>
                      <SelectContent>
                        {(source?.teams || []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                O sistema calcula automaticamente, pela data de nascimento e pela data de referência {form.reference_date},
                quem continua no escalão. Não é preciso escolher jogador a jogador.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Ficam neste escalão ({coachSplit.continuing.length})
                  </p>
                  <div className="border rounded max-h-[40vh] overflow-auto divide-y">
                    {coachSplit.continuing.map((r) => (
                      <div key={r.player_id} className="flex items-center gap-2 p-2 text-sm">
                        <span className="flex-1">{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.birth_date ?? '—'}</span>
                        {r.manual && <Badge variant="outline" className="text-[10px]">adicionado</Badge>}
                      </div>
                    ))}
                    {coachSplit.continuing.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">Nenhum jogador elegível.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Sobem de escalão ({coachSplit.leaving.length})</p>
                  <div className="border rounded max-h-[40vh] overflow-auto divide-y">
                    {coachSplit.leaving.map((r) => (
                      <div key={r.player_id} className="flex items-center gap-2 p-2 text-sm">
                        <span className="flex-1">{r.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {INACTIVE_SOURCE.includes(r.current_status) ? 'saiu na época anterior' : 'não transita'}
                        </Badge>
                      </div>
                    ))}
                    {coachSplit.leaving.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">Todos continuam.</p>
                    )}
                  </div>
                </div>
              </div>
              {coachSplit.attention.length > 0 && (
                <div className="border border-amber-500/40 bg-amber-500/5 rounded p-3 space-y-1">
                  <p className="text-sm font-medium">Requer atenção ({coachSplit.attention.length})</p>
                  {coachSplit.attention.map((r) => (
                    <p key={r.player_id} className="text-xs text-muted-foreground">
                      {r.name} — sem data de nascimento. Fica inscrito; confirme a data depois.
                    </p>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1" /> Adicionar jogador
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Os jogadores que não transitam mantêm-se na base de dados e na época anterior; apenas não ficam inscritos nesta.
              </p>


              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                <Button onClick={() => setStep(3)}>Seguinte <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>

            </CardContent>
          </Card>
        )}

        {step === 2 && isClubMode && (
          <Card>
            <CardHeader><CardTitle className="text-base">2. Distribuição por escalão (clube)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Distribuição automática pelo ano de nascimento e data de referência {form.reference_date}. Não é preciso escolher jogador a jogador.
              </p>

              {(source?.ageGroups.length ?? 0) === 0 && (
                <div className="border border-destructive/40 bg-destructive/5 rounded p-3 text-sm">
                  Não existem escalões configurados. Configure os escalões do clube antes de aplicar a transição automática.
                </div>
              )}

              {groupProposalsByAgeGroup(allRows, source?.ageGroups ?? []).length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {groupProposalsByAgeGroup(allRows, source?.ageGroups ?? []).map((b) => (
                    <div key={b.ageGroupId ?? 'none'} className="border rounded p-2 text-xs">
                      <p className="text-sm font-medium">{b.ageGroupName}</p>
                      <p className="text-muted-foreground">
                        entram {b.incoming.length} · mantêm {b.staying.length} · saem {b.leaving.length}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {attentionRows(allRows).length > 0 && (
                <div className="border border-amber-500/40 bg-amber-500/5 rounded p-3 space-y-1">
                  <p className="text-sm font-medium">Requer atenção ({attentionRows(allRows).length})</p>
                  {attentionRows(allRows).map((r) => (
                    <p key={r.player_id} className="text-xs text-muted-foreground">
                      {r.name} — {r.birth_date ? 'sem escalão elegível' : 'sem data de nascimento'}. Confirme a data de nascimento depois.
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1" /> Adicionar jogador
                </Button>
              </div>

              <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-0 text-xs">
                    Ajustes manuais (opcional) {manualOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border rounded max-h-[55vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-xs sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Inscrever</th>
                          <th className="p-2 text-left">Jogador</th>
                          <th className="p-2 text-left">Escalão atual</th>
                          <th className="p-2 text-left">Novo escalão</th>
                          <th className="p-2 text-left">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRows.map((r) => (
                          <tr key={r.player_id} className="border-t">
                            <td className="p-2">
                              <Checkbox checked={r.selected} onCheckedChange={(v) => toggleRow(r.player_id, !!v)} />
                            </td>
                            <td className="p-2">{r.name}</td>
                            <td className="p-2 text-muted-foreground">{groupName(r.current_age_group_id)}</td>
                            <td className="p-2">
                              <Select value={r.target_age_group_id ?? ''} onValueChange={(v) => setRowGroup(r.player_id, v)}>
                                <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {(source?.ageGroups || []).map((g) => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Badge variant={r.action === 'promotes' ? 'default' : 'secondary'} className="text-[10px]">
                                {ACTION_LABEL[r.action]}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {allRows.length === 0 && (
                          <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sem jogadores para transitar.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                <Button onClick={() => setStep(3)}>Seguinte <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>

            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle className="text-base">3. Resumo e confirmação</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                <strong>{form.name}</strong> · {form.start_date} → {form.end_date} · referência {form.reference_date}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Transitam {selectedCount} · Sobem {promotedCount} · Saem {leavingCount} · Verificar {verifyCount}
                  {verifyCount > 0 ? ` (${verifyIncludedCount} incluídos)` : ''} · Excluídos {excludedCount}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAllEligible}>Selecionar todos</Button>
                  <Button size="sm" variant="outline" onClick={resetSelection}>Repor defaults</Button>

                  <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-1" /> Adicionar jogador
                  </Button>
                </div>
              </div>

              {!loadingPrevious && !hasPrevious && (
                <div className="border border-amber-500/40 bg-amber-500/5 rounded p-3 text-sm">
                  Não foi encontrada época anterior. A nova época será criada vazia e poderás inscrever jogadores manualmente.
                </div>
              )}
              <div className="border rounded max-h-[45vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Incluir</th>
                      <th className="p-2 text-left">Jogador</th>
                      <th className="p-2 text-left">Antes</th>
                      <th className="p-2 text-left">Depois</th>
                      <th className="p-2 text-left">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((r) => (

                      <tr key={r.player_id} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={r.selected}
                            disabled={r.action === 'leaves' || (!isClubMode && r.action === 'promotes')}
                            onCheckedChange={(value) => toggleRow(r.player_id, !!value)}
                            aria-label={`Incluir ${r.name}`}
                          />
                        </td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-muted-foreground">
                          {r.current_team_name ?? teamName(r.current_team_id)} · {groupName(r.current_age_group_id)}
                        </td>
                        <td className="p-2">
                          {isClubMode ? (
                            <Select
                              value={r.target_age_group_id ?? ''}
                              onValueChange={(value) => setRowGroup(r.player_id, value)}
                              disabled={r.action === 'leaves'}
                            >
                              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {(source?.ageGroups ?? []).map((group) => (
                                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : r.target_age_group_id ? (
                            `${teamName(r.target_team_id)} · ${groupName(r.target_age_group_id)}`
                          ) : '—'}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className={`text-[10px] ${ACTION_CLASS[r.action] ?? ''}`}>
                            {ACTION_LABEL[r.action] ?? r.action}
                          </Badge>
                          {r.action === 'unknown' && (
                            <span className="block text-[10px] text-muted-foreground">
                              sem data de nascimento — confirmar elegibilidade
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={create.isPending} onClick={() => create.mutate(false)}>
                    Criar sem transitar jogadores
                  </Button>
                  <Button
                    disabled={create.isPending || !hasPrevious}
                    title={
                      hasPrevious && selectedCount > 0
                        ? undefined
                        : hasPrevious
                          ? 'Nenhum jogador selecionado para transitar.'
                        : "Sem época anterior: não há jogadores para transitar. Usa 'Criar sem transitar jogadores'."
                    }
                    onClick={() => selectedCount > 0
                      ? create.mutate(true)
                      : toast.error('Nenhum jogador selecionado para transitar.')}
                  >
                    <Check className="w-4 h-4 mr-1" /> Criar época e aplicar transição
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A nova época fica em planeamento. Só passa a ativa quando a ativar em Épocas.
              </p>
            </CardContent>
          </Card>
        )}

        <AddTransitionPlayerDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          teams={source?.teams ?? []}
          ageGroups={source?.ageGroups ?? []}
          referenceDate={form.reference_date}
          existingPlayerIds={allRows.map((r) => r.player_id)}
          fixedAgeGroupId={!isClubMode && !keepSame ? targetAgeGroupId || null : null}
          onAdd={(row) => setManualRows((prev) => [...prev, row])}
        />
      </div>

    </AppLayout>
  );
}
