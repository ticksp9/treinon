-- Parents' consent (RGPD), per child:
--   * data processing — required to use the app for that child
--   * use of image (photos/videos of trainings and matches) — a separate, free choice
-- One row per parent and child; the version of the notice that was accepted is kept.

CREATE TABLE IF NOT EXISTS public.guardian_consents (
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version text NOT NULL,
  data_processing boolean NOT NULL DEFAULT false,
  data_processing_at timestamptz,
  image_use boolean,                 -- NULL = not answered yet
  image_use_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, user_id)
);
ALTER TABLE public.guardian_consents ENABLE ROW LEVEL SECURITY;

-- the coach needs to know if he may photograph the child; the club needs the proof of consent
CREATE OR REPLACE FUNCTION public.can_view_consent(_user uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_see_player_private(_user, _player)
      OR coalesce((SELECT public.can_coach_team(_user, p.team_id) FROM public.players p WHERE p.id = _player AND p.team_id IS NOT NULL), false)
$$;
REVOKE ALL ON FUNCTION public.can_view_consent(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_consent(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "consents_select" ON public.guardian_consents;
CREATE POLICY "consents_select" ON public.guardian_consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_view_consent(auth.uid(), player_id));

-- only a parent of that child gives or changes the consent, and only his own
DROP POLICY IF EXISTS "consents_insert" ON public.guardian_consents;
CREATE POLICY "consents_insert" ON public.guardian_consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_guardian_of_player(auth.uid(), player_id));
DROP POLICY IF EXISTS "consents_update" ON public.guardian_consents;
CREATE POLICY "consents_update" ON public.guardian_consents FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_guardian_of_player(auth.uid(), player_id));
GRANT SELECT, INSERT, UPDATE ON public.guardian_consents TO authenticated;

-- the dates are set by the database, not by the browser
CREATE OR REPLACE FUNCTION public.guardian_consents_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.data_processing_at := CASE WHEN NEW.data_processing THEN now() END;
    NEW.image_use_at := CASE WHEN NEW.image_use IS NOT NULL THEN now() END;
  ELSE
    IF NEW.data_processing IS DISTINCT FROM OLD.data_processing OR NEW.policy_version IS DISTINCT FROM OLD.policy_version THEN
      NEW.data_processing_at := CASE WHEN NEW.data_processing THEN now() END;
    ELSE
      NEW.data_processing_at := OLD.data_processing_at;
    END IF;
    IF NEW.image_use IS DISTINCT FROM OLD.image_use THEN
      NEW.image_use_at := CASE WHEN NEW.image_use IS NOT NULL THEN now() END;
    ELSE
      NEW.image_use_at := OLD.image_use_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guardian_consents_stamp ON public.guardian_consents;
CREATE TRIGGER guardian_consents_stamp BEFORE INSERT OR UPDATE ON public.guardian_consents
  FOR EACH ROW EXECUTE FUNCTION public.guardian_consents_stamp();

-- for the parent: each child, who holds the data, and what was already answered
CREATE OR REPLACE FUNCTION public.my_children_consents()
RETURNS TABLE (player_id uuid, player_name text, team_name text, club_name text,
               policy_version text, data_processing boolean, data_processing_at timestamptz, image_use boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name::text, t.name::text, c.name::text,
         gc.policy_version, coalesce(gc.data_processing, false), gc.data_processing_at, gc.image_use
    FROM public.player_guardians pg
    JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id AND gp.user_id = auth.uid()
    JOIN public.players p ON p.id = pg.player_id
    LEFT JOIN public.teams t ON t.id = p.team_id
    LEFT JOIN public.clubs c ON c.id = t.club_id
    LEFT JOIN public.guardian_consents gc ON gc.player_id = p.id AND gc.user_id = auth.uid()
   ORDER BY p.name
$$;
REVOKE ALL ON FUNCTION public.my_children_consents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_children_consents() TO authenticated;
