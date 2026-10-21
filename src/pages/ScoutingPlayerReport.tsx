/**
 * The report of a watched player, laid out for paper: who he is, the radar, the evolution
 * and every observation. The contact never goes on the report.
 */
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { ScoutEvolution, ScoutRadar } from '@/components/scouting/ScoutCharts';
import { FOOT_LABEL, sportLabel } from '@/lib/opponent-scouting';
import {
  AREAS, ageOf, areaAverages, markHistory, observationMark, overallMark, recommendationLabel, relativeAgeNote, statusLabel, yearOfBirth,
  type ScoutObservation, type ScoutPlayer,
} from '@/lib/player-scouting';
import { tx, intlLocale } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const day = (d: string) => new Date(d).toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
const num = (n: number | null) => (n != null ? String(n).replace('.', ',') : '–');
const INK = '#0f172a', BLUE = '#1d4ed8';

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-2 mt-6 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-wide text-slate-900">{children}</h2>
);

export default function ScoutingPlayerReport() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['scout-player-report', id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const [p, o] = await Promise.all([
        db.from('scout_players').select('*').eq('id', id).maybeSingle(),
        db.from('scout_player_observations').select('*').eq('scout_player_id', id).order('observed_on', { ascending: false }),
      ]);
      return { player: (p.data ? { ...p.data, video_links: p.data.video_links ?? [] } : null) as ScoutPlayer | null, observations: (o.data ?? []) as ScoutObservation[] };
    },
  });
  const player = data?.player ?? null;
  const observations = data?.observations ?? [];

  if (isLoading) return <p className="p-10 text-center text-sm text-slate-500">{tx('A preparar o relatório…')}</p>;
  if (!player) return <div className="space-y-3 p-10 text-center"><p>{tx('Ficha não encontrada.')}</p><Button variant="outline" asChild><Link to="/scouting?tab=jogadores">{tx('Voltar aos jogadores')}</Link></Button></div>;

  const age = ageOf(player);
  const averages = areaAverages(observations);
  const history = markHistory(observations);
  const ageNote = relativeAgeNote(player);
  const last = observations[0];
  const facts: [string, string | null][] = [
    ['Nascimento', player.birth_date ? `${day(player.birth_date)}${age != null ? ` (${age} anos)` : ''}` : yearOfBirth(player) ? String(yearOfBirth(player)) : null],
    ['Clube atual', player.current_club], ['Escalão', player.category], ['Modalidade', sportLabel(player.sport_type)],
    ['Posição', [player.position, player.other_positions].filter(Boolean).join(' · ') || null],
    ['Pé', player.foot ? FOOT_LABEL[player.foot] : null], ['Altura', player.height_cm ? `${player.height_cm} cm` : null],
    ['Onde foi visto', player.found_at], ['Estado', statusLabel(player.status)],
    ['Última recomendação', recommendationLabel(last?.recommendation)],
  ];

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900 print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white px-4 py-2 print:hidden">
        <Button variant="ghost" size="sm" asChild><Link to={`/scouting/jogadores/${player.id}`}><ArrowLeft className="mr-1 h-4 w-4" />{tx('Ficha')}</Link></Button>
        <span className="text-sm text-slate-500">{tx('Relatório para imprimir ou guardar em PDF (no destino da impressão, escolha «Guardar como PDF»). O contacto não é incluído.')}</span>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />{tx('Imprimir / Guardar em PDF')}</Button>
      </div>

      <article className="mx-auto my-4 max-w-[210mm] bg-white p-8 shadow [print-color-adjust:exact] print:m-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-4 border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">{tx('Relatório de jogador observado')}</p>
            <h1 className="text-3xl font-bold leading-tight">{player.name}</h1>
            <p className="text-sm text-slate-600">{[player.position, player.current_club, player.category, age != null ? `${age} anos` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <p className="text-right text-xs text-slate-500">{tx('TreinON')}<br />{day(new Date().toISOString())}</p>
        </header>

        <section className="mt-4 grid grid-cols-[1fr_15rem] gap-6">
          <div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="text-[11px] font-bold uppercase text-slate-500">{k}</dt><dd className="text-sm">{v}</dd></div>
              ))}
            </dl>
            {ageNote && <p className="mt-3 border-l-4 border-orange-500 bg-orange-50 p-2 text-sm">{ageNote}</p>}
            {player.summary && <><p className="mt-3 text-[11px] font-bold uppercase text-slate-500">{tx('Resumo')}</p><p className="whitespace-pre-line text-sm">{player.summary}</p></>}
          </div>
          <div>
            <p className="flex items-baseline justify-between text-[11px] font-bold uppercase text-slate-500">{tx('Avaliação média')}{' '}<span className="font-mono text-2xl text-slate-900">{num(overallMark(observations))}<span className="text-xs font-normal text-slate-500"> / 5</span></span></p>
            <ScoutRadar values={averages} color={BLUE} ink={INK} className="w-full" />
            <ScoutEvolution history={history} color={BLUE} ink={INK} className="w-full" />
            <p className="text-center text-[11px] text-slate-500">{observations.length} {observations.length === 1 ? tx('observação') : tx('observações')}</p>
          </div>
        </section>

        <H2>{tx('Observações')}</H2>
        {observations.length === 0 && <p className="text-sm text-slate-500">{tx('Ainda sem observações.')}</p>}
        <div className="space-y-3">
          {observations.map((o) => (
            <div key={o.id} className="break-inside-avoid border-b border-slate-200 pb-2 text-sm">
              <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                <span className="font-mono">{day(o.observed_on)}</span>
                {o.context && <span>{o.context}</span>}
                {o.position_played && <span className="font-normal text-slate-600">· {o.position_played}</span>}
                {o.minutes_seen != null && <span className="font-normal text-slate-600">· {o.minutes_seen}{tx('\' vistos')}</span>}
                <span className="ml-auto font-mono">{num(observationMark(o))} / 5</span>
              </p>
              <p className="text-xs text-slate-600">{AREAS.map((a) => `${a.label} ${num(o[a.key])}`).join(' · ')}{recommendationLabel(o.recommendation) ? tx(' · Recomendação: {{v0}}', { v0: recommendationLabel(o.recommendation) }) : ''}</p>
              {(o.strengths || o.weaknesses) && (
                <div className="mt-1 grid grid-cols-2 gap-4">
                  <div>{o.strengths && <><p className="text-[11px] font-bold uppercase text-slate-500">{tx('Fortes')}</p><p className="whitespace-pre-line">{o.strengths}</p></>}</div>
                  <div>{o.weaknesses && <><p className="text-[11px] font-bold uppercase text-slate-500">{tx('A melhorar')}</p><p className="whitespace-pre-line">{o.weaknesses}</p></>}</div>
                </div>
              )}
              {o.notes && <p className="mt-1 whitespace-pre-line text-slate-700">{o.notes}</p>}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
