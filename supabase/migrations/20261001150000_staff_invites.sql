-- Invites for coaches, assistant coaches and club staff (not only guardians/players).
-- Before this, the manage-invites function accepted these types but the table
-- rejected them, so no coach could be invited by link/code.
ALTER TABLE public.access_invites DROP CONSTRAINT IF EXISTS access_invites_invite_type_check;
ALTER TABLE public.access_invites
  ADD CONSTRAINT access_invites_invite_type_check
  CHECK (invite_type IN ('guardian', 'player', 'coach', 'assistant_coach', 'staff'));

-- Role of a coach in a team: head coach or assistant
UPDATE public.team_coaches SET role = 'head_coach' WHERE role IS NULL OR role NOT IN ('head_coach', 'assistant_coach');
ALTER TABLE public.team_coaches DROP CONSTRAINT IF EXISTS team_coaches_role_check;
ALTER TABLE public.team_coaches
  ADD CONSTRAINT team_coaches_role_check CHECK (role IN ('head_coach', 'assistant_coach'));

-- Removing a coach from the club also removes their teams in that club
-- (team access must not survive leaving the club).
CREATE OR REPLACE FUNCTION public.club_coach_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.is_active AND NOT NEW.is_active) THEN
    DELETE FROM public.team_coaches tc
    USING public.teams t
    WHERE tc.team_id = t.id AND t.club_id = OLD.club_id AND tc.coach_id = OLD.coach_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS club_coach_removed ON public.club_coaches;
CREATE TRIGGER club_coach_removed AFTER DELETE OR UPDATE OF is_active ON public.club_coaches
  FOR EACH ROW EXECUTE FUNCTION public.club_coach_removed();

REVOKE EXECUTE ON FUNCTION public.club_coach_removed() FROM PUBLIC, anon, authenticated;
