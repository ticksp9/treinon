import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useSeasonsList } from '@/hooks/useSeasonContext';
import { useUserRole } from '@/hooks/useUserRole';
import { previewTransition, applyTransition, type TransitionMode, type PreviewResult } from '@/lib/season-transition-service';
import { describeTransition } from '@/lib/age-group-rules';
import { matchTeamForAgeGroup } from '@/lib/season-roster-service';

const CLASS_LABEL = { stays: 'Mantém', promotes: 'Sobe', leaves: 'Sai', unknown: 'Verificar' } as const;
const CLASS_STYLE = {
  stays: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  promotes: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  leaves: 'bg-muted text-muted-foreground border-border',
  unknown: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
} as const;

export default function SeasonTransitionWizard() {
  const nav = useNavigate();
  const { data: seasons = [] } = useSeasonsList();
  const role = useUserRole();
  const isClubMode = !!role.clubId;

  const [step, setStep] = useState(1);
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [mode, setMode] = useState<TransitionMode>(isClubMode ? 'club_auto' : 'coach_manual');
  const [keepSame, setKeepSame] = useState(true);
  const [targetAgeGroupId, setTargetAgeGroupId] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const toSeason = useMemo(() => seasons.find((s) => s.id === toId), [seasons, toId]);
  const counts = useMemo(() => {
    const items = preview?.items ?? [];
    return {
      transiting: items.filter((item) => item.selected).length,
      promotes: items.filter((item) => item.selected && item.classification === 'promotes').length,
      leaves: items.filter((item) => item.classification === 'leaves').length,
      verify: items.filter((item) => item.classification === 'unknown').length,
      verifyIncluded: items.filter((item) => item.classification === 'unknown' && item.selected).length,
      excluded: items.filter((item) => !item.selected).length,
    };
  }, [preview]);

  const patchPreviewItem = (playerId: string, patch: Partial<PreviewResult['items'][number]>) => {
    setPreview((current) => current ? {
      ...current,
      items: current.items.map((item) => item.player_id === playerId ? { ...item, ...patch, manual: true } : item),
    } : current);
  };

  const selectAllEligible = () => {
    setPreview((current) => current ? {
      ...current,
      items: current.items.map((item) => (
        item.classification === 'leaves' || (current.mode === 'coach_manual' && item.classification === 'promotes')
          ? item
          : { ...item, selected: true }
      )),
    } : current);
  };

  const resetSelection = () => {
    setPreview((current) => current ? {
      ...current,
      items: current.items.map((item) => ({
        ...item,
        selected: !['left', 'loaned_out'].includes(item.current_status)
          && (item.classification === 'stays' || item.classification === 'unknown'
            || (current.mode === 'club_auto' && item.classification === 'promotes')),
        manual: false,
      })),
    } : current);
  };


  const setDestination = (playerId: string, ageGroupId: string) => {
    if (!preview) return;
    const item = preview.items.find((candidate) => candidate.player_id === playerId);
    const group = preview.ageGroups.find((candidate) => candidate.id === ageGroupId) ?? null;
    patchPreviewItem(playerId, {
      proposed_age_group_id: ageGroupId,
      proposed_team_id: matchTeamForAgeGroup(group, preview.teams),
      classification: item?.birth_date
        ? describeTransition(item.current_age_group_id, ageGroupId, preview.ageGroups)
        : 'unknown',
    });
  };

  const runPreview = useMutation({
    mutationFn: async () => {
      if (!fromId || !toId || !toSeason) throw new Error('Selecionar épocas');
      const result = await previewTransition({
        fromSeasonId: fromId,
        toSeasonId: toId,
        mode,
        referenceDate: toSeason.reference_date || toSeason.start_date,
        coachOptions: mode === 'coach_manual'
          ? { keepSameAgeGroup: keepSame, targetAgeGroupId: keepSame ? null : (targetAgeGroupId || null) }
          : undefined,
      });
      setPreview(result);
      setStep(3);
    },
    onError: (e: any) => {
      console.error('[season-transition-wizard] falha ao aplicar', e);
      toast.error('Erro: ' + e.message);
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('Sem preview');
      return await applyTransition(preview);
    },
    onSuccess: (r) => {
      toast.success(`${r.enrolled} jogadores inscritos na nova época`);
      nav('/seasons');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Transição de Época</h1>
      <p className="text-sm text-muted-foreground">Passo {step} de 4</p>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">1. Escolher épocas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>De (origem)</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Para (destino)</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {seasons.filter((s) => s.status !== 'archived').map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => nav('/seasons/new')}>Criar nova época</Button>
              <Button disabled={!fromId || !toId || fromId === toId} onClick={() => setStep(2)}>
                Seguinte <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Modo de transição</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as TransitionMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isClubMode && <SelectItem value="club_auto">Clube — subida automática por escalão</SelectItem>}
                  <SelectItem value="coach_manual">Treinador — escolha manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'coach_manual' && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox id="keep" checked={keepSame} onCheckedChange={(v) => setKeepSame(!!v)} />
                  <Label htmlFor="keep">Manter no mesmo escalão</Label>
                </div>
                {!keepSame && (
                  <div className="space-y-1">
                    <Label>Novo escalão (opcional, se conhecido)</Label>
                    <input
                      className="w-full h-9 border rounded px-2 text-sm bg-background"
                      placeholder="id do escalão"
                      value={targetAgeGroupId}
                      onChange={(e) => setTargetAgeGroupId(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button disabled={runPreview.isPending} onClick={() => runPreview.mutate()}>
                Pré-visualizar <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && preview && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Pré-visualização ({preview.items.length} jogadores)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Transitam {counts.transiting} · Sobem {counts.promotes} · Saem {counts.leaves} · Verificar {counts.verify}
              {counts.verify > 0 ? ` (${counts.verifyIncluded} incluídos)` : ''} · Excluídos {counts.excluded}
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={selectAllEligible}>Selecionar todos</Button>
              <Button size="sm" variant="outline" onClick={resetSelection}>Repor defaults</Button>

            </div>
            <div className="max-h-[480px] overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs">
                  <tr><th className="p-2 text-left">Incluir</th><th className="p-2 text-left">Jogador</th><th className="p-2 text-left">Idade</th><th className="p-2 text-left">Destino</th><th className="p-2 text-left">Classificação</th></tr>
                </thead>
                <tbody>
                  {preview.items.map((i) => (
                    <tr key={i.player_id} className="border-t">
                      <td className="p-2">
                        <Checkbox
                          checked={i.selected}
                          disabled={i.classification === 'leaves' || (preview.mode === 'coach_manual' && i.classification === 'promotes')}
                          onCheckedChange={(value) => patchPreviewItem(i.player_id, { selected: !!value })}
                          aria-label={`Incluir ${i.player_name}`}
                        />
                      </td>
                      <td className="p-2">{i.player_name}</td>
                      <td className="p-2">{i.age_at_reference ?? '—'}</td>
                      <td className="p-2">
                        {preview.mode === 'club_auto' ? (
                          <Select value={i.proposed_age_group_id ?? ''} onValueChange={(value) => setDestination(i.player_id, value)} disabled={i.classification === 'leaves'}>
                            <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {preview.ageGroups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : preview.ageGroups.find((group) => group.id === i.proposed_age_group_id)?.name ?? '—'}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={CLASS_STYLE[i.classification]}>{CLASS_LABEL[i.classification]}</Badge>
                        {i.classification === 'unknown' && <span className="block text-[10px] text-muted-foreground">sem data de nascimento — confirmar elegibilidade</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button onClick={() => counts.transiting > 0 ? setStep(4) : toast.error('Nenhum jogador selecionado para transitar.')}>
                Rever <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {step === 4 && preview && (
        <Card>
          <CardHeader><CardTitle className="text-base">4. Confirmar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Vão ser inscritos <strong>{counts.transiting}</strong> jogadores na época destino.</p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
              <Button disabled={apply.isPending} onClick={() => counts.transiting > 0 ? apply.mutate() : toast.error('Nenhum jogador selecionado para transitar.')}>
                <Check className="w-4 h-4 mr-1" /> Aplicar transição
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
