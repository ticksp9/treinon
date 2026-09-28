import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_trainings",
  title: "Listar treinos",
  description: "Lista sessões de treino acessíveis ao utilizador, opcionalmente filtradas por equipa e intervalo de datas.",
  inputSchema: {
    team_id: z.string().uuid().optional().describe("ID da equipa para filtrar."),
    from_date: z.string().optional().describe("Data mínima ISO (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de sessões (por omissão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, from_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("training_sessions")
      .select("*")
      .order("session_date", { ascending: false })
      .limit(limit ?? 25);
    if (team_id) query = query.eq("team_id", team_id);
    if (from_date) query = query.gte("session_date", from_date);
    const { data, error } = await query;
    if (error) return dbError(error.message);
    return jsonResult(data ?? []);
  },
});
