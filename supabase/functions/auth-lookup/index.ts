import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders, json, clientIp } from "../_shared/security.ts";

// Username login is done here, server-side, so the user's email address is never
// returned to the browser (the old "lookup_username" action let anyone harvest the
// email of any username). All actions are rate limited per IP.
//
// Limits (per fixed window):
const LIMITS = {
  signInPerIp: { limit: 20, windowSec: 10 * 60 },
  signInPerUser: { limit: 8, windowSec: 15 * 60 },
  checkPerIp: { limit: 30, windowSec: 10 * 60 },
  resendPerIp: { limit: 5, windowSec: 60 * 60 },
};

const INVALID = { error: "Invalid login credentials", code: "invalid_credentials" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ip = clientIp(req);

    const allow = async (key: string, cfg: { limit: number; windowSec: number }) => {
      const { data, error } = await admin.rpc("hit_rate_limit", {
        p_key: key,
        p_limit: cfg.limit,
        p_window_seconds: cfg.windowSec,
      });
      // Fail open only if the limiter itself is unavailable (e.g. migration not applied)
      return error ? true : data === true;
    };
    const tooMany = () =>
      json(req, { error: "Demasiadas tentativas. Aguarde alguns minutos.", code: "rate_limited" }, 429);

    const emailForUsername = async (u: string): Promise<string | null> => {
      const { data } = await admin.from("profiles").select("email").eq("username", u).maybeSingle();
      return (data?.email as string | undefined) ?? null;
    };

    if (action === "sign_in") {
      const password = typeof body?.password === "string" ? body.password : "";
      if (!username || !password) return json(req, INVALID, 400);
      if (!(await allow(`signin:ip:${ip}`, LIMITS.signInPerIp))) return tooMany();
      if (!(await allow(`signin:user:${username}`, LIMITS.signInPerUser))) return tooMany();

      const userEmail = await emailForUsername(username);
      if (!userEmail) return json(req, INVALID, 401);

      const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await anon.auth.signInWithPassword({ email: userEmail, password });
      if (error || !data.session) {
        const msg = error?.message ?? "";
        if (/email not confirmed/i.test(msg)) {
          return json(req, { error: "Email not confirmed", code: "email_not_confirmed" }, 401);
        }
        if ((error as { status?: number } | null)?.status === 429) return tooMany();
        return json(req, INVALID, 401);
      }
      return json(req, {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    if (action === "resend_confirmation") {
      if (!username) return json(req, { ok: true });
      if (!(await allow(`resend:ip:${ip}`, LIMITS.resendPerIp))) return tooMany();
      const userEmail = await emailForUsername(username);
      if (userEmail) {
        const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const redirect = typeof body?.redirect_to === "string" ? body.redirect_to : undefined;
        await anon.auth.resend({ type: "signup", email: userEmail, options: { emailRedirectTo: redirect } });
      }
      // Same answer whether or not the username exists
      return json(req, { ok: true });
    }

    if (action === "check_username") {
      if (!username) return json(req, { error: "Username is required" }, 400);
      if (!(await allow(`check:ip:${ip}`, LIMITS.checkPerIp))) return tooMany();
      const { data } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
      return json(req, { exists: !!data });
    }

    if (action === "check_email") {
      if (!email) return json(req, { error: "Email is required" }, 400);
      if (!(await allow(`check:ip:${ip}`, LIMITS.checkPerIp))) return tooMany();
      const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      return json(req, { exists: !!data });
    }

    return json(req, { error: "Invalid action" }, 400);
  } catch {
    return json(req, { error: "Internal server error" }, 500);
  }
});
