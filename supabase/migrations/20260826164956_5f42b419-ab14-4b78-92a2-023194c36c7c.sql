CREATE OR REPLACE FUNCTION public.apply_season_transition(p_transition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from uuid; v_to uuid; v_payload jsonb; v_status public.season_transition_status;
  v_count int := 0; v_memberships int := 0;
  v_item jsonb;
BEGIN
  SELECT from_season_id, to_season_id, payload, status
    INTO v_from, v_to, v_payload, v_status
    FROM public.season_transitions WHERE id = p_transition_id FOR UPDATE;
  IF v_to IS NULL THEN RAISE EXCEPTION 'Transition not found'; END IF;
  IF NOT public.user_can_manage_season(auth.uid(), v_to) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status = 'applied' THEN RAISE EXCEPTION 'Already applied'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.season_transitions t
    WHERE t.id <> p_transition_id
      AND t.to_season_id = v_to
      AND t.from_season_id IS NOT DISTINCT FROM v_from
      AND t.status = 'applied'
  ) THEN
    RAISE EXCEPTION 'Já existe uma transição aplicada entre estas duas épocas.';
  END IF;

  -- payload.memberships = [{team_id, age_group_id}]
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_payload->'memberships','[]'::jsonb)) LOOP
    IF NULLIF(v_item->>'team_id','') IS NOT NULL THEN
      INSERT INTO public.season_team_memberships(season_id, team_id, age_group_id)
        VALUES (v_to, (v_item->>'team_id')::uuid, NULLIF(v_item->>'age_group_id','')::uuid)
      ON CONFLICT (season_id, team_id) DO UPDATE
        SET age_group_id = COALESCE(EXCLUDED.age_group_id, public.season_team_memberships.age_group_id),
            updated_at = now();
      v_memberships := v_memberships + 1;
    END IF;
  END LOOP;

  -- payload.enrollments = [{player_id, team_id, age_group_id, position, shirt_number, status}]
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_payload->'enrollments','[]'::jsonb)) LOOP
    INSERT INTO public.season_player_enrollments(season_id, player_id, team_id, age_group_id, position, shirt_number, status, joined_at)
      VALUES (
        v_to,
        (v_item->>'player_id')::uuid,
        NULLIF(v_item->>'team_id','')::uuid,
        NULLIF(v_item->>'age_group_id','')::uuid,
        v_item->>'position',
        NULLIF(v_item->>'shirt_number','')::int,
        COALESCE(NULLIF(v_item->>'status',''), 'active')::public.season_enrollment_status,
        COALESCE(NULLIF(v_item->>'joined_at','')::date, CURRENT_DATE)
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

  RETURN jsonb_build_object('enrolled', v_count, 'memberships', v_memberships);
END $function$;