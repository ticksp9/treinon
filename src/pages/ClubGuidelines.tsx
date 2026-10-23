/**
 * The club's guiding document (Documento Orientador, FPF certification criterion 4.1): the vision,
 * the game model for 7, 9 and 11 (and futsal), and what each stage of development learns.
 * The club's admins and coordinators write it; the club's coaches read it. A coach without a club
 * keeps their own. Each team's dossier shows the part that concerns it.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, FileDown, Loader2, Plus, ScrollText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { tx } from '@/lib/i18n/ui';
import {
  cleanGuidelines, defaultStages, GAME_FORMATS, guidelinesProgress, MODEL_FIELDS, newStage, STAGE_FIELDS,
  type GameFormat, type GameModel, type Guidelines, type Stage,
} from '@/lib/guidelines';
import { downloadGuidelinesPdf } from '@/lib/guidelines-pdf';

const db = supabase as any; // newer than the generated types

/** The guiding document of a club (or of the coach, without a club). */
export function useGuidelines(clubId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-guidelines', clubId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<{ id: string; content: Guidelines; updated_at: string } | null> => {
      const q = db.from('club_guidelines').select('id, content, updated_at');
      const { data, error } = await (clubId ? q.eq('club_id', clubId) : q.eq('owner_id', user!.id)).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export default function ClubGuidelines() {
  const { user } = useAuth();
  const { activeTeam } = useActiveTeam();
  const role = useUserRole();
  const clubId = activeTeam?.club_id ?? role.clubId ?? null;
  const canEdit = !clubId || (clubId === role.clubId && (role.isClubAdmin || role.staffRole === 'coordenador'));
  const clubName = activeTeam?.club_name ?? null;
  const qc = useQueryClient();
  const { data: saved, isLoading } = useGuidelines(clubId);
  const [g, setG] = useState<Guidelines>({});
  const [format, setFormat] = useState<GameFormat>('7');
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setG(saved?.content ?? {}); }, [saved]);
  const progress = useMemo(() => guidelinesProgress(g), [g]);
  const dirty = JSON.stringify(cleanGuidelines(g)) !== JSON.stringify(cleanGuidelines(saved?.content ?? {}));

  const setModel = (f: GameFormat, patch: Partial<GameModel>) => setG((x) => ({ ...x, models: { ...x.models, [f]: { ...x.models?.[f], ...patch } } }));
  const setStage = (i: number, patch: Partial<Stage>) => setG((x) => ({ ...x, stages: (x.stages ?? []).map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const save = async () => {
    setSaving(true);
    try {
      const content = cleanGuidelines(g);
      const { error } = saved
        ? await db.from('club_guidelines').update({ content }).eq('id', saved.id)
        : await db.from('club_guidelines').insert(clubId ? { club_id: clubId, content } : { owner_id: user!.id, content });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['club-guidelines'] });
      qc.invalidateQueries({ queryKey: ['dossier'] });
      toast.success(tx('Documento orientador guardado.'));
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  const area = (id: string, value: string | undefined, onChange: (v: string) => void, placeholder: string, rows = 3, max = 4000) => (
    <Textarea id={id} rows={rows} maxLength={max} value={value ?? ''} readOnly={!canEdit} placeholder={canEdit ? placeholder : tx('Por definir.')}
      onChange={(e) => onChange(e.target.value)} />
  );

  return (
    <AppLayout title={tx('Documento orientador')}>
      <div className="space-y-6 pb-20">
        <PageHeader
          title={tx('Documento orientador')}
          description={canEdit
            ? tx('A forma de jogar e de formar do clube, igual para todas as equipas. A FPF pede-o na certificação (modelo de jogo para 7, 9 e 11 e objetivos de cada etapa).')
            : tx('A forma de jogar e de formar de {{club}}. Só a coordenação o altera.', { club: clubName ?? tx('o clube') })}
          icon={<ScrollText className="h-6 w-6 text-primary" />}
        />
        {isLoading ? <p className="text-sm text-muted-foreground">{tx('A carregar…')}</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className={progress.formats === 3 ? 'border-emerald-500 text-emerald-700' : ''}>{tx('Modelo de jogo: {{n}} de 3 formatos (7, 9 e 11)', { n: progress.formats })}</Badge>
              <Badge variant="outline" className={progress.stages > 0 && progress.stages === progress.total ? 'border-emerald-500 text-emerald-700' : ''}>{tx('Etapas com objetivos: {{a}} de {{b}}', { a: progress.stages, b: progress.total })}</Badge>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadGuidelinesPdf(clubName ?? tx('As minhas equipas'), cleanGuidelines(g))}>
                <FileDown className="mr-1.5 h-4 w-4" />{tx('Descarregar PDF')}
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tx('1. Visão e filosofia de formação')}</CardTitle>
                <CardDescription>{tx('Que jogador o clube quer formar e como.')}</CardDescription>
              </CardHeader>
              <CardContent>
                {area('gl-vision', g.vision, (v) => setG((x) => ({ ...x, vision: v })), tx('Ex.: Formar jogadores inteligentes, criativos e com valores, que gostam de ter a bola.'), 4, 6000)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tx('2. Modelo de jogo')}</CardTitle>
                <CardDescription>{tx('Como o clube quer jogar em cada formato. Os quatro momentos do jogo e as bolas paradas.')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={format} onValueChange={(v) => setFormat(v as GameFormat)}>
                  <TabsList className="flex h-auto flex-wrap">
                    {GAME_FORMATS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}
                  </TabsList>
                  {GAME_FORMATS.map((f) => (
                    <TabsContent key={f.value} value={f.value} className="mt-3 space-y-3">
                      {MODEL_FIELDS.map((k) => (
                        <div key={k.key} className="space-y-1.5">
                          <Label htmlFor={`gl-${f.value}-${k.key}`}>{k.label}</Label>
                          {k.key === 'system'
                            ? <Input id={`gl-${f.value}-${k.key}`} maxLength={200} readOnly={!canEdit} value={g.models?.[f.value]?.system ?? ''} placeholder={canEdit ? k.hint : tx('Por definir.')}
                                onChange={(e) => setModel(f.value, { system: e.target.value })} />
                            : area(`gl-${f.value}-${k.key}`, g.models?.[f.value]?.[k.key], (v) => setModel(f.value, { [k.key]: v }), k.hint)}
                        </div>
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tx('3. Etapas de formação')}</CardTitle>
                <CardDescription>{tx('O que cada etapa aprende do jogo, as capacidades motoras, o desenvolvimento psicológico, as competências por posição e o perfil do treinador.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(g.stages ?? []).length === 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">{tx('Ainda sem etapas.')}</p>
                    {canEdit && <Button size="sm" variant="outline" onClick={() => setG((x) => ({ ...x, stages: defaultStages() }))}>{tx('Começar com as etapas de exemplo')}</Button>}
                  </div>
                )}
                {(g.stages ?? []).map((s, i) => (
                  <div key={i} className="rounded-md border">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{s.name || tx('Etapa sem nome')}</span>
                        <span className="block text-xs text-muted-foreground">{s.ages}</span>
                      </span>
                      {!s.game?.trim() && <Badge variant="outline" className="text-[10px]">{tx('Faltam objetivos')}</Badge>}
                      {open === i ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {open === i && (
                      <div className="space-y-3 border-t p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5"><Label htmlFor={`st-${i}-name`}>{tx('Etapa')}</Label>
                            <Input id={`st-${i}-name`} maxLength={120} readOnly={!canEdit} value={s.name} onChange={(e) => setStage(i, { name: e.target.value })} placeholder={tx('Ex.: Infantis')} /></div>
                          <div className="space-y-1.5"><Label htmlFor={`st-${i}-ages`}>{tx('Idades e formato')}</Label>
                            <Input id={`st-${i}-ages`} maxLength={120} readOnly={!canEdit} value={s.ages} onChange={(e) => setStage(i, { ages: e.target.value })} placeholder={tx('Ex.: Sub-12 e Sub-13 · futebol de 9')} /></div>
                        </div>
                        {STAGE_FIELDS.map((f) => (
                          <div key={f.key} className="space-y-1.5">
                            <Label htmlFor={`st-${i}-${f.key}`}>{f.label}</Label>
                            {area(`st-${i}-${f.key}`, s[f.key], (v) => setStage(i, { [f.key]: v }), '', 2)}
                          </div>
                        ))}
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setG((x) => ({ ...x, stages: (x.stages ?? []).filter((_, k) => k !== i) })); setOpen(null); }}>
                            <Trash2 className="mr-1.5 h-4 w-4" />{tx('Retirar etapa')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {canEdit && (g.stages ?? []).length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => { setG((x) => ({ ...x, stages: [...(x.stages ?? []), newStage()] })); setOpen((g.stages ?? []).length); }}>
                    <Plus className="mr-1 h-4 w-4" />{tx('Juntar etapa')}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tx('4. Como o clube trabalha o modelo')}</CardTitle>
                <CardDescription>{tx('Reuniões, a ação de formação com todas as equipas técnicas, a observação de treinos pela coordenação.')}</CardDescription>
              </CardHeader>
              <CardContent>
                {area('gl-process', g.process, (v) => setG((x) => ({ ...x, process: v })), tx('Ex.: Reunião mensal por etapa; ação de formação interna em setembro; o coordenador vê um treino de cada equipa por mês.'))}
              </CardContent>
            </Card>

            {canEdit && (
              <div className="sticky bottom-3 z-10 flex justify-end">
                <Button onClick={save} disabled={!dirty || saving} className="shadow-lg">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar documento')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
