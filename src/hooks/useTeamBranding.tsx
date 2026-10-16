/**
 * The crest and colours of the teams the user works with, and the theme of the active team.
 * <TeamThemeStyle /> (in the app layout) swaps TreinON's colours for the active team's.
 */
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { resolveBranding, themeCss, type Branding, type BrandingRow } from '@/lib/team-branding';
import { cn } from '@/lib/utils';

export const BRANDING_KEY = 'team-branding';
const NONE: Branding = { crestUrl: null, primary: null, accent: null, fromClub: { crest: false, colors: false } };

export function useBrandingMap() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: [BRANDING_KEY, user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_team_branding' as never);
      if (error) return [] as BrandingRow[];
      return (data ?? []) as unknown as BrandingRow[];
    },
  });
  return useMemo(() => new Map(data.map((r) => [r.team_id, resolveBranding(r)])), [data]);
}

/** The look of a team (the active team when none is given). */
export function useTeamBranding(teamId?: string | null): Branding {
  const map = useBrandingMap();
  const { activeTeamId } = useActiveTeam();
  const id = teamId ?? activeTeamId;
  return (id && map.get(id)) || NONE;
}

/** Puts the active team's colours on the whole app (light and dark). */
export function TeamThemeStyle() {
  const { primary, accent } = useTeamBranding();
  const css = themeCss(primary, accent);
  useEffect(() => {
    let el = document.getElementById('team-theme') as HTMLStyleElement | null;
    if (!css) { el?.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'team-theme'; document.head.appendChild(el); }
    el.textContent = css;
  }, [css]);
  return null;
}

/** The crest, or a plain shield when the team has none. */
export function TeamCrest({ url, name, className }: { url: string | null | undefined; name?: string; className?: string }) {
  if (!url) return <Shield className={cn('shrink-0 text-muted-foreground', className)} aria-hidden />;
  return <img src={url} alt={name ? `Símbolo de ${name}` : 'Símbolo da equipa'} className={cn('shrink-0 object-contain', className)} loading="lazy" />;
}
