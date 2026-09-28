
-- =====================================================================
-- ÉPOCAS DESPORTIVAS — Foundational schema
-- =====================================================================

-- 1.1 Extend seasons
DO $$ BEGIN
  CREATE TYPE public.season_status AS ENUM ('planning','active','closed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS status public.season_status NOT NULL DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS reference_date date,
  ADD COLUMN IF NOT EXISTS notes text;

-- backfill status from is_active/is_planning
UPDATE public.seasons SET status = 'active' WHERE is_active = true AND status = 'planning';
UPDATE public.seasons SET status = 'planning' WHERE is_planning = true AND is_active = false AND status = 'planning';

-- Make club_id nullable for individual coaches (use owner_id only)
ALTER TABLE public.seasons ALTER COLUMN club_id DROP NOT NULL;

-- Unique active season per scope
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active_per_club
  ON public.seasons(club_id) WHERE is_active = true AND club_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active_per_owner
  ON public.seasons(owner_id) WHERE is_active = true AND club_id IS NULL;

-- 1.2 New tables
CREATE TABLE IF NOT EXISTS public.season_team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  age_group_id uuid REFERENCES public.academy_age_groups(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, team_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_team_memberships TO authenticated;
GRANT ALL ON public.season_team_memberships TO service_role;
ALTER TABLE public.season_team_memberships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS stm_season ON public.season_team_memberships(season_id);
CREATE INDEX IF NOT EXISTS stm_team ON public.season_team_memberships(team_id);

CREATE TABLE IF NOT EXISTS public.season_player_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  age_group_id uuid REFERENCES public.academy_age_groups(id),
  position text,
  shirt_number int,
  status text NOT NULL DEFAULT 'active', -- active|injured|loaned_out|left|prospect
  joined_at date,
  left_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_player_enrollments TO authenticated;
GRANT ALL ON public.season_player_enrollments TO service_role;
ALTER TABLE public.season_player_enrollments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS spe_season ON public.season_player_enrollments(season_id);
CREATE INDEX IF NOT EXISTS spe_player ON public.season_player_enrollments(player_id);
CREATE INDEX IF NOT EXISTS spe_team ON public.season_player_enrollments(team_id);

DO $$ BEGIN
  CREATE TYPE public.season_transition_mode AS ENUM ('club_auto','coach_manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.season_transition_status AS ENUM ('draft','previewed','applied','rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.season_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_season_id uuid NOT NULL REFERENCES public.seasons(id),
  to_season_id uuid NOT NULL REFERENCES public.seasons(id),
  mode public.season_transition_mode NOT NULL,
  reference_date date NOT NULL,
  triggered_by uuid,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  status public.season_transition_status NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_transitions TO authenticated;
GRANT ALL ON public.season_transitions TO service_role;
ALTER TABLE public.season_transitions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS st_from ON public.season_transitions(from_season_id);
CREATE INDEX IF NOT EXISTS st_to ON public.season_transitions(to_season_id);

-- updated_at triggers (uses existing update_updated_at_column)
DROP TRIGGER IF EXISTS trg_stm_updated_at ON public.season_team_memberships;
CREATE TRIGGER trg_stm_updated_at BEFORE UPDATE ON public.season_team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_spe_updated_at ON public.season_player_enrollments;
CREATE TRIGGER trg_spe_updated_at BEFORE UPDATE ON public.season_player_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_st_updated_at ON public.season_transitions;
CREATE TRIGGER trg_st_updated_at BEFORE UPDATE ON public.season_transitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.3 Add season_id to operational tables
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'teams','matches','match_lineups','match_events','match_rule_snapshots','match_conflict_alerts',
  'training_sessions','training_attendance','training_load','player_evaluations','player_season_snapshots',
  'player_injuries','communication_channels','communication_announcements','asset_items','athlete_kit_assignments',
  'charges','fee_assignments','fee_plans','expense_claims','purchase_orders','purchase_requests','budget_lines',
  'stock_movements','team_equipment_allocations','scouting_shortlists','scouting_watchlists','recruitment_needs',
  'prospect_profiles','academy_assessment_cycles','academy_compliance_items','academy_development_plans',
  'academy_player_profiles','academy_player_school_records','academy_programs','academy_promotion_reviews',
  'academy_staff_assignments'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(season_id)', t||'_season_id_idx', t);
  END LOOP;
END $$;

-- 1.4 Immutability triggers
CREATE OR REPLACE FUNCTION public.prevent_archived_season_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_season_id uuid;
  v_status public.season_status;
BEGIN
  IF current_setting('app.allow_archived_write', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    v_season_id := OLD.season_id;
  ELSE
    v_season_id := NEW.season_id;
  END IF;
  IF v_season_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status INTO v_status FROM public.seasons WHERE id = v_season_id;
  IF v_status = 'archived' THEN
    RAISE EXCEPTION 'Season % is archived; writes are not allowed', v_season_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.prevent_season_id_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.season_id IS DISTINCT FROM NEW.season_id
     AND OLD.season_id IS NOT NULL
     AND current_setting('app.allow_season_reassign', true) <> 'true' THEN
    RAISE EXCEPTION 'Changing season_id is not allowed (% -> %)', OLD.season_id, NEW.season_id;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'teams','matches','match_lineups','match_events','match_rule_snapshots','match_conflict_alerts',
  'training_sessions','training_attendance','training_load','player_evaluations','player_season_snapshots',
  'player_injuries','communication_channels','communication_announcements','asset_items','athlete_kit_assignments',
  'charges','fee_assignments','fee_plans','expense_claims','purchase_orders','purchase_requests','budget_lines',
  'stock_movements','team_equipment_allocations','scouting_shortlists','scouting_watchlists','recruitment_needs',
  'prospect_profiles','academy_assessment_cycles','academy_compliance_items','academy_development_plans',
  'academy_player_profiles','academy_player_school_records','academy_programs','academy_promotion_reviews',
  'academy_staff_assignments','season_player_enrollments','season_team_memberships'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_archived_write ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_archived_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_writes()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_season_change ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_season_change BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_season_id_change()', t, t);
  END LOOP;
END $$;

-- 1.5 RLS policies for new tables — scoped by season ownership
CREATE OR REPLACE FUNCTION public.user_can_access_season(_user_id uuid, _season_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seasons s
    WHERE s.id = _season_id
      AND (
        s.owner_id = _user_id
        OR (s.club_id IS NOT NULL AND public.is_club_staff_member(s.club_id, _user_id))
        OR (s.club_id IS NOT NULL AND public.is_club_coach(_user_id, s.club_id))
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.user_can_access_season(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_season(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_can_manage_season(_user_id uuid, _season_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seasons s
    WHERE s.id = _season_id
      AND (
        s.owner_id = _user_id
        OR (s.club_id IS NOT NULL AND public.is_club_admin(_user_id, s.club_id))
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.user_can_manage_season(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_season(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS stm_select ON public.season_team_memberships;
CREATE POLICY stm_select ON public.season_team_memberships FOR SELECT TO authenticated
  USING (public.user_can_access_season(auth.uid(), season_id));
DROP POLICY IF EXISTS stm_write ON public.season_team_memberships;
CREATE POLICY stm_write ON public.season_team_memberships FOR ALL TO authenticated
  USING (public.user_can_manage_season(auth.uid(), season_id))
  WITH CHECK (public.user_can_manage_season(auth.uid(), season_id));

DROP POLICY IF EXISTS spe_select ON public.season_player_enrollments;
CREATE POLICY spe_select ON public.season_player_enrollments FOR SELECT TO authenticated
  USING (public.user_can_access_season(auth.uid(), season_id));
DROP POLICY IF EXISTS spe_write ON public.season_player_enrollments;
CREATE POLICY spe_write ON public.season_player_enrollments FOR ALL TO authenticated
  USING (public.user_can_manage_season(auth.uid(), season_id))
  WITH CHECK (public.user_can_manage_season(auth.uid(), season_id));

DROP POLICY IF EXISTS st_select ON public.season_transitions;
CREATE POLICY st_select ON public.season_transitions FOR SELECT TO authenticated
  USING (public.user_can_access_season(auth.uid(), from_season_id)
      OR public.user_can_access_season(auth.uid(), to_season_id));
DROP POLICY IF EXISTS st_write ON public.season_transitions;
CREATE POLICY st_write ON public.season_transitions FOR ALL TO authenticated
  USING (public.user_can_manage_season(auth.uid(), to_season_id))
  WITH CHECK (public.user_can_manage_season(auth.uid(), to_season_id));

-- 1.6 RPCs
CREATE OR REPLACE FUNCTION public.close_season(p_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_can_manage_season(auth.uid(), p_season_id) THEN
    RAISE EXCEPTION 'Not authorized to close season %', p_season_id;
  END IF;
  UPDATE public.seasons
    SET status = 'closed', is_active = false, closed_at = now(), closed_by = auth.uid(), updated_at = now()
    WHERE id = p_season_id AND status IN ('active','planning');
END $$;
REVOKE EXECUTE ON FUNCTION public.close_season(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_season(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_season(p_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_can_manage_season(auth.uid(), p_season_id) THEN
    RAISE EXCEPTION 'Not authorized to archive season %', p_season_id;
  END IF;
  UPDATE public.seasons
    SET status = 'archived', is_active = false, archived_at = now(), updated_at = now()
    WHERE id = p_season_id AND status IN ('closed','active');
END $$;
REVOKE EXECUTE ON FUNCTION public.archive_season(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_season(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_season(p_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club uuid; v_owner uuid;
BEGIN
  IF NOT public.user_can_manage_season(auth.uid(), p_season_id) THEN
    RAISE EXCEPTION 'Not authorized to activate season %', p_season_id;
  END IF;
  SELECT club_id, owner_id INTO v_club, v_owner FROM public.seasons WHERE id = p_season_id;
  -- close currently active in same scope
  IF v_club IS NOT NULL THEN
    UPDATE public.seasons SET status = 'closed', is_active = false, closed_at = COALESCE(closed_at, now()), closed_by = COALESCE(closed_by, auth.uid())
      WHERE club_id = v_club AND id <> p_season_id AND is_active = true;
  ELSE
    UPDATE public.seasons SET status = 'closed', is_active = false, closed_at = COALESCE(closed_at, now()), closed_by = COALESCE(closed_by, auth.uid())
      WHERE owner_id = v_owner AND club_id IS NULL AND id <> p_season_id AND is_active = true;
  END IF;
  UPDATE public.seasons SET status = 'active', is_active = true, is_planning = false, updated_at = now()
    WHERE id = p_season_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.activate_season(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_season(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_season_transition(p_transition_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_to uuid; v_payload jsonb; v_status public.season_transition_status; v_count int := 0;
  v_item jsonb;
BEGIN
  SELECT to_season_id, payload, status INTO v_to, v_payload, v_status
    FROM public.season_transitions WHERE id = p_transition_id FOR UPDATE;
  IF v_to IS NULL THEN RAISE EXCEPTION 'Transition not found'; END IF;
  IF NOT public.user_can_manage_season(auth.uid(), v_to) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status = 'applied' THEN RAISE EXCEPTION 'Already applied'; END IF;

  -- payload.enrollments = [{player_id, team_id, age_group_id, position, shirt_number}]
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_payload->'enrollments','[]'::jsonb)) LOOP
    INSERT INTO public.season_player_enrollments(season_id, player_id, team_id, age_group_id, position, shirt_number, status, joined_at)
      VALUES (
        v_to,
        (v_item->>'player_id')::uuid,
        NULLIF(v_item->>'team_id','')::uuid,
        NULLIF(v_item->>'age_group_id','')::uuid,
        v_item->>'position',
        NULLIF(v_item->>'shirt_number','')::int,
        COALESCE(v_item->>'status','active'),
        CURRENT_DATE
      )
    ON CONFLICT (season_id, player_id) DO UPDATE
      SET team_id = EXCLUDED.team_id, age_group_id = EXCLUDED.age_group_id,
          position = EXCLUDED.position, shirt_number = EXCLUDED.shirt_number,
          status = EXCLUDED.status, updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.season_transitions
    SET status = 'applied', applied_at = now(), updated_at = now()
    WHERE id = p_transition_id;

  RETURN jsonb_build_object('enrolled', v_count);
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_season_transition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_season_transition(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rollback_season_transition(p_transition_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_to uuid; v_payload jsonb; v_item jsonb;
BEGIN
  SELECT to_season_id, payload INTO v_to, v_payload FROM public.season_transitions WHERE id = p_transition_id FOR UPDATE;
  IF NOT public.user_can_manage_season(auth.uid(), v_to) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_payload->'enrollments','[]'::jsonb)) LOOP
    DELETE FROM public.season_player_enrollments
      WHERE season_id = v_to AND player_id = (v_item->>'player_id')::uuid;
  END LOOP;
  UPDATE public.season_transitions SET status = 'rolled_back', rolled_back_at = now(), updated_at = now()
    WHERE id = p_transition_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.rollback_season_transition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollback_season_transition(uuid) TO authenticated;
