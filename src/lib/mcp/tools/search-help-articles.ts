import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_help_articles",
  title: "Search help articles",
  description: "Search SlideAI's published help center articles by title, category or keyword.",
  inputSchema: {
    query: z.string().trim().min(2).max(120).describe("What to look for, e.g. 'créditos' or 'reembolso'."),
    limit: z.number().int().min(1).max(20).optional().describe("How many articles to return (default 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const term = `%${query}%`;
    const { data, error } = await supabase
      .from("help_articles")
      .select("slug, title, category, content_md")
      .eq("is_published", true)
      .or(`title.ilike.${term},category.ilike.${term},content_md.ilike.${term}`)
      .limit(limit ?? 5);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const articles = (data ?? []).map((a) => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      excerpt: (a.content_md ?? "").slice(0, 800),
      url: `https://slideai.com.br/ajuda/${a.slug}`,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(articles, null, 2) }],
      structuredContent: { articles },
    };
  },
});
