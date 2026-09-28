import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_players",
  title: "Listar jogadores",
  description: "Lista jogadores acessíveis ao utilizador, opcionalmente filtrados por equipa. Não devolve dados pessoais sensíveis de menores.",
  inputSchema: {
    team_id: z.string().uuid().optional().describe("ID da equipa para filtrar."),
    only_active: z.boolean().optional().describe("Se verdadeiro, devolve apenas jogadores ativos."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de jogadores (por omissão 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, only_active, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("players")
      .select("id, name, number, position, secondary_positions, foot, status, is_active, team_id")
      .order("number", { nullsFirst: false })
      .limit(limit ?? 100);
    if (team_id) query = query.eq("team_id", team_id);
    if (only_active) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) return dbError(error.message);
    return jsonResult(data ?? []);
  },
});
