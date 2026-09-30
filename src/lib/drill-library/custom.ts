/**
 * Coaches' own exercises: the same shape as library drills plus an optional
 * animation, stored in public.coach_drills (data jsonb).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import type { Drill } from './types';
import type { DrillAnimation } from './animation';

export type DrillSource = 'library' | 'mine' | 'club';

export interface AnyDrill extends Drill {
  anim?: DrillAnimation | null;
  source: DrillSource;
  /** coach_drills row (own or shared by the club) */
  rowId?: string;
  ownerId?: string;
  sharedWithClub?: boolean;
}

export function emptyDrill(): AnyDrill {
  return {
    id: 'new',
    name: '',
    category: 'passe',
    ages: [],
    players: { min: 4, max: 12 },
    minutes: 12,
    space: '20 × 20 m',
    equipment: ['bolas', 'cones'],
    intensity: 'media',
    objective: '',
    setup: '',
    howTo: [],
    coachingPoints: [],
    progressions: [],
    diagram: [],
    anim: null,
    source: 'mine',
  };
}

interface Row {
  id: string;
  owner_id: string;
  club_id: string | null;
  shared_with_club: boolean;
  name: string;
  data: Partial<Drill> & { anim?: DrillAnimation | null };
}

function rowToDrill(r: Row, me: string | undefined): AnyDrill {
  const base = emptyDrill();
  return {
    ...base,
    ...r.data,
    name: r.name,
    id: `custom-${r.id}`,
    rowId: r.id,
    ownerId: r.owner_id,
    sharedWithClub: r.shared_with_club,
    source: r.owner_id === me ? 'mine' : 'club',
  };
}

/** My exercises + the ones colleagues shared with the club. */
export function useCoachDrills() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['coach-drills', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('coach_drills')
        .select('id, owner_id, club_id, shared_with_club, name, data')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Row[]).map((r) => rowToDrill(r, user?.id));
    },
  });
}

export function useSaveCoachDrill() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ drill, clubId }: { drill: AnyDrill; clubId: string | null }) => {
      const { id: _id, rowId, ownerId: _o, source: _s, sharedWithClub, name, ...rest } = drill;
      const payload = {
        name: name.trim(),
        data: JSON.parse(JSON.stringify(rest)),
        shared_with_club: !!sharedWithClub && !!clubId,
        club_id: clubId,
      };
      const q = (supabase as any).from('coach_drills');
      const { data, error } = rowId
        ? await q.update(payload).eq('id', rowId).select('id').single()
        : await q.insert({ ...payload, owner_id: user!.id }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-drills'] }),
  });
}

export function useDeleteCoachDrill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await (supabase as any).from('coach_drills').delete().eq('id', rowId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-drills'] }),
  });
}

/** A library or club drill copied into "my exercises" (not yet saved). */
export function copyAsMine(d: AnyDrill): AnyDrill {
  return {
    ...JSON.parse(JSON.stringify(d)),
    id: 'new',
    rowId: undefined,
    ownerId: undefined,
    sharedWithClub: false,
    source: 'mine',
    name: d.source === 'mine' ? `${d.name} (cópia)` : d.name,
  };
}
