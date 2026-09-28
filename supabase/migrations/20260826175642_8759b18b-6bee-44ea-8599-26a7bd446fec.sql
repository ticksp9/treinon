DO $$
DECLARE
  pairs text[][] := ARRAY[
    ['matches','match_date'],
    ['training_sessions','date'],
    ['coach_trainings','training_date'],
    ['player_evaluations','evaluation_date'],
    ['championship_results','match_date'],
    ['championships','created_at'],
    ['championship_teams','created_at'],
    ['player_injuries','created_at'],
    ['coach_history','created_at']
  ];
  i int;
  tbl text;
  col text;
  has_owner boolean;
  has_club boolean;
  scope_pred text;
  n bigint;
BEGIN
  FOR i IN 1 .. array_length(pairs,1) LOOP
    tbl := pairs[i][1];
    col := pairs[i][2];

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=tbl AND column_name='season_id') THEN
      RAISE NOTICE 'skip % (sem season_id)', tbl; CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=tbl AND column_name=col) THEN
      RAISE NOTICE 'skip % (sem coluna %)', tbl, col; CONTINUE;
    END IF;

    has_owner := EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name=tbl AND column_name='owner_id');
    has_club := EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema='public' AND table_name=tbl AND column_name='club_id');

    scope_pred := '(false';
    IF has_owner THEN scope_pred := scope_pred || ' OR (r.owner_id IS NOT NULL AND s.owner_id = r.owner_id)'; END IF;
    IF has_club THEN scope_pred := scope_pred || ' OR (r.club_id IS NOT NULL AND s.club_id = r.club_id)'; END IF;
    scope_pred := scope_pred || ')';
    IF NOT has_owner AND NOT has_club THEN
      RAISE NOTICE 'skip % (sem owner_id/club_id)', tbl; CONTINUE;
    END IF;

    -- 1) época que contém a data do registo
    EXECUTE format($f$
      UPDATE public.%I r SET season_id = s.id
      FROM public.seasons s
      WHERE r.season_id IS NULL
        AND r.%I IS NOT NULL
        AND (r.%I)::date BETWEEN s.start_date AND s.end_date
        AND %s
    $f$, tbl, col, col, scope_pred);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'backfill %: % registos por intervalo de datas', tbl, n;

    -- 2) fallback: época anterior mais próxima
    EXECUTE format($f$
      UPDATE public.%I r SET season_id = (
        SELECT s.id FROM public.seasons s
        WHERE %s AND s.end_date < (r.%I)::date
        ORDER BY s.end_date DESC LIMIT 1)
      WHERE r.season_id IS NULL
        AND r.%I IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.seasons s
          WHERE %s AND s.end_date < (r.%I)::date)
    $f$, tbl, scope_pred, col, col, scope_pred, col);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE WARNING 'backfill %: % registos fora de qualquer época atribuidos a epoca anterior mais proxima', tbl, n;
    END IF;
  END LOOP;
END $$;

-- Registos filhos herdam a época do jogo
DO $$
DECLARE
  child text;
  n bigint;
BEGIN
  FOREACH child IN ARRAY ARRAY['match_lineups','match_events','match_formations','match_player_positions','match_tactical_changes','match_rule_snapshots','match_conflict_alerts'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=child AND column_name='season_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=child AND column_name='match_id') THEN
      EXECUTE format($f$
        UPDATE public.%I c SET season_id = m.season_id
        FROM public.matches m
        WHERE c.match_id = m.id AND c.season_id IS NULL AND m.season_id IS NOT NULL
      $f$, child);
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE 'backfill % (via jogo): % registos', child, n;
    END IF;
  END LOOP;
END $$;

-- Registos filhos herdam a época do treino
DO $$
DECLARE
  child text;
  n bigint;
BEGIN
  FOREACH child IN ARRAY ARRAY['training_attendance','training_load'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=child AND column_name='season_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=child AND column_name='session_id') THEN
      EXECUTE format($f$
        UPDATE public.%I c SET season_id = t.season_id
        FROM public.training_sessions t
        WHERE c.session_id = t.id AND c.season_id IS NULL AND t.season_id IS NOT NULL
      $f$, child);
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE 'backfill % (via treino): % registos', child, n;
    END IF;
  END LOOP;
END $$;