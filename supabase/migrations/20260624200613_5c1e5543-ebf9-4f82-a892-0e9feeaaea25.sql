
-- 1) Fix function search_path mutable
CREATE OR REPLACE FUNCTION public.touch_player_injuries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END
$$;

CREATE OR REPLACE FUNCTION public.validate_player_evaluation_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.context IS NOT NULL AND NEW.context NOT IN ('training','match','period','assessment','other') THEN
    RAISE EXCEPTION 'invalid context: %', NEW.context;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- 2) Recreate player_public_info as security_invoker view
DROP VIEW IF EXISTS public.player_public_info;
CREATE VIEW public.player_public_info
WITH (security_invoker = true) AS
SELECT id, name, number, "position", foot, height_cm, weight_kg, team_id, is_active, created_at, updated_at, owner_id
FROM public.players;

GRANT SELECT ON public.player_public_info TO authenticated;

-- 3) Drop redundant always-true service_role policies (service_role bypasses RLS)
DROP POLICY IF EXISTS service_update_txn ON public.payment_transactions;
DROP POLICY IF EXISTS service_insert_txn ON public.payment_transactions;
DROP POLICY IF EXISTS service_manage_intents ON public.payment_intents;
DROP POLICY IF EXISTS service_insert_events ON public.payment_events;
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.communication_notifications;

-- 4) Revoke execute on SECURITY DEFINER trigger / internal functions from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_new_message_update_channel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_player_injuries_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_player_evaluation_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_security_pin(uuid, text) FROM PUBLIC, anon, authenticated;

-- 5) Revoke execute from anon on RLS helper SECURITY DEFINER functions (keep authenticated for RLS evaluation)
REVOKE EXECUTE ON FUNCTION public.can_manage_channel(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_invite(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_template(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_post_to_channel(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_channel(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.club_can_accept_online_payments(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_club_payment_mode(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_coach_club_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_guardian_team_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_player_account_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_club_role(uuid, uuid, public.club_staff_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_physio_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_coach(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_financial_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_physio(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_staff_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_staff_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_guardian_of_charge(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_guardian_of_player(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_guardian_of_team_player(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_coach(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_youth_coordinator(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_staff_admin(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_manage_channel(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_invite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_template(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_post_to_channel(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_channel(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_can_accept_online_payments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_payment_mode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coach_club_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guardian_team_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_account_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_club_role(uuid, uuid, public.club_staff_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_physio_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_coach(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_financial_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_physio(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_staff_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_staff_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guardian_of_charge(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guardian_of_player(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_guardian_of_team_player(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_coach(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_youth_coordinator(uuid, uuid) TO authenticated;
