/**
 * Active team: coaches with more than one team choose which one they are working
 * with. Screens then show only the teams of that club (or only their own teams),
 * so call-ups and players of different clubs never get mixed.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Check, User } from 'lucide-react';
import { contextTeamIds, groupTeams, resolveActive, ROLE_LABEL, scopeToContext, type MyTeam } from '@/lib/active-team';
import { cn } from '@/lib/utils';

interface Ctx {
  myTeams: MyTeam[];
  activeTeam: MyTeam | null;
  activeTeamId: string | null;
  /** keep only the teams of the active club / own teams (lists the user does not coach are left alone) */
  scopeTeams: <T extends { id: string }>(list: T[]) => T[];
  /** the active team if it is in the list, else the first */
  defaultTeamId: <T extends { id: string }>(list: T[]) => string | null;
  openChooser: () => void;
}

const ActiveTeamContext = createContext<Ctx>({
  myTeams: [], activeTeam: null, activeTeamId: null,
  scopeTeams: (l) => l, defaultTeamId: (l) => l[0]?.id ?? null, openChooser: () => {},
});

const teamKey = (uid: string) => `treinon_active_team_${uid}`;
export const activeClubKey = (uid: string) => `treinon_active_club_${uid}`;
/** marker for "working with my own teams (no club)" */
const OWN = 'own';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* ignore */ } };

// pages where nobody is "working with a team" yet
const PUBLIC_PREFIXES = ['/auth', '/instalar', '/biblioteca', '/accept-invite', '/c', '/guardian', '/player', '/oauth'];

export function ActiveTeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [storedId, setStoredId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { setStoredId(user ? read(teamKey(user.id)) : null); }, [user?.id]);

  const { data: myTeams = [], isSuccess } = useQuery({
    queryKey: ['my-teams', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_teams' as never);
      if (error) throw error;
      return (data ?? []) as unknown as MyTeam[];
    },
  });

  const { activeId, mustAsk } = useMemo(() => resolveActive(myTeams, storedId), [myTeams, storedId]);
  const activeTeam = myTeams.find((t) => t.id === activeId) ?? null;
  const ctx = useMemo(() => contextTeamIds(myTeams, activeId), [myTeams, activeId]);
  const isPublicPage = pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const choose = (t: MyTeam) => {
    if (!user) return;
    const previousClub = activeTeam ? activeTeam.club_id : undefined;
    write(teamKey(user.id), t.id);
    write(activeClubKey(user.id), t.club_id ?? OWN);
    setStoredId(t.id);
    setOpen(false);
    // another club (or from a club to own teams): role and menus depend on it → start clean
    if (previousClub !== undefined && previousClub !== t.club_id) window.location.reload();
  };

  // remember the club of an automatic choice too (single team)
  useEffect(() => {
    if (user && activeTeam && read(activeClubKey(user.id)) !== (activeTeam.club_id ?? OWN)) write(activeClubKey(user.id), activeTeam.club_id ?? OWN);
  }, [user, activeTeam]);

  const scopeTeams = useCallback(<T extends { id: string }>(list: T[]) => scopeToContext(list, ctx), [ctx]);
  const defaultTeamId = useCallback(<T extends { id: string }>(list: T[]) =>
    (activeId && list.some((t) => t.id === activeId) ? activeId : list[0]?.id ?? null), [activeId]);
  const openChooser = useCallback(() => setOpen(true), []);

  const value: Ctx = { myTeams, activeTeam, activeTeamId: activeId, scopeTeams, defaultTeamId, openChooser };
  const show = !!user && isSuccess && !isPublicPage && (open || mustAsk);
  const groups = groupTeams(myTeams);

  return (
    <ActiveTeamContext.Provider value={value}>
      {children}
      <Dialog open={show} onOpenChange={(v) => { if (!v && !mustAsk) setOpen(false); }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" onInteractOutside={(e) => { if (mustAsk) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Com que equipa vai trabalhar?</DialogTitle>
            <DialogDescription>
              Os jogos, treinos e convocatórias ficam só com as equipas {groups.length > 1 ? 'desse clube' : 'escolhidas'}. Pode trocar a qualquer momento no topo do ecrã.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.clubId ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}{g.label}
                </p>
                <div className="space-y-1.5">
                  {g.teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => choose(t)}
                      className={cn('flex w-full items-center gap-3 rounded-md border p-3 text-left transition hover:border-primary hover:bg-primary/5', t.id === activeId && 'border-primary bg-primary/5')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{[t.category, ROLE_LABEL[t.my_role] ?? t.my_role].filter(Boolean).join(' · ')}</span>
                      </span>
                      {t.id === activeId ? <Check className="h-4 w-4 text-primary" /> : <Badge variant="outline">Escolher</Badge>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </ActiveTeamContext.Provider>
  );
}

export const useActiveTeam = () => useContext(ActiveTeamContext);
