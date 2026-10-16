-- Medical department, part 1: one injury record for everybody, the clinical part kept apart.
--
--   * The club names its doctor ("medico") and physiotherapist ("physio").
--   * player_injuries stays the single injury record (the call-up already reads it):
--     what happened, where, how, availability (apto / condicionado / inapto …), restrictions,
--     expected return. Coaches, the club's medical staff and the club's leadership see it;
--     parents see their own child's.
--   * Diagnosis, treatment and clinical notes are health data (GDPR art. 9): they live in
--     player_injury_clinical, readable only by the club's doctor and physio (a coach without a
--     club is his own medical staff). Whatever is typed in those fields is moved there.

ALTER TYPE public.club_staff_role ADD VALUE IF NOT EXISTS 'medico';

ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS mechanism text
  CHECK (mechanism IS NULL OR mechanism IN ('contact', 'non_contact', 'overuse', 'unknown'));
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL;
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS reported_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS assessed_at timestamptz;
ALTER TABLE public.player_injuries ADD COLUMN IF NOT EXISTS assessed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── who is who ──
CREATE OR REPLACE FUNCTION public.is_medical_staff(_user uuid, _club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND _club IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.club_staff s
     WHERE s.club_id = _club AND s.user_id = _user AND s.is_active AND s.role::text IN ('physio', 'medico'))
$$;
REVOKE ALL ON FUNCTION public.is_medical_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_medical_staff(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.player_club(_player uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.club_id FROM public.players p JOIN public.teams t ON t.id = p.team_id WHERE p.id = _player
$$;
REVOKE ALL ON FUNCTION public.player_club(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_club(uuid) TO authenticated;

-- the diagnosis: the club's medical staff; without a club, the team's own coaches
CREATE OR REPLACE FUNCTION public.can_see_injury_clinical(_user uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND coalesce((
    SELECT CASE WHEN t.club_id IS NOT NULL THEN public.is_medical_staff(_user, t.club_id)
                ELSE (p.owner_id = _user OR public.can_coach_team(_user, t.id)) END
      FROM public.players p LEFT JOIN public.teams t ON t.id = p.team_id WHERE p.id = _player), false)
$$;
REVOKE ALL ON FUNCTION public.can_see_injury_clinical(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_injury_clinical(uuid, uuid) TO authenticated;

-- ── the injury record: medical staff work on it, leadership and parents read it ──
DROP POLICY IF EXISTS "Medical staff manage club injuries" ON public.player_injuries;
CREATE POLICY "Medical staff manage club injuries" ON public.player_injuries FOR ALL TO authenticated
  USING (public.is_medical_staff(auth.uid(), public.player_club(player_id)))
  WITH CHECK (public.is_medical_staff(auth.uid(), public.player_club(player_id)));
DROP POLICY IF EXISTS "Club leadership reads injuries" ON public.player_injuries;
CREATE POLICY "Club leadership reads injuries" ON public.player_injuries FOR SELECT TO authenticated
  USING (public.player_club(player_id) IS NOT NULL AND (
    public.is_club_admin(auth.uid(), public.player_club(player_id))
    OR public.is_youth_coordinator(public.player_club(player_id), auth.uid())));
DROP POLICY IF EXISTS "Team staff manage injuries" ON public.player_injuries;
CREATE POLICY "Team staff manage injuries" ON public.player_injuries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND public.can_coach_team(auth.uid(), p.team_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND public.can_coach_team(auth.uid(), p.team_id)));
DROP POLICY IF EXISTS "Guardians read their child's injuries" ON public.player_injuries;
CREATE POLICY "Guardians read their child's injuries" ON public.player_injuries FOR SELECT TO authenticated
  USING (public.is_guardian_of_player(auth.uid(), player_id));

-- ── the clinical part ──
CREATE TABLE IF NOT EXISTS public.player_injury_clinical (
  injury_id uuid PRIMARY KEY REFERENCES public.player_injuries(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  diagnosis text CHECK (diagnosis IS NULL OR char_length(diagnosis) <= 2000),
  treatment text CHECK (treatment IS NULL OR char_length(treatment) <= 4000),
  treatment_plan text CHECK (treatment_plan IS NULL OR char_length(treatment_plan) <= 8000),
  clinical_notes text CHECK (clinical_notes IS NULL OR char_length(clinical_notes) <= 8000),
  responsible_professional text CHECK (responsible_professional IS NULL OR char_length(responsible_professional) <= 200),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_injury_clinical ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_read" ON public.player_injury_clinical;
CREATE POLICY "clinical_read" ON public.player_injury_clinical FOR SELECT TO authenticated
  USING (public.can_see_injury_clinical(auth.uid(), player_id));
DROP POLICY IF EXISTS "clinical_write" ON public.player_injury_clinical;
CREATE POLICY "clinical_write" ON public.player_injury_clinical FOR ALL TO authenticated
  USING (public.can_see_injury_clinical(auth.uid(), player_id))
  WITH CHECK (public.can_see_injury_clinical(auth.uid(), player_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_injury_clinical TO authenticated;
REVOKE ALL ON public.player_injury_clinical FROM anon;

-- whatever arrives in the clinical columns of the injury goes to the clinical table
-- (a club coach may write what the doctor told him, but does not read it back)
CREATE OR REPLACE FUNCTION public.player_injuries_store_clinical()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.diagnosis, NEW.treatment, NEW.treatment_plan, NEW.clinical_notes, NEW.responsible_professional) IS NOT NULL THEN
    INSERT INTO public.player_injury_clinical (injury_id, player_id, diagnosis, treatment, treatment_plan, clinical_notes, responsible_professional, updated_by, updated_at)
    VALUES (NEW.id, NEW.player_id, NEW.diagnosis, NEW.treatment, NEW.treatment_plan, NEW.clinical_notes, NEW.responsible_professional, auth.uid(), now())
    ON CONFLICT (injury_id) DO UPDATE SET
      diagnosis = EXCLUDED.diagnosis, treatment = EXCLUDED.treatment, treatment_plan = EXCLUDED.treatment_plan,
      clinical_notes = EXCLUDED.clinical_notes, responsible_professional = EXCLUDED.responsible_professional,
      updated_by = EXCLUDED.updated_by, updated_at = now();
    UPDATE public.player_injuries SET diagnosis = NULL, treatment = NULL, treatment_plan = NULL, clinical_notes = NULL, responsible_professional = NULL
     WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS player_injuries_store_clinical ON public.player_injuries;
CREATE TRIGGER player_injuries_store_clinical AFTER INSERT OR UPDATE OF diagnosis, treatment, treatment_plan, clinical_notes, responsible_professional ON public.player_injuries
  FOR EACH ROW WHEN (coalesce(NEW.diagnosis, NEW.treatment, NEW.treatment_plan, NEW.clinical_notes, NEW.responsible_professional) IS NOT NULL)
  EXECUTE FUNCTION public.player_injuries_store_clinical();

-- ── the club names its doctor and physio (people who already have an account) ──
CREATE OR REPLACE FUNCTION public.set_medical_staff(_club uuid, _email text, _role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid;
  person text;
BEGIN
  IF NOT public.is_club_admin(auth.uid(), _club) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF _role NOT IN ('physio', 'medico', 'none') THEN RAISE EXCEPTION 'Função inválida'; END IF;
  SELECT u.id INTO target FROM auth.users u WHERE lower(u.email) = lower(trim(_email));
  IF target IS NULL THEN RAISE EXCEPTION 'Não existe nenhuma conta com o email %. A pessoa tem de criar primeiro a conta na TreinON.', trim(_email) USING ERRCODE = 'P0002'; END IF;
  IF target = (SELECT owner_id FROM public.clubs WHERE id = _club) THEN RAISE EXCEPTION 'O dono do clube já é administrador'; END IF;
  SELECT coalesce(p.display_name, p.full_name, trim(_email)) INTO person FROM public.profiles p WHERE p.id = target;
  IF _role = 'none' THEN
    UPDATE public.club_staff SET is_active = false WHERE club_id = _club AND user_id = target AND role::text IN ('physio', 'medico');
    RETURN coalesce(person, trim(_email));
  END IF;
  INSERT INTO public.club_staff (club_id, user_id, name, email, role, is_active)
  VALUES (_club, target, coalesce(person, trim(_email)), lower(trim(_email)), _role::public.club_staff_role, true)
  ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true
  WHERE public.club_staff.role::text <> 'admin';
  RETURN coalesce(person, trim(_email));
END $$;
REVOKE ALL ON FUNCTION public.set_medical_staff(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_medical_staff(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.club_medical_staff(_club uuid)
RETURNS TABLE (user_id uuid, name text, email text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, s.name::text, s.email::text, s.role::text FROM public.club_staff s
   WHERE s.club_id = _club AND s.is_active AND s.role::text IN ('physio', 'medico')
     AND (public.is_club_admin(auth.uid(), _club) OR public.is_club_staff_member(_club, auth.uid()) OR public.is_club_coach(auth.uid(), _club))
   ORDER BY s.role, s.name
$$;
REVOKE ALL ON FUNCTION public.club_medical_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_medical_staff(uuid) TO authenticated;
