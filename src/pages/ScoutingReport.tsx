/**
 * The opponent's report, laid out for paper: summary, key players, the schemes with their
 * drawings, the squad and the matches watched. With ?jogo=<match> it opens with that match's
 * game plan. "Guardar em PDF" uses the browser's own print (choose "Guardar como PDF").
 */
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { BoardPreview } from '@/components/board/BoardPreview';
import { normalizeBoard } from '@/lib/tactic-board';
import {
  FOOT_LABEL, MOMENTS, headToHead, matchesAgainst, plannedSchemes, schemesByMoment, sortSquad, sportLabel,
  type MatchPlan, type Opponent, type OpponentObservation, type OpponentPlayer, type OpponentScheme, type PlayedMatch,
} from '@/lib/opponent-scouting';
import { tx } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const day = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-2 mt-6 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-wide text-slate-900">{children}</h2>
);

export default function ScoutingReport() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const matchId = params.get('jogo');
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['scout-report', id, matchId],
    enabled: !!id && !!user,
    queryFn: async () => {
      const [o, s, p, ob, m, pl, mt] = await Promise.all([
        db.from('scout_opponents').select('*').eq('id', id).maybeSingle(),
        db.from('scout_opponent_schemes').select('*').eq('opponent_id', id).order('created_at'),
        db.from('scout_opponent_players').select('*').eq('opponent_id', id),
        db.from('scout_opponent_observations').select('*').eq('opponent_id', id).order('observed_on', { ascending: false }),
        supabase.from('matches').select('id, opponent_name, match_date, status, is_home, goals_for, goals_against, team:teams(name)').eq('is_deleted', false).order('match_date', { ascending: false }).limit(500),
        matchId ? db.from('match_plans').select('*').eq('match_id', matchId).maybeSingle() : Promise.resolve({ data: null }),
        matchId ? supabase.from('matches').select('id, opponent_name, match_date, location, is_home, team:teams(name)').eq('id', matchId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return {
        opponent: (o.data ?? null) as Opponent | null,
        schemes: (s.data ?? []) as OpponentScheme[],
        players: (p.data ?? []) as OpponentPlayer[],
        observations: (ob.data ?? []) as OpponentObservation[],
        matches: ((m.data ?? []) as unknown as (PlayedMatch & { team: { name: string } | null })[]).map((x) => ({ ...x, team_name: x.team?.name ?? null })),
        plan: (pl.data ?? null) as MatchPlan | null,
        match: (mt.data ?? null) as unknown as { id: string; opponent_name: string; match_date: string; location: string | null; is_home: boolean; team: { name: string } | null } | null,
      };
    },
  });

  const opponent = data?.opponent ?? null;
  const grouped = useMemo(() => schemesByMoment(data?.schemes ?? []), [data?.schemes]);
  const squad = useMemo(() => sortSquad(data?.players ?? []), [data?.players]);
  const against = useMemo(() => (opponent ? matchesAgainst(data?.matches ?? [], opponent.name) : []), [data?.matches, opponent]);
  const h2h = headToHead(against);
  const plan = data?.plan ?? null;
  const picked = plannedSchemes(data?.schemes ?? [], plan?.scheme_ids ?? []);
  const board = (s: OpponentScheme) => normalizeBoard(s.board_data, opponent?.sport_type ?? 'football_11');

  if (isLoading) return <p className="p-10 text-center text-sm text-slate-500">{tx('A preparar o relatório…')}</p>;
  if (!opponent) return <div className="space-y-3 p-10 text-center"><p>{tx('Ficha não encontrada.')}</p><Button variant="outline" asChild><Link to="/scouting">{tx('Voltar aos adversários')}</Link></Button></div>;

  const hasPlan = !!plan && (plan.key_points.length > 0 || !!plan.notes || picked.length > 0);

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900 print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white px-4 py-2 print:hidden">
        <Button variant="ghost" size="sm" asChild><Link to={`/scouting/adversarios/${opponent.id}`}><ArrowLeft className="mr-1 h-4 w-4" />{tx('Ficha')}</Link></Button>
        <span className="text-sm text-slate-500">{tx('Relatório para imprimir ou guardar em PDF (no destino da impressão, escolha «Guardar como PDF»).')}</span>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />{tx('Imprimir / Guardar em PDF')}</Button>
      </div>

      <article className="mx-auto my-4 max-w-[210mm] bg-white p-8 shadow [print-color-adjust:exact] print:m-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-4 border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">{tx('Relatório de adversário')}</p>
            <h1 className="text-3xl font-bold leading-tight">{opponent.name}</h1>
            <p className="text-sm text-slate-600">
              {[opponent.category, sportLabel(opponent.sport_type), opponent.competition, opponent.usual_formation && `Formação habitual ${opponent.usual_formation}`, opponent.coach_name && `Treinador: ${opponent.coach_name}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <p className="text-right text-xs text-slate-500">{tx('TreinON')}<br />{day(new Date().toISOString())}</p>
        </header>

        {data?.match && (
          <section className="break-inside-avoid">
            <H2>{tx('Plano de jogo ·')}{' '}{data.match.team?.name} {data.match.is_home ? 'vs' : tx('em casa de')} {data.match.opponent_name} · {day(data.match.match_date)}{data.match.location ? ` · ${data.match.location}` : ''}</H2>
            {!hasPlan && <p className="text-sm text-slate-500">{tx('Ainda sem plano escrito para este jogo.')}</p>}
            {plan && plan.key_points.length > 0 && (
              <ol className="space-y-1">
                {plan.key_points.map((p, i) => <li key={i} className="flex gap-2 text-base font-semibold"><span className="w-5 shrink-0 text-orange-600">{i + 1}.</span>{p}</li>)}
              </ol>
            )}
            {plan?.notes && <p className="mt-2 whitespace-pre-line text-sm">{plan.notes}</p>}
            {picked.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {picked.map((s) => (
                  <figure key={s.id} className="break-inside-avoid">
                    <BoardPreview state={board(s)} className="rounded-none" />
                    <figcaption className="mt-1 text-xs"><span className="font-semibold">{s.title}</span>{s.notes ? ` — ${s.notes}` : ''}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}

        {(opponent.strengths || opponent.weaknesses || opponent.notes) && (
          <section className="break-inside-avoid">
            <H2>{tx('Resumo')}</H2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs font-bold uppercase text-slate-500">{tx('Pontos fortes')}</p><p className="whitespace-pre-line">{opponent.strengths || '—'}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">{tx('Pontos fracos')}</p><p className="whitespace-pre-line">{opponent.weaknesses || '—'}</p></div>
            </div>
            {opponent.notes && <p className="mt-2 whitespace-pre-line text-sm">{opponent.notes}</p>}
          </section>
        )}

        {MOMENTS.filter((m) => grouped[m.key].length > 0).map((m) => (
          <section key={m.key}>
            <H2>{m.label}</H2>
            <div className="grid grid-cols-2 gap-3">
              {grouped[m.key].map((s) => (
                <figure key={s.id} className="break-inside-avoid">
                  <BoardPreview state={board(s)} className="rounded-none" />
                  <figcaption className="mt-1 text-xs"><span className="font-semibold">{s.title}</span>{s.notes ? <span className="whitespace-pre-line"> — {s.notes}</span> : ''}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}

        {squad.length > 0 && (
          <section>
            <H2>{tx('Plantel')}</H2>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="w-6 py-1" /><th className="w-10 py-1">N.º</th><th className="py-1">{tx('Nome')}</th><th className="w-16 py-1">{tx('Pos.')}</th><th className="w-20 py-1">{tx('Pé')}</th><th className="py-1">{tx('Notas')}</th></tr></thead>
              <tbody>
                {squad.map((p) => (
                  <tr key={p.id} className="break-inside-avoid border-b border-slate-200 align-top">
                    <td className="py-1">{p.is_key && <Star className="h-3.5 w-3.5 fill-orange-500 text-orange-500" aria-label={tx('Jogador-chave')} />}</td>
                    <td className="py-1 font-mono font-bold">{p.shirt_number || '–'}</td>
                    <td className={p.is_key ? 'py-1 font-semibold' : 'py-1'}>{p.name || '—'}</td>
                    <td className="py-1">{p.position || ''}</td>
                    <td className="py-1">{p.foot ? FOOT_LABEL[p.foot] : ''}</td>
                    <td className="whitespace-pre-line py-1 text-slate-700">{p.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {(data?.observations.length ?? 0) > 0 && (
          <section>
            <H2>{tx('Jogos vistos')}</H2>
            <div className="space-y-2">
              {data!.observations.map((o) => (
                <div key={o.id} className="break-inside-avoid text-sm">
                  <p className="font-semibold"><span className="font-mono">{day(o.observed_on)}</span>{o.against ? ` · vs ${o.against}` : ''}{o.result ? ` · ${o.result}` : ''}{o.formation ? ` · ${o.formation}` : ''}</p>
                  {o.notes && <p className="whitespace-pre-line text-slate-700">{o.notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {against.length > 0 && (
          <section className="break-inside-avoid">
            <H2>{tx('Os nossos jogos contra esta equipa')}</H2>
            {h2h.played > 0 && <p className="mb-1 font-mono text-sm">{h2h.played} J · {h2h.won} V · {h2h.drawn} E · {h2h.lost} D · {h2h.goalsFor}–{h2h.goalsAgainst} {tx('em golos')}</p>}
            <table className="w-full border-collapse text-sm">
              <tbody>
                {against.map((m) => (
                  <tr key={m.id} className="border-b border-slate-200">
                    <td className="w-24 py-1 font-mono">{day(m.match_date)}</td>
                    <td className="py-1">{m.team_name}{m.is_home === false ? tx(' (fora)') : m.is_home ? tx(' (casa)') : ''}</td>
                    <td className="py-1 text-right font-mono font-semibold">{m.goals_for != null && m.goals_against != null && m.status === 'completed' ? `${m.goals_for}–${m.goals_against}` : tx('por jogar')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </article>
    </div>
  );
}
