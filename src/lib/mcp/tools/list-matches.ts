import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_matches",
  title: "Listar jogos",
  description: "Lista jogos (passados ou futuros) acessíveis ao utilizador, com resultado e estado do relatório.",
  inputSchema: {
    from_date: z.string().optional().describe("Data mínima ISO (YYYY-MM-DD)."),
    to_date: z.string().optional().describe("Data máxima ISO (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de jogos (por omissão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("matches")
      .select("id, match_date, opponent_name, is_home, competition, goals_for, goals_against, status, report_status, location")
      .eq("is_deleted", false)
      .order("match_date", { ascending: false })
      .limit(limit ?? 25);
    if (from_date) query = query.gte("match_date", from_date);
    if (to_date) query = query.lte("match_date", to_date);
    const { data, error } = await query;
    if (error) return dbError(error.message);
    return jsonResult(data ?? []);
  },
});
