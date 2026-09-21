// OWNED MANUALLY — o banner de auto-geração foi removido de propósito.
// O plugin @lovable.dev/mcp-js esvaziava este arquivo a cada build; sem o banner
// ele deixa o arquivo intacto. Ao alterar src/lib/mcp/*, reflita aqui à mão.
// supabase function: mcp
// Bundled from src/lib/mcp/index.ts by @lovable.dev/mcp-js.
// src/lib/mcp/index.ts
import { auth, defineMcp } from "npm:@lovable.dev/mcp-js@2.0.4";

// src/lib/mcp/tools/list-presentations.ts
import { defineTool } from "npm:@lovable.dev/mcp-js@2.0.4";
import { z } from "npm:zod@^3.25.76";

// src/lib/mcp/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@^2.103.3";
function runtimeEnv(name) {
  const runtime = globalThis;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}
function configuredEnv(names) {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return void 0;
}
function supabaseProjectUrl() {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}
function supabasePublishableKey() {
  const direct = configuredEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY"
  ]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed;
        const key = [keys.default, ...Object.values(keys)].find((v) => typeof v === "string" && v.trim().startsWith("sb_publishable_"))?.trim();
        if (key) return key;
      }
    } catch {
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}
function supabaseForUser(ctx) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// src/lib/mcp/json.ts
function asJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

// src/lib/mcp/tools/list-presentations.ts
var list_presentations_default = defineTool({
  name: "list_presentations",
  title: "List presentations",
  description: "List the signed-in user's SlideAI presentations, newest first, with title, slug, slide count and views.",
  inputSchema: {
    search: z.string().trim().max(120).optional().describe("Optional text to match against the title."),
    limit: z.number().int().min(1).max(50).optional().describe("How many presentations to return (default 20).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("presentations").select("id, title, slug, description, slides_count, view_count, is_published, language, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit ?? 20);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: asJson({ presentations: data ?? [] })
    };
  }
});

// src/lib/mcp/tools/get-presentation.ts
import { defineTool as defineTool2 } from "npm:@lovable.dev/mcp-js@2.0.4";
import { z as z2 } from "npm:zod@^3.25.76";
var get_presentation_default = defineTool2({
  name: "get_presentation",
  title: "Get presentation",
  description: "Read one of the signed-in user's presentations by slug, including every slide's content and speaker notes.",
  inputSchema: {
    slug: z2.string().trim().min(1).max(200).describe("The presentation slug, as returned by list_presentations."),
    include_slides: z2.boolean().optional().describe("Include full slide content (default true).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, include_slides }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: presentation, error } = await supabase.from("presentations").select(
      "id, title, slug, description, type, language, theme, slides_count, view_count, is_published, persona, depth_level, created_at"
    ).eq("slug", slug).is("deleted_at", null).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!presentation) {
      return { content: [{ type: "text", text: `No presentation found for slug "${slug}".` }], isError: true };
    }
    let slides = [];
    if (include_slides !== false) {
      const { data: rows, error: slidesError } = await supabase.from("slides").select("position, slide_type, layout_template, content, speaker_notes").eq("presentation_id", presentation.id).order("position", { ascending: true });
      if (slidesError) return { content: [{ type: "text", text: slidesError.message }], isError: true };
      slides = rows ?? [];
    }
    const payload = { presentation, slides };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: asJson(payload)
    };
  }
});

// src/lib/mcp/tools/get-credit-balance.ts
import { defineTool as defineTool3 } from "npm:@lovable.dev/mcp-js@2.0.4";
import { z as z3 } from "npm:zod@^3.25.76";
var get_credit_balance_default = defineTool3({
  name: "get_credit_balance",
  title: "Get credit balance",
  description: "Read the signed-in user's SlideAI plan, subscription status and available credits (monthly quota plus permanent bonus).",
  inputSchema: {
    include_history: z3.boolean().optional().describe("Also return the 10 most recent credit movements (default false).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_history }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: profile, error } = await supabase.from("profiles").select(
      "plan, subscription_status, subscription_renews_at, credits_bonus, credits_monthly, generations_count, total_views"
    ).eq("id", ctx.getUserId()).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!profile) return { content: [{ type: "text", text: "Profile not found." }], isError: true };
    const payload = {
      ...profile,
      credits_available: (profile.credits_bonus ?? 0) + (profile.credits_monthly ?? 0)
    };
    if (include_history) {
      const { data: history } = await supabase.from("credit_transactions").select("type, amount, created_at").order("created_at", { ascending: false }).limit(10);
      payload.recent_transactions = history ?? [];
    }
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: asJson(payload)
    };
  }
});

// src/lib/mcp/tools/search-help-articles.ts
import { defineTool as defineTool4 } from "npm:@lovable.dev/mcp-js@2.0.4";
import { z as z4 } from "npm:zod@^3.25.76";
var search_help_articles_default = defineTool4({
  name: "search_help_articles",
  title: "Search help articles",
  description: "Search SlideAI's published help center articles by title, category or keyword.",
  inputSchema: {
    query: z4.string().trim().min(2).max(120).describe("What to look for, e.g. 'cr\xE9ditos' or 'reembolso'."),
    limit: z4.number().int().min(1).max(20).optional().describe("How many articles to return (default 5).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const term = `%${query}%`;
    const { data, error } = await supabase.from("help_articles").select("slug, title, category, content_md").eq("is_published", true).or(`title.ilike.${term},category.ilike.${term},content_md.ilike.${term}`).limit(limit ?? 5);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const articles = (data ?? []).map((a) => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      excerpt: (a.content_md ?? "").slice(0, 800),
      url: `https://slideai.com.br/ajuda/${a.slug}`
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(articles, null, 2) }],
      structuredContent: asJson({ articles })
    };
  }
});

// src/lib/mcp/tools/update-presentation.ts
import { defineTool as defineTool5 } from "npm:@lovable.dev/mcp-js@2.0.4";
import { z as z5 } from "npm:zod@^3.25.76";
var update_presentation_default = defineTool5({
  name: "update_presentation",
  title: "Update presentation details",
  description: "Rename a presentation, change its description, or publish/unpublish it. Slides are not modified.",
  inputSchema: {
    slug: z5.string().trim().min(1).max(200).describe("The presentation slug to update."),
    title: z5.string().trim().min(1).max(200).optional().describe("New title."),
    description: z5.string().trim().max(1e3).optional().describe("New description."),
    is_published: z5.boolean().optional().describe("Whether the presentation is publicly shareable.")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, title, description, is_published }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const patch = {};
    if (title !== void 0) patch.title = title;
    if (description !== void 0) patch.description = description;
    if (is_published !== void 0) patch.is_published = is_published;
    if (Object.keys(patch).length === 0) {
      return {
        content: [{ type: "text", text: "Nothing to update: provide title, description or is_published." }],
        isError: true
      };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("presentations").update(patch).eq("slug", slug).is("deleted_at", null).select("id, title, slug, description, is_published").maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: `No presentation found for slug "${slug}".` }],
        isError: true
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: asJson({ presentation: data })
    };
  }
});

// src/lib/mcp/index.ts
var projectRef = "goistdwnwksaskbffsni";
var mcp_default = defineMcp({
  name: "slideai",
  title: "SlideAI",
  version: "0.1.0",
  instructions: "Tools for SlideAI, an AI presentation builder. Use `list_presentations` and `get_presentation` to read the signed-in user's decks and slide content, `update_presentation` to rename, re-describe or publish a deck, `get_credit_balance` to check plan and remaining credits, and `search_help_articles` to answer product questions from the official help center. All tools act as the signed-in SlideAI user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated"
  }),
  tools: [
    list_presentations_default,
    get_presentation_default,
    update_presentation_default,
    get_credit_balance_default,
    search_help_articles_default
  ]
});

// lovable-mcp-supabase-entry.ts
import { createSupabaseHandler } from "npm:@lovable.dev/mcp-js@2.0.4/stacks/supabase";
Deno.serve(createSupabaseHandler(mcp_default, { functionName: "mcp" }));
