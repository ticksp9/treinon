-- "Vou / Não vou" on club and team events (dinners, activities), with how many people come.

CREATE TABLE IF NOT EXISTS public.club_event_rsvps (
  event_id uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('yes', 'no')),
  people integer NOT NULL DEFAULT 1 CHECK (people BETWEEN 1 AND 20),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- who reads everybody's answers: whoever published the event, the team's coaches, the club admin
CREATE OR REPLACE FUNCTION public.can_manage_event_rsvps(_user uuid, _event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_events e
     WHERE e.id = _event AND (
       e.owner_id = _user
       OR (e.team_id IS NOT NULL AND public.can_coach_team(_user, e.team_id))
       OR (e.club_id IS NOT NULL AND (public.is_club_admin(_user, e.club_id) OR public.is_youth_coordinator(e.club_id, _user)))))
$$;
REVOKE ALL ON FUNCTION public.can_manage_event_rsvps(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_event_rsvps(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_answer_event(_user uuid, _event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_events e
     WHERE e.id = _event AND public.can_see_club_event(_user, e.owner_id, e.club_id, e.team_id))
$$;
REVOKE ALL ON FUNCTION public.can_answer_event(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_answer_event(uuid, uuid) TO authenticated;

ALTER TABLE public.club_event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_rsvps_select" ON public.club_event_rsvps;
CREATE POLICY "event_rsvps_select" ON public.club_event_rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_event_rsvps(auth.uid(), event_id));

DROP POLICY IF EXISTS "event_rsvps_insert" ON public.club_event_rsvps;
CREATE POLICY "event_rsvps_insert" ON public.club_event_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_answer_event(auth.uid(), event_id));

DROP POLICY IF EXISTS "event_rsvps_update" ON public.club_event_rsvps;
CREATE POLICY "event_rsvps_update" ON public.club_event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.can_answer_event(auth.uid(), event_id));

DROP POLICY IF EXISTS "event_rsvps_delete" ON public.club_event_rsvps;
CREATE POLICY "event_rsvps_delete" ON public.club_event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_event_rsvps TO authenticated;

-- the answers with names, for whoever organises: "Ana Silva (mãe/pai de Rui) — vai, 3 pessoas"
CREATE OR REPLACE FUNCTION public.get_event_rsvps(_event uuid)
RETURNS TABLE (user_id uuid, name text, players text, status text, people integer, note text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.user_id,
         coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.full_name), ''), gp.full_name, 'Sem nome')::text,
         (SELECT string_agg(DISTINCT pl.name, ', ' ORDER BY pl.name)
            FROM public.players pl
           WHERE pl.id IN (SELECT pg.player_id FROM public.player_guardians pg
                             JOIN public.guardian_profiles g2 ON g2.id = pg.guardian_id WHERE g2.user_id = r.user_id)
              OR pl.id IN (SELECT pa.player_id FROM public.player_accounts pa WHERE pa.user_id = r.user_id))::text,
         r.status, r.people, r.note, r.updated_at
    FROM public.club_event_rsvps r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    LEFT JOIN LATERAL (SELECT g.full_name FROM public.guardian_profiles g WHERE g.user_id = r.user_id LIMIT 1) gp ON true
   WHERE r.event_id = _event AND public.can_manage_event_rsvps(auth.uid(), _event)
   ORDER BY r.status DESC, 2
$$;
REVOKE ALL ON FUNCTION public.get_event_rsvps(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_rsvps(uuid) TO authenticated;
