-- TreinON security hardening
-- 1) Security PIN: hashes are never readable or writable from the client
--    (previously each user could SELECT their own pin_hash and brute-force the
--    4–6 digit PIN offline, or UPDATE it directly). Adds lockout columns.
-- 2) Rate limiting for unauthenticated auth helpers (username login, sign-up checks).

-- ─── 1. Security PIN ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own PIN hash" ON public.security_pins;
DROP POLICY IF EXISTS "Users can create their own PIN" ON public.security_pins;
DROP POLICY IF EXISTS "Users can update their own PIN" ON public.security_pins;
DROP POLICY IF EXISTS "Users can delete their own PIN" ON public.security_pins;
-- RLS stays enabled with no policies: only the service role (edge function) can access it.
REVOKE ALL ON public.security_pins FROM anon, authenticated;

ALTER TABLE public.security_pins
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Legacy helper compared a client-supplied hash; no longer used.
DROP FUNCTION IF EXISTS public.verify_security_pin(uuid, text);

-- Lets the app know whether the current user has a PIN without exposing the hash.
CREATE OR REPLACE FUNCTION public.has_security_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.security_pins WHERE owner_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.has_security_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_security_pin() TO authenticated;

-- ─── 1b. Profiles: identity fields are not client-editable ────────────────
-- Username login resolves the email from profiles.email, so users must not be able
-- to point their profile at another address or change their account type.
CREATE OR REPLACE FUNCTION public.protect_profile_identity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER -- current_user must be the caller's role, not the function owner
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.email := OLD.email;
    NEW.account_type := OLD.account_type;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_profile_identity_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_profile_identity ON public.profiles;
CREATE TRIGGER trg_protect_profile_identity
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_identity_fields();

-- Same pitfall in an earlier guard: as SECURITY DEFINER, current_user was always the
-- owner, so any user could create "global" medical exam types.
ALTER FUNCTION public.enforce_medical_exam_type_club() SECURITY INVOKER;

-- ─── 2. Rate limiting ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_rate_limits FROM anon, authenticated;

-- Atomically counts a hit for `p_key` in a fixed window.
-- Returns TRUE while the caller is within the limit.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO public.auth_rate_limits AS a (key, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN a.window_start < now() - make_interval(secs => p_window_seconds) THEN 1 ELSE a.hits + 1 END,
    window_start = CASE WHEN a.window_start < now() - make_interval(secs => p_window_seconds) THEN now() ELSE a.window_start END
  RETURNING hits INTO v_hits;

  -- Opportunistic cleanup of stale keys
  IF random() < 0.01 THEN
    DELETE FROM public.auth_rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_hits <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;
