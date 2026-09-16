import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { asJson } from "../json";

export default defineTool({
  name: "get_presentation",
  title: "Get presentation",
  description:
    "Read one of the signed-in user's presentations by slug, including every slide's content and speaker notes.",
  inputSchema: {
    slug: z.string().trim().min(1).max(200).describe("The presentation slug, as returned by list_presentations."),
    include_slides: z.boolean().optional().describe("Include full slide content (default true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, include_slides }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: presentation, error } = await supabase
      .from("presentations")
      .select(
        "id, title, slug, description, type, language, theme, slides_count, view_count, is_published, persona, depth_level, created_at",
      )
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!presentation) {
      return { content: [{ type: "text", text: `No presentation found for slug "${slug}".` }], isError: true };
    }

    let slides: unknown[] = [];
    if (include_slides !== false) {
      const { data: rows, error: slidesError } = await supabase
        .from("slides")
        .select("position, slide_type, layout_template, content, speaker_notes")
        .eq("presentation_id", presentation.id)
        .order("position", { ascending: true });
      if (slidesError) return { content: [{ type: "text", text: slidesError.message }], isError: true };
      slides = rows ?? [];
    }

    const payload = { presentation, slides };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: asJson(payload),
    };
  },
});
