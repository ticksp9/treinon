-- =====================================================================
-- Seasons as first-class temporal partition — consolidation migration
-- Idempotent: safe to re-run. Completes prior partial work.
-- =====================================================================

-- ---------- 1. Missing enums ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='season_enrollment_status') THEN
    CREATE TYPE public.season_enrollment_status AS ENUM ('active','injured','loaned_out','left','prospect');
  END IF;
END $$;

-- ---------- 2. Extend seasons ----------
ALTER TABLE public.seasons ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS previous_season_id uuid REFERENCES public.seasons(id);

COMMENT ON COLUMN public.seasons.status IS 'Lifecycle state: planning|active|closed|archived';
COMMENT ON COLUMN public.seasons.reference_date IS 'Cut-off date used for age-group resolution on transitions';
COMMENT ON COLUMN public.seasons.archived_by IS 'User that archived this season (writes blocked afterwards)';
COMMENT ON COLUMN public.seasons.previous_season_id IS 'Optional link to the season this one succeeded';

-- Back-fill status / reference_date for legacy rows
UPDATE public.seasons SET status='active'  WHERE status IS NULL AND is_active = true;
UPDATE public.seasons SET status='planning' WHERE status IS NULL AND is_planning = true;
UPDATE public.seasons SET status='closed'  WHERE status IS NULL;
UPDATE public.seasons SET reference_date = start_date WHERE reference_date IS NULL;

-- Unique active season per scope (idempotent recreate)
DROP INDEX IF EXISTS public.seasons_one_active_per_owner_idx;
DROP INDEX IF EXISTS public.seasons_one_active_per_club_idx;
CREATE UNIQUE INDEX seasons_one_active_per_owner_idx
  ON public.seasons(owner_id) WHERE is_active = true AND club_id IS NULL;
CREATE UNIQUE INDEX seasons_one_active_per_club_idx
  ON public.seasons(club_id)  WHERE is_active = true AND club_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS seasons_status_idx       ON public.seasons(status);
CREATE INDEX IF NOT EXISTS seasons_owner_idx        ON public.seasons(owner_id);
CREATE INDEX IF NOT EXISTS seasons_club_idx         ON public.seasons(club_id);
CREATE INDEX IF NOT EXISTS seasons_window_idx       ON public.seasons(start_date, end_date);

-- ---------- 3. Promote enrollment status column if it exists as text ----------
DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='season_player_enrollments' AND column_name='status';
  IF v_type = 'text' THEN
    ALTER TABLE public.season_player_enrollments
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE public.season_enrollment_status
        USING (CASE WHEN status IN ('active','injured','loaned_out','left','prospect') THEN status ELSE 'active' END)::public.season_enrollment_status,
      ALTER COLUMN status SET DEFAULT 'active'::public.season_enrollment_status;
  END IF;
END $$;

-- ---------- 4. Add season_id to remaining operational tables ----------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'training_templates','kits','asset_documents','asset_maintenance_logs',
    'communication_messages','payment_intents','payments',
    'budget_cycles','budget_versions',
    'youth_teams','youth_team_players','youth_team_coaches','youth_age_groups',
    'championships','championship_teams','championship_results',
    'physio_sessions','physio_assessments','physio_daily_logs',
    'physio_injuries','physio_medical_documents',
    'rehab_plans','rehab_plan_exercises','rehab_programs','rehab_progress_logs',
    'return_to_play_decisions','wellness_checkins',
    'coach_history','coach_trainings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id)', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(season_id)', t||'_season_id_idx', t);
    END IF;
  END LOOP;
END $$;

-- ---------- 5. Conservative back-fill of season_id ----------
DO $$
DECLARE
  t text;
  has_season_text boolean;
  has_owner boolean;
  has_club boolean;
  has_team boolean;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name='season_id'
       AND table_name NOT IN ('seasons','season_team_memberships','season_player_enrollments','season_transitions')
  LOOP
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='season')   INTO has_season_text;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='owner_id') INTO has_owner;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='club_id')  INTO has_club;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='team_id')  INTO has_team;

    -- Pass 1: by legacy string "season" matching seasons.name in same owner/club scope
    IF has_season_text AND has_owner THEN
      EXECUTE format($f$
        UPDATE public.%I x SET season_id = s.id
          FROM public.seasons s
         WHERE x.season_id IS NULL AND x.season IS NOT NULL
           AND s.name = x.season AND s.owner_id = x.owner_id
      $f$, t);
    ELSIF has_season_text AND has_club THEN
      EXECUTE format($f$
        UPDATE public.%I x SET season_id = s.id
          FROM public.seasons s
         WHERE x.season_id IS NULL AND x.season IS NOT NULL
           AND s.name = x.season AND s.club_id = x.club_id
      $f$, t);
    ELSIF has_season_text AND has_team THEN
      EXECUTE format($f$
        UPDATE public.%I x SET season_id = s.id
          FROM public.seasons s
          JOIN public.teams tm ON tm.club_id = s.club_id
         WHERE x.season_id IS NULL AND x.season IS NOT NULL
           AND s.name = x.season AND tm.id = x.team_id
      $f$, t);
    END IF;

    -- Pass 2: fallback to active season
    IF has_owner THEN
      EXECUTE format($f$
        UPDATE public.%I x SET season_id = (
          SELECT id FROM public.seasons WHERE owner_id = x.owner_id AND is_active = true LIMIT 1
        ) WHERE x.season_id IS NULL
      $f$, t);
    END IF;
    IF has_club THEN
      EXECUTE format($f$
        UPDATE public.%I x SET season_id = (
          SELECT id FROM public.seasons WHERE club_id = x.club_id AND is_active = true LIMIT 1
        ) WHERE x.season_id IS NULL
      $f$, t);
    END IF;
    IF has_team THEN
      EXECUTE format($f$
        UPDATE public.%I x SET season_id = (
          SELECT s.id FROM public.seasons s JOIN public.teams tm ON tm.club_id = s.club_id
           WHERE tm.id = x.team_id AND s.is_active = true LIMIT 1
        ) WHERE x.season_id IS NULL
      $f$, t);
    END IF;
  END LOOP;
END $$;

-- ---------- 6. Block INSERT into archived seasons; attach triggers everywhere ----------
CREATE OR REPLACE FUNCTION public.is_season_archived(p_season_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.seasons WHERE id = p_season_id AND status = 'archived');
$$;

CREATE OR REPLACE FUNCTION public.prevent_archived_season_inserts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF current_setting('app.allow_archived_write', true) = 'true' THEN RETURN NEW; END IF;
  IF NEW.season_id IS NOT NULL AND public.is_season_archived(NEW.season_id) THEN
    RAISE EXCEPTION 'Season % is archived; inserts are not allowed', NEW.season_id
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  t text;
  has_trg_w boolean;
  has_trg_c boolean;
  has_trg_i boolean;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name='season_id'
       AND table_name <> 'seasons'
  LOOP
    SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_'||t||'_block_archived_w') INTO has_trg_w;
    SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_'||t||'_block_season_change') INTO has_trg_c;
    SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_'||t||'_block_archived_i') INTO has_trg_i;

    IF NOT has_trg_w THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_writes()',
        'trg_'||t||'_block_archived_w', t);
    END IF;
    IF NOT has_trg_c THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_season_id_change()',
        'trg_'||t||'_block_season_change', t);
    END IF;
    IF NOT has_trg_i THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_inserts()',
        'trg_'||t||'_block_archived_i', t);
    END IF;
  END LOOP;
END $$;

-- ---------- 7. Admin restore helper ----------
CREATE OR REPLACE FUNCTION public.admin_restore_archived_record(p_table text, p_row_id uuid, p_patch jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_is_admin boolean;
  v_set text := '';
  k text;
  v jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can restore archived records';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_table) THEN
    RAISE EXCEPTION 'Unknown table %', p_table;
  END IF;
  PERFORM set_config('app.allow_archived_write','true', true);
  PERFORM set_config('app.allow_season_reassign','true', true);
  IF p_patch IS NOT NULL AND p_patch <> '{}'::jsonb THEN
    FOR k, v IN SELECT * FROM jsonb_each(p_patch) LOOP
      v_set := v_set || format('%I = %L,', k, v#>>'{}');
    END LOOP;
    v_set := rtrim(v_set, ',');
    EXECUTE format('UPDATE public.%I SET %s WHERE id = %L', p_table, v_set, p_row_id);
  END IF;
  PERFORM set_config('app.allow_archived_write','false', true);
  PERFORM set_config('app.allow_season_reassign','false', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_restore_archived_record(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_archived_record(text, uuid, jsonb) TO authenticated;

-- ---------- 8. Helper views & active-season function ----------
CREATE OR REPLACE VIEW public.v_active_season_by_owner AS
  SELECT owner_id, id AS season_id, name, start_date, end_date, reference_date
    FROM public.seasons WHERE is_active = true AND club_id IS NULL;

CREATE OR REPLACE VIEW public.v_active_season_by_club AS
  SELECT club_id, id AS season_id, name, start_date, end_date, reference_date
    FROM public.seasons WHERE is_active = true AND club_id IS NOT NULL;

GRANT SELECT ON public.v_active_season_by_owner TO authenticated;
GRANT SELECT ON public.v_active_season_by_club  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_season_id(p_owner uuid, p_club uuid DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT id FROM public.seasons
   WHERE is_active = true
     AND ((p_club IS NOT NULL AND club_id = p_club) OR (p_club IS NULL AND club_id IS NULL AND owner_id = p_owner))
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_season_id(uuid, uuid) TO authenticated;
