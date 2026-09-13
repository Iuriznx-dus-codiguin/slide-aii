import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_presentations",
  title: "List presentations",
  description:
    "List the signed-in user's SlideAI presentations, newest first, with title, slug, slide count and views.",
  inputSchema: {
    search: z.string().trim().max(120).optional().describe("Optional text to match against the title."),
    limit: z.number().int().min(1).max(50).optional().describe("How many presentations to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("presentations")
      .select("id, title, slug, description, slides_count, view_count, is_published, language, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { presentations: data ?? [] },
    };
  },
});
