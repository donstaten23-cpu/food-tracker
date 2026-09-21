// Turns a free-text food description ("two scrambled eggs and a slice of
// toast with butter") into a structured calorie/macro estimate using the
// Claude API. The API key never reaches the browser — this function is the
// only thing that calls Anthropic.
//
// Deploy via the Supabase Dashboard -> Edge Functions -> "Deploy a new
// function" (paste this file's contents), or `supabase functions deploy
// estimate-food` if you have the CLI installed.
//
// Required secret (Dashboard -> Edge Functions -> estimate-food -> Secrets,
// or `supabase secrets set ANTHROPIC_API_KEY=...`):
//   ANTHROPIC_API_KEY  — from https://console.anthropic.com/settings/keys
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime — no need to set them yourself.

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const ANTHROPIC_MODEL = "claude-sonnet-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserId(req: Request, admin: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}

// Forces Claude to respond with this exact shape instead of prose, by making
// it the only "tool" available and requiring the model to call it.
const LOG_FOOD_TOOL = {
  name: "log_food",
  description: "Record a structured calorie/macro estimate for the food(s) described.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "One entry per distinct food item mentioned.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short name, e.g. 'scrambled egg', 'wheat toast'." },
            quantity: { type: "number", description: "Numeric amount, e.g. 2, 1, 0.5." },
            unit: { type: "string", description: "Unit the quantity is in, e.g. 'egg', 'slice', 'oz', 'cup', 'g'." },
            calories: { type: "number" },
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fat_g: { type: "number" },
          },
          required: ["name", "quantity", "unit", "calories", "protein_g", "carbs_g", "fat_g"],
        },
      },
      total: {
        type: "object",
        description: "Sum of all items.",
        properties: {
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
        required: ["calories", "protein_g", "carbs_g", "fat_g"],
      },
      notes: {
        type: "string",
        description: "Brief note on assumptions made for vague quantities/preparations (e.g. 'assumed large eggs, 1 tbsp butter'). Empty string if the description was already precise.",
      },
    },
    required: ["items", "total", "notes"],
  },
};

const SYSTEM_PROMPT = `You are a nutrition estimation assistant inside a personal food-logging app.
Given a free-text description of food someone ate, break it into individual
items and estimate calories and macros (grams of protein/carbs/fat) for each,
using standard/typical values (USDA-style) for common preparations and
serving sizes when the description doesn't give exact amounts. Prefer
realistic home/restaurant portions over minimums. State any notable
assumptions briefly in \`notes\`. Always respond by calling the log_food tool
— never respond with plain text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const userId = await getUserId(req, admin);
  if (!userId) return json({ error: "unauthorized" }, 401);

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY secret is not set on this function" }, 500);
  }

  let body: { description?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const description = (body.description || "").trim();
  if (!description) return json({ error: "missing description" }, 400);

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [LOG_FOOD_TOOL],
        tool_choice: { type: "tool", name: "log_food" },
        messages: [{ role: "user", content: description }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json({ error: data.error?.message || "Claude API request failed" }, 502);
    }

    const toolUse = (data.content || []).find((block: { type: string }) => block.type === "tool_use");
    if (!toolUse) return json({ error: "model did not return a structured estimate" }, 502);

    return json({ estimate: toolUse.input, raw_description: description });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
