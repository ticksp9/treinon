import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReconciliationRequest {
  action: "import_csv" | "auto_match" | "manual_match" | "reverse_match";
  club_id: string;
  // For import
  bank_account_id?: string;
  rows?: any[];
  // For auto_match
  import_id?: string;
  // For manual_match
  line_id?: string;
  charge_id?: string;
  transaction_id?: string;
  amount?: number;
  notes?: string;
  // For reverse
  reconciliation_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body: ReconciliationRequest = await req.json();

    // Verify financial admin
    const { data: isAdmin } = await supabase.rpc("is_club_financial_admin", {
      _user_id: userId,
      _club_id: body.club_id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    switch (body.action) {
      case "import_csv":
        result = await importCsvStatement(supabase, body, userId);
        break;
      case "auto_match":
        result = await autoMatchLines(supabase, body, userId);
        break;
      case "manual_match":
        result = await manualMatch(supabase, body, userId);
        break;
      case "reverse_match":
        result = await reverseMatch(supabase, body, userId);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Reconciliation error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function importCsvStatement(supabase: any, body: ReconciliationRequest, userId: string) {
  const { club_id, bank_account_id, rows } = body;
  if (!rows?.length) throw new Error("No rows provided");

  // Create import record
  const dates = rows.map((r: any) => r.booking_date).filter(Boolean).sort();
  const { data: importRecord, error: importErr } = await supabase
    .from("bank_statement_imports")
    .insert({
      club_id,
      bank_account_id,
      source_type: "upload",
      file_format: "csv",
      period_start: dates[0] || null,
      period_end: dates[dates.length - 1] || null,
      import_status: "processing",
      imported_by: userId,
      row_count: rows.length,
    })
    .select("id")
    .single();

  if (importErr) throw importErr;

  // Insert lines
  const lines = rows.map((r: any) => ({
    import_id: importRecord.id,
    bank_account_id,
    booking_date: r.booking_date || r.date,
    value_date: r.value_date || r.booking_date || r.date,
    amount: Math.abs(Number(r.amount)),
    currency: r.currency || "EUR",
    debit_credit: Number(r.amount) >= 0 ? "credit" : "debit",
    bank_reference: r.bank_reference || r.reference || null,
    end_to_end_reference: r.end_to_end_reference || null,
    remittance_info: r.remittance_info || r.description || null,
    counterparty_name: r.counterparty_name || r.payer || null,
    counterparty_iban: r.counterparty_iban || null,
    balance_after: r.balance_after ? Number(r.balance_after) : null,
    raw_line_payload: r,
    reconciliation_status: "unmatched",
  }));

  const { error: linesErr } = await supabase.from("bank_statement_lines").insert(lines);
  if (linesErr) throw linesErr;

  // Update import status
  await supabase
    .from("bank_statement_imports")
    .update({ import_status: "completed" })
    .eq("id", importRecord.id);

  await supabase.from("payment_events").insert({
    club_id,
    event_type: "statement_import_created",
    event_source: "reconciliation-engine",
    actor_user_id: userId,
    payload: { import_id: importRecord.id, row_count: rows.length },
  });

  return { import_id: importRecord.id, rows_imported: rows.length };
}

async function autoMatchLines(supabase: any, body: ReconciliationRequest, userId: string) {
  const { club_id, import_id } = body;

  // Get unmatched credit lines from this import or all
  let query = supabase
    .from("bank_statement_lines")
    .select("*, bank_statement_imports!inner(club_id)")
    .eq("reconciliation_status", "unmatched")
    .eq("debit_credit", "credit");

  if (import_id) {
    query = query.eq("import_id", import_id);
  } else {
    query = query.eq("bank_statement_imports.club_id", club_id);
  }

  const { data: lines, error } = await query.limit(500);
  if (error) throw error;

  // Get pending/overdue charges
  const { data: charges } = await supabase
    .from("charges")
    .select("id, final_amount, balance_due, description, player_id, guardian_id, due_date, reference_month, reference_year")
    .eq("club_id", club_id)
    .in("status", ["pending", "overdue", "partially_paid"])
    .gt("balance_due", 0);

  // Get existing transactions for reference matching
  const { data: txns } = await supabase
    .from("payment_transactions")
    .select("id, gross_amount, provider_payment_id, payer_email, payer_name, charge_id, transaction_reference")
    .eq("club_id", club_id)
    .eq("transaction_status", "succeeded");

  let matched = 0;
  let reviewed = 0;

  for (const line of (lines || [])) {
    const candidates = findMatchCandidates(line, charges || [], txns || []);

    if (candidates.length === 0) continue;

    const best = candidates[0];

    if (best.confidence >= 90) {
      // Auto-match
      await supabase.from("bank_reconciliations").insert({
        club_id,
        bank_statement_line_id: line.id,
        payment_transaction_id: best.transaction_id || null,
        charge_id: best.charge_id || null,
        match_type: best.confidence >= 95 ? "exact" : "strong",
        confidence_score: best.confidence,
        reconciled_amount: line.amount,
        reconciled_by: userId,
      });

      await supabase
        .from("bank_statement_lines")
        .update({ reconciliation_status: "auto_matched" })
        .eq("id", line.id);

      matched++;
    } else if (best.confidence >= 60) {
      // Mark for review
      await supabase
        .from("bank_statement_lines")
        .update({
          reconciliation_status: "unmatched",
          raw_line_payload: { ...line.raw_line_payload, match_suggestions: candidates.slice(0, 3) },
        })
        .eq("id", line.id);
      reviewed++;
    }
  }

  // Update import matched count
  if (import_id) {
    await supabase
      .from("bank_statement_imports")
      .update({ matched_count: matched })
      .eq("id", import_id);
  }

  await supabase.from("payment_events").insert({
    club_id,
    event_type: "auto_match_completed",
    event_source: "reconciliation-engine",
    actor_user_id: userId,
    payload: { matched, reviewed, total_lines: lines?.length || 0 },
  });

  return { matched, needs_review: reviewed, total: lines?.length || 0 };
}

function findMatchCandidates(line: any, charges: any[], txns: any[]): any[] {
  const candidates: any[] = [];
  const lineAmount = Number(line.amount);
  const remittance = (line.remittance_info || "").toLowerCase();
  const counterparty = (line.counterparty_name || "").toLowerCase();
  const ref = (line.bank_reference || line.end_to_end_reference || "").toLowerCase();

  // Match against charges by amount
  for (const charge of charges) {
    let confidence = 0;
    const balanceDue = Number(charge.balance_due);
    const finalAmount = Number(charge.final_amount);

    // Exact amount match
    if (Math.abs(lineAmount - balanceDue) < 0.01) {
      confidence += 50;
    } else if (Math.abs(lineAmount - finalAmount) < 0.01) {
      confidence += 40;
    } else if (Math.abs(lineAmount - balanceDue) < 1.0) {
      confidence += 25;
    } else {
      continue; // Skip if amount doesn't match at all
    }

    // Reference contains charge info
    if (ref && charge.id && ref.includes(charge.id.substring(0, 8))) {
      confidence += 40;
    }

    // Description/remittance match
    if (remittance && charge.description) {
      const desc = charge.description.toLowerCase();
      if (remittance.includes(desc) || desc.includes(remittance.substring(0, 20))) {
        confidence += 15;
      }
    }

    // Date proximity (booking_date near due_date)
    if (line.booking_date && charge.due_date) {
      const daysDiff = Math.abs(
        (new Date(line.booking_date).getTime() - new Date(charge.due_date).getTime()) / 86400000
      );
      if (daysDiff <= 5) confidence += 10;
      else if (daysDiff <= 15) confidence += 5;
    }

    if (confidence > 0) {
      candidates.push({
        charge_id: charge.id,
        transaction_id: null,
        confidence: Math.min(confidence, 100),
        reason: `Amount match (€${balanceDue})`,
      });
    }
  }

  // Match against transactions
  for (const txn of txns) {
    let confidence = 0;
    if (Math.abs(lineAmount - Number(txn.gross_amount)) < 0.01) {
      confidence += 50;
    }
    if (ref && txn.provider_payment_id && ref.includes(txn.provider_payment_id.substring(0, 10))) {
      confidence += 40;
    }
    if (txn.transaction_reference && ref && ref.includes(txn.transaction_reference.toLowerCase())) {
      confidence += 30;
    }
    if (confidence > 0) {
      candidates.push({
        charge_id: txn.charge_id,
        transaction_id: txn.id,
        confidence: Math.min(confidence, 100),
        reason: `Transaction match (${txn.provider_payment_id || "manual"})`,
      });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

async function manualMatch(supabase: any, body: ReconciliationRequest, userId: string) {
  const { club_id, line_id, charge_id, transaction_id, amount, notes } = body;
  if (!line_id) throw new Error("Missing line_id");

  const { data: line } = await supabase
    .from("bank_statement_lines")
    .select("*")
    .eq("id", line_id)
    .single();

  if (!line) throw new Error("Line not found");

  await supabase.from("bank_reconciliations").insert({
    club_id,
    bank_statement_line_id: line_id,
    payment_transaction_id: transaction_id || null,
    charge_id: charge_id || null,
    match_type: "manual",
    confidence_score: 100,
    reconciled_amount: amount || line.amount,
    reconciled_by: userId,
    notes,
  });

  await supabase
    .from("bank_statement_lines")
    .update({ reconciliation_status: "manually_matched" })
    .eq("id", line_id);

  await supabase.from("payment_events").insert({
    club_id,
    event_type: "manual_match_created",
    event_source: "reconciliation-engine",
    actor_user_id: userId,
    payload: { line_id, charge_id, transaction_id, amount: amount || line.amount },
  });

  return { reconciled: true };
}

async function reverseMatch(supabase: any, body: ReconciliationRequest, userId: string) {
  const { club_id, reconciliation_id } = body;
  if (!reconciliation_id) throw new Error("Missing reconciliation_id");

  const { data: recon } = await supabase
    .from("bank_reconciliations")
    .select("*")
    .eq("id", reconciliation_id)
    .single();

  if (!recon) throw new Error("Reconciliation not found");

  // Reverse: set line back to unmatched
  await supabase
    .from("bank_statement_lines")
    .update({ reconciliation_status: "unmatched" })
    .eq("id", recon.bank_statement_line_id);

  // Delete reconciliation
  await supabase.from("bank_reconciliations").delete().eq("id", reconciliation_id);

  await supabase.from("payment_events").insert({
    club_id,
    event_type: "reconciliation_reversed",
    event_source: "reconciliation-engine",
    actor_user_id: userId,
    payload: { reconciliation_id, line_id: recon.bank_statement_line_id },
  });

  return { reversed: true };
}
