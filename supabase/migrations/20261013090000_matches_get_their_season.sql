-- Matches created from the call-up page had no season. The "Jogos" page lists only the
-- matches of the selected season, so as soon as a coach had a season every match he
-- created disappeared from that page ("Sem Jogos") and could not be started from there.
--
-- The database now gives every match its season: on insert, when a season is created
-- later, and for the matches that already exist.

-- The season a match of this team on this date belongs to: the club's (or, for a coach
-- without a club, his own) season that contains the date; otherwise the active one.
CREATE OR REPLACE FUNCTION public.resolve_season_for_team(_team uuid, _owner uuid, _on date)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT club_id, owner_id FROM public.teams WHERE id = _team)
  SELECT s.id
    FROM public.seasons s
   WHERE s.archived_at IS NULL
     AND CASE WHEN (SELECT club_id FROM t) IS NOT NULL
              THEN s.club_id = (SELECT club_id FROM t)
              ELSE s.club_id IS NULL AND s.owner_id = coalesce((SELECT owner_id FROM t), _owner) END
     AND ((_on BETWEEN s.start_date AND s.end_date) OR s.is_active)
   ORDER BY (_on BETWEEN s.start_date AND s.end_date) DESC, s.is_active DESC, s.start_date DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_season_for_team(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_season_for_team(uuid, uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.matches_fill_season()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.season_id IS NULL THEN
    NEW.season_id := public.resolve_season_for_team(NEW.team_id, NEW.owner_id, (NEW.match_date AT TIME ZONE 'Europe/Lisbon')::date);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.matches_fill_season() FROM PUBLIC, anon, authenticated;
-- the name sorts before the "block archived" triggers, so those see the season already set
DROP TRIGGER IF EXISTS trg_matches_a_fill_season ON public.matches;
CREATE TRIGGER trg_matches_a_fill_season BEFORE INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_fill_season();

-- line-ups, events and rule snapshots follow their match
CREATE OR REPLACE FUNCTION public.match_child_fill_season()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.season_id IS NULL THEN
    SELECT m.season_id INTO NEW.season_id FROM public.matches m WHERE m.id = NEW.match_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.match_child_fill_season() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_a_fill_season ON public.match_lineups;
CREATE TRIGGER trg_a_fill_season BEFORE INSERT ON public.match_lineups FOR EACH ROW EXECUTE FUNCTION public.match_child_fill_season();
DROP TRIGGER IF EXISTS trg_a_fill_season ON public.match_events;
CREATE TRIGGER trg_a_fill_season BEFORE INSERT ON public.match_events FOR EACH ROW EXECUTE FUNCTION public.match_child_fill_season();
DROP TRIGGER IF EXISTS trg_a_fill_season ON public.match_rule_snapshots;
CREATE TRIGGER trg_a_fill_season BEFORE INSERT ON public.match_rule_snapshots FOR EACH ROW EXECUTE FUNCTION public.match_child_fill_season();

-- Gives a season to everything that has none (matches first, then what hangs from them).
CREATE OR REPLACE FUNCTION public.backfill_match_seasons()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.matches m
     SET season_id = s.id
    FROM (SELECT m2.id AS match_id, public.resolve_season_for_team(m2.team_id, m2.owner_id, (m2.match_date AT TIME ZONE 'Europe/Lisbon')::date) AS id
            FROM public.matches m2 WHERE m2.season_id IS NULL) s
   WHERE m.id = s.match_id AND s.id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.match_lineups c SET season_id = m.season_id FROM public.matches m WHERE c.match_id = m.id AND c.season_id IS NULL AND m.season_id IS NOT NULL;
  UPDATE public.match_events c SET season_id = m.season_id FROM public.matches m WHERE c.match_id = m.id AND c.season_id IS NULL AND m.season_id IS NOT NULL;
  UPDATE public.match_rule_snapshots c SET season_id = m.season_id FROM public.matches m WHERE c.match_id = m.id AND c.season_id IS NULL AND m.season_id IS NOT NULL;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.backfill_match_seasons() FROM PUBLIC, anon, authenticated;

-- a coach creates his first season after already having matches: they join it
CREATE OR REPLACE FUNCTION public.seasons_adopt_matches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.backfill_match_seasons();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.seasons_adopt_matches() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_seasons_adopt_matches ON public.seasons;
CREATE TRIGGER trg_seasons_adopt_matches AFTER INSERT OR UPDATE OF is_active, start_date, end_date ON public.seasons
  FOR EACH STATEMENT EXECUTE FUNCTION public.seasons_adopt_matches();

SELECT public.backfill_match_seasons();
