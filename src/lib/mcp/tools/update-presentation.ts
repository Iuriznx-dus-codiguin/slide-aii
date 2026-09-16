import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { asJson } from "../json";

export default defineTool({
  name: "update_presentation",
  title: "Update presentation details",
  description:
    "Rename a presentation, change its description, or publish/unpublish it. Slides are not modified.",
  inputSchema: {
    slug: z.string().trim().min(1).max(200).describe("The presentation slug to update."),
    title: z.string().trim().min(1).max(200).optional().describe("New title."),
    description: z.string().trim().max(1000).optional().describe("New description."),
    is_published: z.boolean().optional().describe("Whether the presentation is publicly shareable."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, title, description, is_published }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (is_published !== undefined) patch.is_published = is_published;
    if (Object.keys(patch).length === 0) {
      return {
        content: [{ type: "text", text: "Nothing to update: provide title, description or is_published." }],
        isError: true,
      };
    }

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("presentations")
      .update(patch)
      .eq("slug", slug)
      .is("deleted_at", null)
      .select("id, title, slug, description, is_published")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: `No presentation found for slug "${slug}".` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: asJson({ presentation: data }),
    };
  },
});
