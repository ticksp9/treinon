-- Privacy of minors: a coach who works for a club needs the name, the date of birth and
-- everything about football (trainings, matches, evaluations, history, injuries) — not the
-- child's address, documents and tax number, nor the parents' names, phones and emails.
--
-- Row-level security cannot hide columns, so the personal data moves to its own table
-- (player_private) that only the club's administration, the coordinator of the age group
-- and the family can read. The columns stay on `players` (always empty) so old screens
-- and old installed copies of the app keep working; anything written there is moved.

CREATE TABLE IF NOT EXISTS public.player_private (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  address text, phone text, email text, tax_id text,
  id_document_type text, id_document_number text, id_document_expiry date, id_document_url text,
  birth_place text, nationality text,
  parent_name text, parent_email text, parent_phone text,
  parent_name_2 text, parent_email_2 text, parent_phone_2 text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_private ENABLE ROW LEVEL SECURITY;

-- Who may read/change the personal data of a player:
--   * no club: the coach who owns the team (he is the one responsible for that data)
--   * club: the club admin, the secretariat/treasury, the coordinator of that age group
--     — NOT the coaches of the team
--   * always: the player's parents and the player himself
CREATE OR REPLACE FUNCTION public.can_see_player_private(_user uuid, _player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.players p
      LEFT JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = _player AND (
        (t.id IS NULL AND p.owner_id = _user)
        OR (t.id IS NOT NULL AND t.club_id IS NULL AND (t.owner_id = _user OR p.owner_id = _user))
        OR (t.club_id IS NOT NULL AND (
              public.is_club_admin(_user, t.club_id)
              OR public.is_team_coordinator(_user, t.id)
              OR EXISTS (SELECT 1 FROM public.club_staff cs
                          WHERE cs.club_id = t.club_id AND cs.user_id = _user AND cs.is_active
                            AND cs.role::text IN ('admin', 'secretaria', 'tesouraria'))))
      ))
    OR public.is_guardian_of_player(_user, _player)
    -- (no player account = NULL: must count as "no", not as "unknown")
    OR coalesce(_player = public.get_player_account_id(_user), false)
  )
$$;
REVOKE ALL ON FUNCTION public.can_see_player_private(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_player_private(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "player_private_select" ON public.player_private;
CREATE POLICY "player_private_select" ON public.player_private FOR SELECT TO authenticated
  USING (public.can_see_player_private(auth.uid(), player_id));
DROP POLICY IF EXISTS "player_private_insert" ON public.player_private;
CREATE POLICY "player_private_insert" ON public.player_private FOR INSERT TO authenticated
  WITH CHECK (public.can_see_player_private(auth.uid(), player_id));
DROP POLICY IF EXISTS "player_private_update" ON public.player_private;
CREATE POLICY "player_private_update" ON public.player_private FOR UPDATE TO authenticated
  USING (public.can_see_player_private(auth.uid(), player_id))
  WITH CHECK (public.can_see_player_private(auth.uid(), player_id));
GRANT SELECT, INSERT, UPDATE ON public.player_private TO authenticated;

-- Anything personal written on `players` (form, Excel import, an old copy of the app) goes to
-- player_private and is blanked on the player row. Empty values are ignored: a coach who
-- cannot see the data edits a form with those fields empty and must not erase what is there.
CREATE OR REPLACE FUNCTION public.players_move_private()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := nullif(trim(coalesce(NEW.address, '')), '');
BEGIN
  IF coalesce(n, nullif(trim(coalesce(NEW.phone, '')), ''), nullif(trim(coalesce(NEW.email, '')), ''), nullif(trim(coalesce(NEW.tax_id, '')), ''),
              nullif(trim(coalesce(NEW.id_document_type, '')), ''), nullif(trim(coalesce(NEW.id_document_number, '')), ''), NEW.id_document_expiry::text,
              nullif(trim(coalesce(NEW.id_document_url, '')), ''), nullif(trim(coalesce(NEW.birth_place, '')), ''), nullif(trim(coalesce(NEW.nationality, '')), ''),
              nullif(trim(coalesce(NEW.parent_name, '')), ''), nullif(trim(coalesce(NEW.parent_email, '')), ''), nullif(trim(coalesce(NEW.parent_phone, '')), ''),
              nullif(trim(coalesce(NEW.parent_name_2, '')), ''), nullif(trim(coalesce(NEW.parent_email_2, '')), ''), nullif(trim(coalesce(NEW.parent_phone_2, '')), '')) IS NOT NULL THEN
    INSERT INTO public.player_private AS pp (player_id, address, phone, email, tax_id, id_document_type, id_document_number, id_document_expiry, id_document_url,
                                             birth_place, nationality, parent_name, parent_email, parent_phone, parent_name_2, parent_email_2, parent_phone_2)
    VALUES (NEW.id, n, nullif(trim(coalesce(NEW.phone, '')), ''), nullif(trim(coalesce(NEW.email, '')), ''), nullif(trim(coalesce(NEW.tax_id, '')), ''),
            nullif(trim(coalesce(NEW.id_document_type, '')), ''), nullif(trim(coalesce(NEW.id_document_number, '')), ''), NEW.id_document_expiry,
            nullif(trim(coalesce(NEW.id_document_url, '')), ''), nullif(trim(coalesce(NEW.birth_place, '')), ''), nullif(trim(coalesce(NEW.nationality, '')), ''),
            nullif(trim(coalesce(NEW.parent_name, '')), ''), nullif(trim(coalesce(NEW.parent_email, '')), ''), nullif(trim(coalesce(NEW.parent_phone, '')), ''),
            nullif(trim(coalesce(NEW.parent_name_2, '')), ''), nullif(trim(coalesce(NEW.parent_email_2, '')), ''), nullif(trim(coalesce(NEW.parent_phone_2, '')), ''))
    ON CONFLICT (player_id) DO UPDATE SET
      address = coalesce(EXCLUDED.address, pp.address), phone = coalesce(EXCLUDED.phone, pp.phone), email = coalesce(EXCLUDED.email, pp.email),
      tax_id = coalesce(EXCLUDED.tax_id, pp.tax_id), id_document_type = coalesce(EXCLUDED.id_document_type, pp.id_document_type),
      id_document_number = coalesce(EXCLUDED.id_document_number, pp.id_document_number), id_document_expiry = coalesce(EXCLUDED.id_document_expiry, pp.id_document_expiry),
      id_document_url = coalesce(EXCLUDED.id_document_url, pp.id_document_url), birth_place = coalesce(EXCLUDED.birth_place, pp.birth_place),
      nationality = coalesce(EXCLUDED.nationality, pp.nationality), parent_name = coalesce(EXCLUDED.parent_name, pp.parent_name),
      parent_email = coalesce(EXCLUDED.parent_email, pp.parent_email), parent_phone = coalesce(EXCLUDED.parent_phone, pp.parent_phone),
      parent_name_2 = coalesce(EXCLUDED.parent_name_2, pp.parent_name_2), parent_email_2 = coalesce(EXCLUDED.parent_email_2, pp.parent_email_2),
      parent_phone_2 = coalesce(EXCLUDED.parent_phone_2, pp.parent_phone_2), updated_at = now();
  END IF;
  NEW.address := NULL; NEW.phone := NULL; NEW.email := NULL; NEW.tax_id := NULL;
  NEW.id_document_type := NULL; NEW.id_document_number := NULL; NEW.id_document_expiry := NULL; NEW.id_document_url := NULL;
  NEW.birth_place := NULL; NEW.nationality := NULL;
  NEW.parent_name := NULL; NEW.parent_email := NULL; NEW.parent_phone := NULL;
  NEW.parent_name_2 := NULL; NEW.parent_email_2 := NULL; NEW.parent_phone_2 := NULL;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.players_move_private() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS players_move_private ON public.players;
CREATE TRIGGER players_move_private BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_move_private();

-- existing data: touching each row with personal data makes the trigger move it
UPDATE public.players SET updated_at = updated_at
 WHERE coalesce(address, phone, email, tax_id, id_document_type, id_document_number, id_document_expiry::text, id_document_url,
                birth_place, nationality, parent_name, parent_email, parent_phone, parent_name_2, parent_email_2, parent_phone_2) IS NOT NULL;

-- ── the parents' own profile (name, phone, email): same rule as the player's personal data ──
-- (a function, so that the policy does not go back through player_guardians' own policy)
CREATE OR REPLACE FUNCTION public.can_see_guardian_profile(_user uuid, _guardian uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_guardians pg
     WHERE pg.guardian_id = _guardian AND public.can_see_player_private(_user, pg.player_id))
$$;
REVOKE ALL ON FUNCTION public.can_see_guardian_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_guardian_profile(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "guardian_staff_select" ON public.guardian_profiles;
CREATE POLICY "guardian_staff_select" ON public.guardian_profiles FOR SELECT TO authenticated
  USING (public.can_see_guardian_profile(auth.uid(), id));

-- ── emergency: a coach can still get the parents' phone for one player; every look is recorded ──
CREATE TABLE IF NOT EXISTS public.player_private_access_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'emergency_contact',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_private_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "access_log_club_admin" ON public.player_private_access_log;
CREATE POLICY "access_log_club_admin" ON public.player_private_access_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.players p JOIN public.teams t ON t.id = p.team_id
                  WHERE p.id = player_id AND t.club_id IS NOT NULL AND public.is_club_admin(auth.uid(), t.club_id)));
GRANT SELECT ON public.player_private_access_log TO authenticated;

CREATE OR REPLACE FUNCTION public.get_emergency_contact(_player uuid)
RETURNS TABLE (parent_name text, parent_phone text, parent_name_2 text, parent_phone_2 text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid;
BEGIN
  SELECT p.team_id INTO _team FROM public.players p WHERE p.id = _player;
  IF NOT (public.can_see_player_private(auth.uid(), _player) OR (_team IS NOT NULL AND public.can_coach_team(auth.uid(), _team))) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.player_private_access_log (player_id, user_id) VALUES (_player, auth.uid());
  RETURN QUERY
    SELECT coalesce(pp.parent_name, g.name1), coalesce(pp.parent_phone, g.phone1), pp.parent_name_2, pp.parent_phone_2
      FROM (SELECT _player AS id) x
      LEFT JOIN public.player_private pp ON pp.player_id = x.id
      LEFT JOIN LATERAL (
        SELECT gp.full_name::text AS name1, gp.phone::text AS phone1
          FROM public.player_guardians pg JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
         WHERE pg.player_id = x.id AND gp.phone IS NOT NULL
         ORDER BY pg.is_primary DESC NULLS LAST LIMIT 1) g ON true;
END $$;
REVOKE ALL ON FUNCTION public.get_emergency_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_emergency_contact(uuid) TO authenticated;
