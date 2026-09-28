
CREATE OR REPLACE FUNCTION public.commit_substitution_batch(
  p_match_id uuid,
  p_owner_id uuid,
  p_minute int,
  p_second_base int,
  p_subs jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idx int := 0;
  v_pair jsonb;
  v_out_player uuid;
  v_in_player uuid;
  v_out_lineup_id uuid;
  v_in_lineup_id uuid;
  v_event_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
BEGIN
  IF jsonb_typeof(p_subs) <> 'array' THEN
    RAISE EXCEPTION 'p_subs must be a jsonb array';
  END IF;

  FOR v_pair IN SELECT * FROM jsonb_array_elements(p_subs) LOOP
    v_out_player := (v_pair->>'out')::uuid;
    v_in_player  := (v_pair->>'in')::uuid;

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

    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object('event_ids', to_jsonb(v_event_ids));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.commit_substitution_batch(uuid, uuid, int, int, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_substitution_batch(uuid, uuid, int, int, jsonb) TO authenticated;
