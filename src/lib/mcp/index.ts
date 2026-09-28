import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTeams from "./tools/list-teams";
import listPlayers from "./tools/list-players";
import listMatches from "./tools/list-matches";
import listTrainings from "./tools/list-trainings";
import getMatchReport from "./tools/get-match-report";

// Issuer must be the direct Supabase host, built from the project ref literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tacticaflow-mcp",
  title: "TreinON MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do TreinON (gestão desportiva). Permite consultar equipas, jogadores, jogos, treinos e relatórios de jogo do utilizador autenticado. Todas as leituras respeitam as permissões do clube/treinador.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTeams, listPlayers, listMatches, listTrainings, getMatchReport],
});
