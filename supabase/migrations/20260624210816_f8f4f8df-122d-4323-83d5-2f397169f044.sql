
-- =============================================================
-- RPC: save_initial_formation
-- Atomically inserts the initial formation (part 1, minute 0)
-- and the corresponding starter position intervals.
-- =============================================================
CREATE OR REPLACE FUNCTION public.save_initial_formation(
  p_match_id uuid,
  p_sport_type text,
  p_formation_code text,
  p_formation_name text,
  p_slots jsonb,
  p_assignments jsonb,
  p_overwrite boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_season uuid;
  v_existing uuid;
  v_formation_id uuid;
  v_item jsonb;
  v_count int := 0;
BEGIN
  IF p_match_id IS NULL THEN RAISE EXCEPTION 'match_id is required'; END IF;
  IF jsonb_typeof(p_assignments) <> 'array' THEN
    RAISE EXCEPTION 'p_assignments must be a jsonb array';
  END IF;

  SELECT owner_id, season_id INTO v_owner, v_season FROM public.matches WHERE id = p_match_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Match % not found', p_match_id; END IF;

  SELECT id INTO v_existing
    FROM public.match_formations
   WHERE match_id = p_match_id AND part_index = 1 AND starts_at_minute_abs = 0
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF NOT p_overwrite THEN
      RAISE EXCEPTION 'Initial formation already exists for match %', p_match_id
        USING ERRCODE = 'unique_violation';
    END IF;
    DELETE FROM public.match_player_positions
      WHERE match_id = p_match_id AND formation_id = v_existing;
    DELETE FROM public.match_formations WHERE id = v_existing;
  END IF;

  INSERT INTO public.match_formations(
    match_id, season_id, owner_id, formation_code, formation_name, sport_type,
    slots, starts_at_minute_abs, ends_at_minute_abs, part_index, created_by
  ) VALUES (
    p_match_id, v_season, v_owner, p_formation_code, p_formation_name, p_sport_type,
    COALESCE(p_slots, '[]'::jsonb), 0, NULL, 1, auth.uid()
  ) RETURNING id INTO v_formation_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
    IF NULLIF(v_item->>'player_id','') IS NULL OR NULLIF(v_item->>'slot_id','') IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.match_player_positions(
      match_id, season_id, owner_id, player_id, formation_id,
      slot_id, role, starts_at_minute_abs, ends_at_minute_abs,
      part_index, source, created_by
    ) VALUES (
      p_match_id, v_season, v_owner,
      (v_item->>'player_id')::uuid, v_formation_id,
      v_item->>'slot_id', NULLIF(v_item->>'role',''),
      0, NULL, 1, 'initial_lineup', auth.uid()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('formation_id', v_formation_id, 'players', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_initial_formation(uuid, text, text, text, jsonb, jsonb, boolean) TO authenticated;

-- =============================================================
-- RPC: apply_tactical_change
-- Handles three change types atomically:
--   formation_change | player_move | slot_swap
-- =============================================================
CREATE OR REPLACE FUNCTION public.apply_tactical_change(
  p_match_id uuid,
  p_minute_abs integer,
  p_part_index integer,
  p_change jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_season uuid;
  v_type text;
  v_new_formation_id uuid;
  v_active_formation_id uuid;
  v_item jsonb;
  v_player uuid;
  v_to_slot text;
  v_from_slot text;
  v_a_player uuid; v_a_slot text;
  v_b_player uuid; v_b_slot text;
  v_role_a text; v_role_b text;
  v_open record;
BEGIN
  IF p_match_id IS NULL THEN RAISE EXCEPTION 'match_id is required'; END IF;
  v_type := p_change->>'type';
  IF v_type IS NULL THEN RAISE EXCEPTION 'change.type is required'; END IF;

  SELECT owner_id, season_id INTO v_owner, v_season FROM public.matches WHERE id = p_match_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Match % not found', p_match_id; END IF;

  SELECT id INTO v_active_formation_id
    FROM public.match_formations
   WHERE match_id = p_match_id AND ends_at_minute_abs IS NULL
   ORDER BY starts_at_minute_abs DESC LIMIT 1;

  IF v_type = 'formation_change' THEN
    -- Close current formation
    IF v_active_formation_id IS NOT NULL THEN
      UPDATE public.match_formations
         SET ends_at_minute_abs = p_minute_abs
       WHERE id = v_active_formation_id;
    END IF;

    INSERT INTO public.match_formations(
      match_id, season_id, owner_id, formation_code, formation_name, sport_type,
      slots, starts_at_minute_abs, ends_at_minute_abs, part_index, created_by
    ) VALUES (
      p_match_id, v_season, v_owner,
      p_change->>'formation_code', p_change->>'formation_name', p_change->>'sport_type',
      COALESCE(p_change->'slots','[]'::jsonb),
      p_minute_abs, NULL, p_part_index, auth.uid()
    ) RETURNING id INTO v_new_formation_id;

    -- Close all open position intervals and reopen with new assignments
    UPDATE public.match_player_positions
       SET ends_at_minute_abs = p_minute_abs
     WHERE match_id = p_match_id AND ends_at_minute_abs IS NULL;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_change->'assignments','[]'::jsonb)) LOOP
      IF NULLIF(v_item->>'player_id','') IS NULL OR NULLIF(v_item->>'slot_id','') IS NULL THEN CONTINUE; END IF;
      INSERT INTO public.match_player_positions(
        match_id, season_id, owner_id, player_id, formation_id,
        slot_id, role, starts_at_minute_abs, ends_at_minute_abs,
        part_index, source, created_by
      ) VALUES (
        p_match_id, v_season, v_owner,
        (v_item->>'player_id')::uuid, v_new_formation_id,
        v_item->>'slot_id', NULLIF(v_item->>'role',''),
        p_minute_abs, NULL, p_part_index, 'formation_change', auth.uid()
      );
    END LOOP;

    INSERT INTO public.match_tactical_changes(
      match_id, season_id, owner_id, part_index, minute_abs, change_type, payload, created_by
    ) VALUES (
      p_match_id, v_season, v_owner, p_part_index, p_minute_abs, 'formation_change',
      jsonb_build_object('formation_id', v_new_formation_id, 'formation_code', p_change->>'formation_code'),
      auth.uid()
    );

    RETURN jsonb_build_object('formation_id', v_new_formation_id);

  ELSIF v_type = 'player_move' THEN
    v_player := (p_change->>'player_id')::uuid;
    v_to_slot := p_change->>'to_slot_id';
    v_from_slot := p_change->>'from_slot_id';

    SELECT * INTO v_open FROM public.match_player_positions
     WHERE match_id = p_match_id AND player_id = v_player AND ends_at_minute_abs IS NULL
     ORDER BY starts_at_minute_abs DESC LIMIT 1 FOR UPDATE;

    IF v_open.id IS NOT NULL THEN
      UPDATE public.match_player_positions SET ends_at_minute_abs = p_minute_abs WHERE id = v_open.id;
    END IF;

    INSERT INTO public.match_player_positions(
      match_id, season_id, owner_id, player_id, formation_id,
      slot_id, role, starts_at_minute_abs, ends_at_minute_abs,
      part_index, source, created_by
    ) VALUES (
      p_match_id, v_season, v_owner, v_player, COALESCE(v_open.formation_id, v_active_formation_id),
      v_to_slot, NULLIF(p_change->>'role',''),
      p_minute_abs, NULL, p_part_index, 'tactical_move', auth.uid()
    );

    INSERT INTO public.match_tactical_changes(
      match_id, season_id, owner_id, part_index, minute_abs, change_type, payload, created_by
    ) VALUES (
      p_match_id, v_season, v_owner, p_part_index, p_minute_abs, 'player_move',
      jsonb_build_object('player_id', v_player, 'from_slot_id', v_from_slot, 'to_slot_id', v_to_slot),
      auth.uid()
    );

    RETURN jsonb_build_object('moved', v_player);

  ELSIF v_type = 'slot_swap' THEN
    v_a_player := (p_change->>'a_player_id')::uuid;
    v_b_player := (p_change->>'b_player_id')::uuid;
    v_a_slot := p_change->>'a_slot_id';
    v_b_slot := p_change->>'b_slot_id';
    v_role_a := NULLIF(p_change->>'a_role','');
    v_role_b := NULLIF(p_change->>'b_role','');

    -- Close A
    UPDATE public.match_player_positions
       SET ends_at_minute_abs = p_minute_abs
     WHERE match_id = p_match_id AND player_id = v_a_player AND ends_at_minute_abs IS NULL;
    -- Close B
    UPDATE public.match_player_positions
       SET ends_at_minute_abs = p_minute_abs
     WHERE match_id = p_match_id AND player_id = v_b_player AND ends_at_minute_abs IS NULL;

    INSERT INTO public.match_player_positions(
      match_id, season_id, owner_id, player_id, formation_id,
      slot_id, role, starts_at_minute_abs, ends_at_minute_abs,
      part_index, source, created_by
    ) VALUES
      (p_match_id, v_season, v_owner, v_a_player, v_active_formation_id, v_b_slot, v_role_b,
        p_minute_abs, NULL, p_part_index, 'tactical_move', auth.uid()),
      (p_match_id, v_season, v_owner, v_b_player, v_active_formation_id, v_a_slot, v_role_a,
        p_minute_abs, NULL, p_part_index, 'tactical_move', auth.uid());

    INSERT INTO public.match_tactical_changes(
      match_id, season_id, owner_id, part_index, minute_abs, change_type, payload, created_by
    ) VALUES (
      p_match_id, v_season, v_owner, p_part_index, p_minute_abs, 'slot_swap',
      jsonb_build_object(
        'a_player_id', v_a_player, 'a_slot_id', v_a_slot,
        'b_player_id', v_b_player, 'b_slot_id', v_b_slot
      ),
      auth.uid()
    );

    RETURN jsonb_build_object('swapped', jsonb_build_array(v_a_player, v_b_player));
  ELSE
    RAISE EXCEPTION 'Unknown change.type: %', v_type;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_tactical_change(uuid, integer, integer, jsonb) TO authenticated;
