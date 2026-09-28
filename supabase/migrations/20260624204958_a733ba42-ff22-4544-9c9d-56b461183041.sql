-- =====================================================================
-- MATCH TACTICS: formations, player positions, tactical changes
-- =====================================================================

-- ---------- match_formations -----------------------------------------
CREATE TABLE IF NOT EXISTS public.match_formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id),
  formation_code text NOT NULL,
  formation_name text,
  sport_type text NOT NULL,
  slots jsonb NOT NULL,
  starts_at_minute_abs integer NOT NULL DEFAULT 0,
  ends_at_minute_abs integer,
  part_index integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_formations_match ON public.match_formations(match_id);
CREATE INDEX IF NOT EXISTS idx_match_formations_season ON public.match_formations(season_id);
CREATE INDEX IF NOT EXISTS idx_match_formations_start ON public.match_formations(match_id, starts_at_minute_abs);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_formations TO authenticated;
GRANT ALL ON public.match_formations TO service_role;

ALTER TABLE public.match_formations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_formations_select" ON public.match_formations;
CREATE POLICY "match_formations_select" ON public.match_formations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )));

DROP POLICY IF EXISTS "match_formations_write" ON public.match_formations;
CREATE POLICY "match_formations_write" ON public.match_formations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )));

DROP TRIGGER IF EXISTS update_match_formations_updated_at ON public.match_formations;
CREATE TRIGGER update_match_formations_updated_at
  BEFORE UPDATE ON public.match_formations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS prevent_archived_match_formations_upd ON public.match_formations;
CREATE TRIGGER prevent_archived_match_formations_upd
  BEFORE UPDATE OR DELETE ON public.match_formations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_writes();

DROP TRIGGER IF EXISTS prevent_archived_match_formations_ins ON public.match_formations;
CREATE TRIGGER prevent_archived_match_formations_ins
  BEFORE INSERT ON public.match_formations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_inserts();

DROP TRIGGER IF EXISTS prevent_match_formations_season_change ON public.match_formations;
CREATE TRIGGER prevent_match_formations_season_change
  BEFORE UPDATE ON public.match_formations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_season_id_change();

-- ---------- match_player_positions -----------------------------------
CREATE TABLE IF NOT EXISTS public.match_player_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  formation_id uuid REFERENCES public.match_formations(id) ON DELETE SET NULL,
  slot_id text NOT NULL,
  role text,
  starts_at_minute_abs integer NOT NULL,
  ends_at_minute_abs integer,
  part_index integer NOT NULL DEFAULT 1,
  source text NOT NULL CHECK (source IN (
    'initial_lineup','substitution_in','tactical_move','halftime_snapshot','formation_change'
  )),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpp_match_player ON public.match_player_positions(match_id, player_id);
CREATE INDEX IF NOT EXISTS idx_mpp_formation ON public.match_player_positions(formation_id);
CREATE INDEX IF NOT EXISTS idx_mpp_slot ON public.match_player_positions(match_id, slot_id);
CREATE INDEX IF NOT EXISTS idx_mpp_start ON public.match_player_positions(match_id, starts_at_minute_abs);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_player_positions TO authenticated;
GRANT ALL ON public.match_player_positions TO service_role;

ALTER TABLE public.match_player_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mpp_select" ON public.match_player_positions;
CREATE POLICY "mpp_select" ON public.match_player_positions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )));

DROP POLICY IF EXISTS "mpp_write" ON public.match_player_positions;
CREATE POLICY "mpp_write" ON public.match_player_positions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )));

DROP TRIGGER IF EXISTS update_mpp_updated_at ON public.match_player_positions;
CREATE TRIGGER update_mpp_updated_at
  BEFORE UPDATE ON public.match_player_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS prevent_archived_mpp_upd ON public.match_player_positions;
CREATE TRIGGER prevent_archived_mpp_upd
  BEFORE UPDATE OR DELETE ON public.match_player_positions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_writes();

DROP TRIGGER IF EXISTS prevent_archived_mpp_ins ON public.match_player_positions;
CREATE TRIGGER prevent_archived_mpp_ins
  BEFORE INSERT ON public.match_player_positions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_inserts();

DROP TRIGGER IF EXISTS prevent_mpp_season_change ON public.match_player_positions;
CREATE TRIGGER prevent_mpp_season_change
  BEFORE UPDATE ON public.match_player_positions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_season_id_change();

-- ---------- match_tactical_changes -----------------------------------
CREATE TABLE IF NOT EXISTS public.match_tactical_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id),
  part_index integer,
  minute_abs integer NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('formation_change','player_move','substitution_to_slot')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mtc_match_minute ON public.match_tactical_changes(match_id, minute_abs);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_tactical_changes TO authenticated;
GRANT ALL ON public.match_tactical_changes TO service_role;

ALTER TABLE public.match_tactical_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mtc_select" ON public.match_tactical_changes;
CREATE POLICY "mtc_select" ON public.match_tactical_changes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )));

DROP POLICY IF EXISTS "mtc_write" ON public.match_tactical_changes;
CREATE POLICY "mtc_write" ON public.match_tactical_changes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (
    m.owner_id = auth.uid()
    OR (m.team_id IS NOT NULL AND public.is_team_coach(auth.uid(), m.team_id))
  )));

DROP TRIGGER IF EXISTS prevent_archived_mtc_ins ON public.match_tactical_changes;
CREATE TRIGGER prevent_archived_mtc_ins
  BEFORE INSERT ON public.match_tactical_changes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_season_inserts();

-- ---------- Extend commit_substitution_batch to accept destination slot
-- Backwards compatible: each pair may include { out, in, slot_id?, role?, part_index?, formation_id? }
CREATE OR REPLACE FUNCTION public.commit_substitution_batch(
  p_match_id uuid,
  p_owner_id uuid,
  p_minute integer,
  p_second_base integer,
  p_subs jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_idx int := 0;
  v_pair jsonb;
  v_out_player uuid;
  v_in_player uuid;
  v_out_lineup_id uuid;
  v_in_lineup_id uuid;
  v_event_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_slot_id text;
  v_role text;
  v_part int;
  v_formation_id uuid;
  v_season_id uuid;
  v_out_slot text;
  v_out_role text;
  v_out_formation_id uuid;
  v_out_part int;
  v_out_pos_id uuid;
BEGIN
  IF jsonb_typeof(p_subs) <> 'array' THEN
    RAISE EXCEPTION 'p_subs must be a jsonb array';
  END IF;

  SELECT season_id INTO v_season_id FROM public.matches WHERE id = p_match_id;

  FOR v_pair IN SELECT * FROM jsonb_array_elements(p_subs) LOOP
    v_out_player := (v_pair->>'out')::uuid;
    v_in_player  := (v_pair->>'in')::uuid;
    v_slot_id    := NULLIF(v_pair->>'slot_id','');
    v_role       := NULLIF(v_pair->>'role','');
    v_part       := COALESCE(NULLIF(v_pair->>'part_index','')::int, 1);
    v_formation_id := NULLIF(v_pair->>'formation_id','')::uuid;

    SELECT id INTO v_out_lineup_id
      FROM public.match_lineups
     WHERE match_id = p_match_id AND player_id = v_out_player AND is_starter = true
     FOR UPDATE;
    IF v_out_lineup_id IS NULL THEN
      RAISE EXCEPTION 'OUT player % not on field for match %', v_out_player, p_match_id;
    END IF;

    SELECT id INTO v_in_lineup_id
      FROM public.match_lineups
     WHERE match_id = p_match_id AND player_id = v_in_player AND is_starter = false
     FOR UPDATE;
    IF v_in_lineup_id IS NULL THEN
      RAISE EXCEPTION 'IN player % not available for match %', v_in_player, p_match_id;
    END IF;

    UPDATE public.match_lineups SET is_starter = false WHERE id = v_out_lineup_id;
    UPDATE public.match_lineups SET is_starter = true  WHERE id = v_in_lineup_id;

    INSERT INTO public.match_events(match_id, event_type, minute, second, player_id, is_opponent, owner_id)
      VALUES (p_match_id, 'substitution_out', p_minute, p_second_base + v_idx*2,     v_out_player, false, p_owner_id)
      RETURNING id INTO v_id;
    v_event_ids := v_event_ids || v_id;

    INSERT INTO public.match_events(match_id, event_type, minute, second, player_id, is_opponent, owner_id)
      VALUES (p_match_id, 'substitution_in',  p_minute, p_second_base + v_idx*2 + 1, v_in_player,  false, p_owner_id)
      RETURNING id INTO v_id;
    v_event_ids := v_event_ids || v_id;

    -- Close OUT player's open position interval, if tracked
    SELECT id, slot_id, role, formation_id, part_index
      INTO v_out_pos_id, v_out_slot, v_out_role, v_out_formation_id, v_out_part
      FROM public.match_player_positions
     WHERE match_id = p_match_id AND player_id = v_out_player AND ends_at_minute_abs IS NULL
     ORDER BY starts_at_minute_abs DESC
     LIMIT 1
     FOR UPDATE;

    IF v_out_pos_id IS NOT NULL THEN
      UPDATE public.match_player_positions
         SET ends_at_minute_abs = p_minute
       WHERE id = v_out_pos_id;
    END IF;

    -- Open IN player's interval on chosen slot (default: outgoing's slot)
    IF v_slot_id IS NULL THEN
      v_slot_id := v_out_slot;
      IF v_role IS NULL THEN v_role := v_out_role; END IF;
      IF v_formation_id IS NULL THEN v_formation_id := v_out_formation_id; END IF;
      IF v_part = 1 AND v_out_part IS NOT NULL THEN v_part := v_out_part; END IF;
    END IF;

    IF v_slot_id IS NOT NULL THEN
      INSERT INTO public.match_player_positions(
        match_id, season_id, owner_id, player_id, formation_id,
        slot_id, role, starts_at_minute_abs, ends_at_minute_abs,
        part_index, source, created_by
      ) VALUES (
        p_match_id, v_season_id, p_owner_id, v_in_player, v_formation_id,
        v_slot_id, v_role, p_minute, NULL,
        v_part, 'substitution_in', p_owner_id
      );

      INSERT INTO public.match_tactical_changes(
        match_id, season_id, owner_id, part_index, minute_abs, change_type, payload, created_by
      ) VALUES (
        p_match_id, v_season_id, p_owner_id, v_part, p_minute, 'substitution_to_slot',
        jsonb_build_object('out', v_out_player, 'in', v_in_player, 'slot_id', v_slot_id, 'role', v_role),
        p_owner_id
      );
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object('event_ids', to_jsonb(v_event_ids));
END;
$function$;