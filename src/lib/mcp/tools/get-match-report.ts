import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_match_report",
  title: "Obter relatório de jogo",
  description: "Devolve os detalhes de um jogo específico, incluindo titulares, banco, partes e minutos configurados.",
  inputSchema: {
    match_id: z.string().uuid().describe("ID do jogo."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ match_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: match, error } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .maybeSingle();
    if (error) return dbError(error.message);
    if (!match) return dbError("Jogo não encontrado ou sem acesso.");

    const { data: events } = await supabase
      .from("match_events")
      .select("*")
      .eq("match_id", match_id)
      .order("minute", { ascending: true });

    return jsonResult({ match, events: events ?? [] });
  },
});
