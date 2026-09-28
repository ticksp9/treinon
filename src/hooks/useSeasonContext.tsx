import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { getSeasonContext, listSeasons, type SeasonContext, type SeasonRow } from '@/lib/season-service';

const STORAGE_KEY = 'tf.selectedSeasonId';

export function useSeasonScope() {
  const { user } = useAuth();
  const role = useUserRole();
  return {
    user,
    role,
    scope: user ? { clubId: role.clubId ?? null, ownerId: user.id } : null,
  };
}

export function useSeasonContextQuery() {
  const { scope } = useSeasonScope();
  return useQuery<SeasonContext>({
    queryKey: ['season-context', scope?.clubId ?? 'solo', scope?.ownerId],
    enabled: !!scope,
    queryFn: () => getSeasonContext(scope!),
  });
}

export function useSeasonsList() {
  const { scope } = useSeasonScope();
  return useQuery<SeasonRow[]>({
    queryKey: ['seasons-list', scope?.clubId ?? 'solo', scope?.ownerId],
    enabled: !!scope,
    queryFn: () => listSeasons(scope!),
  });
}

interface SeasonContextValue {
  seasons: SeasonRow[];
  activeSeason: SeasonRow | null;
  selectedSeason: SeasonRow | null;
  selectedSeasonId: string | null;
  isViewingArchivedOrClosed: boolean;
  isReadOnly: boolean;
  loading: boolean;
  setSelectedSeason: (id: string | null) => void;
  refresh: () => void;
}

const Ctx = createContext<SeasonContextValue | null>(null);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: seasons = [], isLoading } = useSeasonsList();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const activeSeason = useMemo(() => seasons.find((s) => s.is_active) ?? null, [seasons]);

  // Default to the active season, and heal invalid stored ids.
  useEffect(() => {
    if (seasons.length === 0) return;
    if (!selectedId || !seasons.some((s) => s.id === selectedId)) {
      setSelectedId(activeSeason?.id ?? seasons[0].id);
    }
  }, [seasons, selectedId, activeSeason]);

  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === selectedId) ?? activeSeason,
    [seasons, selectedId, activeSeason],
  );

  function setSelectedSeason(id: string | null) {
    setSelectedId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // Season is part of most query keys; drop cached data so every screen refetches.
    qc.invalidateQueries();
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ['seasons-list'] });
    qc.invalidateQueries({ queryKey: ['season-context'] });
  }

  const isViewingArchivedOrClosed =
    !!selectedSeason && (selectedSeason.status === 'closed' || selectedSeason.status === 'archived');

  const value: SeasonContextValue = {
    seasons,
    activeSeason,
    selectedSeason: selectedSeason ?? null,
    selectedSeasonId: selectedSeason?.id ?? null,
    isViewingArchivedOrClosed,
    isReadOnly: isViewingArchivedOrClosed,
    loading: isLoading,
    setSelectedSeason,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Global season selection (ERP-style year selector). Safe outside the provider. */
export function useSeasonContext(): SeasonContextValue {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    seasons: [],
    activeSeason: null,
    selectedSeason: null,
    selectedSeasonId: null,
    isViewingArchivedOrClosed: false,
    isReadOnly: false,
    loading: false,
    setSelectedSeason: () => {},
    refresh: () => {},
  };
}

/** Convenience hook returning the active season id (or null). */
export function useActiveSeasonId(): string | null {
  const { data } = useSeasonContextQuery();
  return data?.activeSeasonId ?? null;
}

/** The season id all data reads should be scoped to (selected, not necessarily active). */
export function useSelectedSeasonId(): string | null {
  return useSeasonContext().selectedSeasonId;
}
