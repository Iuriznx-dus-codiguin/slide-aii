import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPresentationsTool from "./tools/list-presentations";
import getPresentationTool from "./tools/get-presentation";
import getCreditBalanceTool from "./tools/get-credit-balance";
import searchHelpArticlesTool from "./tools/search-help-articles";
import updatePresentationTool from "./tools/update-presentation";

// O issuer OAuth precisa ser o host direto do Supabase (nunca o proxy).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "slideai",
  title: "SlideAI",
  version: "0.1.0",
  instructions:
    "Tools for SlideAI, an AI presentation builder. Use `list_presentations` and `get_presentation` to read the signed-in user's decks and slide content, `update_presentation` to rename, re-describe or publish a deck, `get_credit_balance` to check plan and remaining credits, and `search_help_articles` to answer product questions from the official help center. All tools act as the signed-in SlideAI user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listPresentationsTool,
    getPresentationTool,
    updatePresentationTool,
    getCreditBalanceTool,
    searchHelpArticlesTool,
  ],
});
