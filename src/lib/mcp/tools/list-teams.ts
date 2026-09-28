import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_teams",
  title: "Listar equipas",
  description: "Lista as equipas acessíveis ao utilizador autenticado (nome, escalão, modalidade, época).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Número máximo de equipas a devolver (por omissão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("teams")
      .select("id, name, category, gender, sport_type, season, formation")
      .order("name")
      .limit(limit ?? 50);
    if (error) return dbError(error.message);
    return jsonResult(data ?? []);
  },
});
