import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_credit_balance",
  title: "Get credit balance",
  description:
    "Read the signed-in user's SlideAI plan, subscription status and available credits (monthly quota plus permanent bonus).",
  inputSchema: {
    include_history: z
      .boolean()
      .optional()
      .describe("Also return the 10 most recent credit movements (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_history }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "plan, subscription_status, subscription_renews_at, credits_bonus, credits_monthly, generations_count, total_views",
      )
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!profile) return { content: [{ type: "text", text: "Profile not found." }], isError: true };

    const payload: Record<string, unknown> = {
      ...profile,
      credits_available: (profile.credits_bonus ?? 0) + (profile.credits_monthly ?? 0),
    };

    if (include_history) {
      const { data: history } = await supabase
        .from("credit_transactions")
        .select("type, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      payload.recent_transactions = history ?? [];
    }

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
