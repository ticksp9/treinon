-- 1. Financial admin: remove coordenador
CREATE OR REPLACE FUNCTION public.is_club_financial_admin(_user_id uuid, _club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = _club_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id AND user_id = _user_id
      AND role = 'admin' AND is_active = true
  )
$function$;

-- 2. match_reports INSERT scoping
DROP POLICY IF EXISTS "Club staff and coaches can create match reports" ON public.match_reports;
CREATE POLICY "Club staff and coaches can create match reports"
ON public.match_reports FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    ((club_id IS NOT NULL) AND (public.is_club_staff_member(club_id, auth.uid()) OR public.is_club_coach(auth.uid(), club_id)))
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.teams t ON t.id = m.team_id
      WHERE m.id = match_reports.match_id
        AND (
          t.owner_id = auth.uid()
          OR public.is_team_coach(auth.uid(), t.id)
          OR (t.club_id IS NOT NULL AND (public.is_club_staff_member(t.club_id, auth.uid()) OR public.is_club_coach(auth.uid(), t.club_id)))
        )
    )
  )
);

-- 3. medical_exam_types: global rows only manageable server-side
CREATE OR REPLACE FUNCTION public.enforce_medical_exam_type_club()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.club_id IS NULL AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Tipos de exame globais só podem ser geridos pela administração do sistema';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_medical_exam_type_club() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_medical_exam_types_club ON public.medical_exam_types;
CREATE TRIGGER trg_medical_exam_types_club
BEFORE INSERT OR UPDATE ON public.medical_exam_types
FOR EACH ROW EXECUTE FUNCTION public.enforce_medical_exam_type_club();

DROP POLICY IF EXISTS medical_exam_types_select ON public.medical_exam_types;
CREATE POLICY medical_exam_types_select ON public.medical_exam_types
FOR SELECT TO authenticated
USING (
  (club_id IS NULL AND is_active = true)
  OR (club_id IS NOT NULL AND public.has_physio_access(club_id, auth.uid()))
);

-- 4. Views: security invoker
ALTER VIEW public.v_active_season_by_owner SET (security_invoker = true);
ALTER VIEW public.v_active_season_by_club SET (security_invoker = true);

-- 5. Fixed search_path on remaining function
ALTER FUNCTION public.prevent_season_id_change() SET search_path TO 'public';

-- 6. Revoke EXECUTE on internal-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.prevent_season_id_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_archived_season_inserts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_archived_season_writes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_restore_archived_record(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_template(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_channel(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.club_can_accept_online_payments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_club_payment_mode(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_coach_club_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_club_role(uuid, uuid, club_staff_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_club_physio(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_guardian_of_team_player(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_season_archived(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_active_season_id(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 7. Remove anon EXECUTE from client RPCs that require an authenticated user
REVOKE ALL ON FUNCTION public.apply_tactical_change(uuid, integer, integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_initial_formation(uuid, text, text, text, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_tactical_change(uuid, integer, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_initial_formation(uuid, text, text, text, jsonb, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_season_id(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_club_financial_admin(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.club_can_accept_online_payments(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_club_payment_mode(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_archived_record(text, uuid, jsonb) TO service_role;