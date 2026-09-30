-- Coaches' own exercises (same format as the TreinON library, optionally animated).
-- A coach can share an exercise with the rest of the club's technical staff.
CREATE TABLE IF NOT EXISTS public.coach_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  shared_with_club boolean NOT NULL DEFAULT false,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_drills_owner_idx ON public.coach_drills(owner_id);
CREATE INDEX IF NOT EXISTS coach_drills_club_idx ON public.coach_drills(club_id) WHERE shared_with_club;

ALTER TABLE public.coach_drills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_drills_owner_all ON public.coach_drills;
CREATE POLICY coach_drills_owner_all ON public.coach_drills
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND (club_id IS NULL
      OR public.is_club_staff_member(club_id, auth.uid())
      OR public.is_club_coach(auth.uid(), club_id))
  );

DROP POLICY IF EXISTS coach_drills_club_read ON public.coach_drills;
CREATE POLICY coach_drills_club_read ON public.coach_drills
  FOR SELECT TO authenticated
  USING (
    shared_with_club AND club_id IS NOT NULL
    AND (public.is_club_staff_member(club_id, auth.uid()) OR public.is_club_coach(auth.uid(), club_id))
  );

CREATE OR REPLACE FUNCTION public.coach_drills_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coach_drills_touch ON public.coach_drills;
CREATE TRIGGER coach_drills_touch BEFORE UPDATE ON public.coach_drills
  FOR EACH ROW EXECUTE FUNCTION public.coach_drills_touch();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_drills TO authenticated;
