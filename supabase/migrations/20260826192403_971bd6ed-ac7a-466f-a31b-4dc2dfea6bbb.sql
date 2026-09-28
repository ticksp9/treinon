DO $$
DECLARE
  c record;
  dropped int := 0;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.season_player_enrollments'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(season_id, player_id)%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%team_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.season_player_enrollments DROP CONSTRAINT %I', c.conname);
    dropped := dropped + 1;
  END LOOP;
  RAISE NOTICE 'season_player_enrollments: % constraint(s) unique(season_id, player_id) removida(s)', dropped;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS spe_season_player_team_uniq
  ON public.season_player_enrollments (
    season_id,
    player_id,
    COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS spe_player_season_status
  ON public.season_player_enrollments (player_id, season_id, status);

DO $$
BEGIN
  RAISE NOTICE 'Indices spe_season_player_team_uniq e spe_player_season_status garantidos';
END $$;