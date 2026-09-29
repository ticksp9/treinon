import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders, json, hashPin, verifyPinHash, isValidPin } from "../_shared/security.ts";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(req, { success: false, error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(req, { success: false, error: "Not authenticated" }, 401);

    const { action, pin, new_pin } = await req.json();
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const loadPin = async () => {
      const { data } = await admin
        .from("security_pins")
        .select("pin_hash, failed_attempts, locked_until")
        .eq("owner_id", user.id)
        .maybeSingle();
      return data as { pin_hash: string; failed_attempts: number; locked_until: string | null } | null;
    };

    /** Checks the current PIN with lockout; upgrades legacy hashes on success. */
    const checkCurrentPin = async (candidate: unknown): Promise<{ ok: true } | { ok: false; error: string }> => {
      const row = await loadPin();
      if (!row) return { ok: false, error: "PIN not found" };
      if (row.locked_until && new Date(row.locked_until) > new Date()) {
        const mins = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000);
        return { ok: false, error: `PIN bloqueado por excesso de tentativas. Tente dentro de ${mins} min.` };
      }
      const { ok, needsRehash } = isValidPin(candidate)
        ? await verifyPinHash(candidate, row.pin_hash)
        : { ok: false, needsRehash: false };
      if (!ok) {
        const failed = (row.failed_attempts ?? 0) + 1;
        const lock = failed >= MAX_FAILED_ATTEMPTS;
        await admin
          .from("security_pins")
          .update({
            failed_attempts: lock ? 0 : failed,
            locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
          })
          .eq("owner_id", user.id);
        return {
          ok: false,
          error: lock
            ? `PIN bloqueado durante ${LOCK_MINUTES} minutos.`
            : `PIN incorreto (${MAX_FAILED_ATTEMPTS - failed} tentativa(s) restante(s))`,
        };
      }
      await admin
        .from("security_pins")
        .update({
          failed_attempts: 0,
          locked_until: null,
          ...(needsRehash ? { pin_hash: await hashPin(candidate as string) } : {}),
        })
        .eq("owner_id", user.id);
      return { ok: true };
    };

    if (action === "verify") {
      const res = await checkCurrentPin(pin);
      return json(req, res.ok ? { success: true } : { success: false, error: res.error });
    }

    if (action === "create") {
      if (!isValidPin(pin)) return json(req, { success: false, error: "O PIN deve ter 4 a 6 dígitos" }, 400);
      // Creating must never overwrite an existing PIN (use "change" instead).
      if (await loadPin()) return json(req, { success: false, error: "Já existe um PIN. Use a opção de alterar." });
      const { error } = await admin
        .from("security_pins")
        .insert({ owner_id: user.id, pin_hash: await hashPin(pin) });
      if (error) return json(req, { success: false, error: "Failed to save PIN" }, 500);
      return json(req, { success: true });
    }

    if (action === "change") {
      if (!isValidPin(new_pin)) return json(req, { success: false, error: "O novo PIN deve ter 4 a 6 dígitos" }, 400);
      const res = await checkCurrentPin(pin);
      if (!res.ok) return json(req, { success: false, error: res.error });
      const { error } = await admin
        .from("security_pins")
        .update({ pin_hash: await hashPin(new_pin), failed_attempts: 0, locked_until: null })
        .eq("owner_id", user.id);
      if (error) return json(req, { success: false, error: "Failed to update PIN" }, 500);
      return json(req, { success: true });
    }

    if (action === "delete") {
      const res = await checkCurrentPin(pin);
      if (!res.ok) return json(req, { success: false, error: res.error });
      const { error } = await admin.from("security_pins").delete().eq("owner_id", user.id);
      if (error) return json(req, { success: false, error: "Failed to delete PIN" }, 500);
      return json(req, { success: true });
    }

    return json(req, { success: false, error: "Invalid action" }, 400);
  } catch {
    return json(req, { success: false, error: "Internal server error" }, 500);
  }
});
