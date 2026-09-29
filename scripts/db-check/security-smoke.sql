-- Behavioural checks for the security hardening migration (run after all migrations).
\set ON_ERROR_STOP 1

-- A user with a PIN
INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'coach@test.pt');
INSERT INTO public.profiles (id, email, full_name, username)
VALUES ('11111111-1111-1111-1111-111111111111', 'coach@test.pt', 'Coach', 'coach')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.security_pins (owner_id, pin_hash) VALUES ('11111111-1111-1111-1111-111111111111', 'x');

-- 1. Authenticated users cannot read PIN hashes
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
DO $$ BEGIN
  PERFORM 1 FROM public.security_pins;
  RAISE EXCEPTION 'FAIL: authenticated can read security_pins';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: security_pins not readable';
END $$;

-- 2. has_security_pin() works for the owner
DO $$ BEGIN
  IF NOT public.has_security_pin() THEN RAISE EXCEPTION 'FAIL: has_security_pin'; END IF;
END $$;

-- 3. Users cannot change their own email / account type
UPDATE public.profiles SET email = 'other@test.pt', account_type = 'club', full_name = 'Coach 2'
WHERE id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;
DO $$ DECLARE p record; BEGIN
  SELECT email, account_type::text AS t, full_name INTO p FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';
  IF p.email <> 'coach@test.pt' OR p.t <> 'individual_coach' THEN RAISE EXCEPTION 'FAIL: identity fields changed (%, %)', p.email, p.t; END IF;
  IF p.full_name <> 'Coach 2' THEN RAISE EXCEPTION 'FAIL: normal fields should still be editable'; END IF;
END $$;

-- 4. Rate limiter: 3 allowed, 4th refused; not callable by clients
DO $$ BEGIN
  IF NOT public.hit_rate_limit('t', 3, 60) OR NOT public.hit_rate_limit('t', 3, 60) OR NOT public.hit_rate_limit('t', 3, 60)
     OR public.hit_rate_limit('t', 3, 60) THEN
    RAISE EXCEPTION 'FAIL: rate limiter';
  END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
  PERFORM public.hit_rate_limit('x', 1, 60);
  RAISE EXCEPTION 'FAIL: anon can call hit_rate_limit';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: limiter not callable by anon';
END $$;
RESET ROLE;

SELECT 'SECURITY SMOKE OK' AS result;
