/**
 * Public club page (/c/:slug), the club's free mini-website: identity, teams,
 * upcoming matches and results. No player data is ever shown.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar, MapPin, Trophy, Users, Facebook, Instagram, Globe, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { shareText } from '@/lib/share';

interface PubMatch { match_date: string; opponent_name: string; is_home: boolean; location: string | null; competition: string | null; team_name: string; goals_for?: number; goals_against?: number }
interface PubClub {
  name: string; logo_url: string | null; founded_year: number | null; primary_color: string | null; secondary_color: string | null;
  history: string | null; address: string | null; website_url: string | null; facebook_url: string | null; instagram_url: string | null;
  teams: { name: string; category: string | null; sport_type: string | null }[];
  upcoming: PubMatch[]; results: PubMatch[];
}

const SPORT: Record<string, string> = { football_11: 'Futebol 11', football_9: 'Futebol 9', football_7: 'Futebol 7', football_5: 'Futebol 5', futsal: 'Futsal' };
const when = (d: string) => { try { return format(new Date(d), "EEE d MMM · HH:mm", { locale: pt }); } catch { return d; } };
const day = (d: string) => { try { return format(new Date(d), 'd MMM', { locale: pt }); } catch { return d; } };
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

export default function PublicClub() {
  const { slug = '' } = useParams();
  const { data: club, isLoading } = useQuery({
    queryKey: ['public-club', slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_club' as never, { _slug: slug } as never);
      if (error) throw error;
      return data as unknown as PubClub | null;
    },
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">A carregar…</div>;
  if (!club) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Página não encontrada</p>
        <p className="text-sm text-muted-foreground">Este clube não tem página pública ativa.</p>
        <Link to="/" className="text-sm text-primary underline">TreinON</Link>
      </div>
    );
  }

  const color = club.primary_color || '#24558f';
  const color2 = club.secondary_color || '#ffffff';
  const socials = [
    { url: safeUrl(club.website_url), icon: Globe, label: 'Site' },
    { url: safeUrl(club.facebook_url), icon: Facebook, label: 'Facebook' },
    { url: safeUrl(club.instagram_url), icon: Instagram, label: 'Instagram' },
  ].filter((s) => s.url);

  return (
    <div className="min-h-screen bg-background">
      <header style={{ background: color, color: color2 }}>
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-8">
          {club.logo_url
            ? <img src={club.logo_url} alt="" className="h-20 w-20 rounded-xl bg-white object-contain p-1 shadow" />
            : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/20 text-3xl font-bold">{club.name[0]}</div>}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">{club.name}</h1>
            {club.founded_year && <p className="opacity-80">Fundado em {club.founded_year}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => shareText(`${club.name}: jogos e resultados\n${window.location.href}`, club.name)}>
            <Share2 className="mr-1.5 h-4 w-4" />Partilhar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Calendar className="h-5 w-5" style={{ color }} />Próximos jogos</h2>
          {club.upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Sem jogos marcados.</p> : (
            <ul className="divide-y rounded-lg border bg-card">
              {club.upcoming.map((m, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                  <span className="w-36 text-sm font-medium capitalize">{when(m.match_date)}</span>
                  <span className="flex-1 font-semibold">{m.team_name} <span className="font-normal text-muted-foreground">{m.is_home ? 'vs' : '@'}</span> {m.opponent_name}</span>
                  {m.location && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{m.location}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5" style={{ color }} />Resultados</h2>
          {club.results.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem resultados.</p> : (
            <ul className="divide-y rounded-lg border bg-card">
              {club.results.map((m, i) => {
                const gf = m.goals_for ?? 0, ga = m.goals_against ?? 0;
                const tone = gf > ga ? 'bg-green-600' : gf < ga ? 'bg-red-600' : 'bg-gray-500';
                return (
                  <li key={i} className="flex items-center gap-3 p-3">
                    <span className="w-14 text-xs text-muted-foreground">{day(m.match_date)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm"><b>{m.team_name}</b> {m.is_home ? 'vs' : '@'} {m.opponent_name}</span>
                    <span className={`rounded px-2 py-0.5 font-mono text-sm font-bold text-white ${tone}`}>{m.is_home ? `${gf}–${ga}` : `${ga}–${gf}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {club.teams.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5" style={{ color }} />Equipas</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {club.teams.map((t, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{[t.category, t.sport_type ? SPORT[t.sport_type] ?? t.sport_type : null].filter(Boolean).join(' · ')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {club.history && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">O clube</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{club.history}</p>
          </section>
        )}

        {(socials.length > 0 || club.address) && (
          <section className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
            {club.address && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{club.address}</span>}
            {socials.map((s) => (
              <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <s.icon className="h-4 w-4" />{s.label}
              </a>
            ))}
          </section>
        )}

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Página do clube feita com <Link to="/" className="underline">TreinON</Link> — gratuito para todas as equipas.
        </footer>
      </main>
    </div>
  );
}
