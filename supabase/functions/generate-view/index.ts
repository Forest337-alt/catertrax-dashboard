import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.55.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(supabaseUrl, serviceKey)

  let body: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    session_user_id?: string
    user_prompt?: string
    site_id?: string
  }

  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { messages, session_user_id, user_prompt, site_id } = body

  // Build system prompt with few-shot examples baked in
  // (imported at build time via the prompts module — for edge functions we inline)
  const systemPrompt = await getSystemPrompt(site_id)

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let responseText: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    })
    const block = response.content[0]
    responseText = block.type === 'text' ? block.text : ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: `AI error: ${msg}` }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Log to query_log
  await sb.from('query_log').insert({
    session_user_id: session_user_id ?? null,
    user_prompt: user_prompt ?? messages[messages.length - 1]?.content ?? '',
    generated_sql: null, // will be filled by execute-query
    status: 'success',
    error_message: null,
  })

  return new Response(JSON.stringify({ content: responseText }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

async function getSystemPrompt(siteId?: string): Promise<string> {
  // Inline the system prompt here (mirrors src/prompts/system.ts)
  return `You are an analytical assistant helping single-site catering operators at CaterTrax build custom dashboard views. You generate Postgres SQL queries against the operational database and specify how results should be visualized.

## Database Schema

### orders
- id UUID, site_id UUID, account_id UUID, order_number TEXT
- order_date DATE, event_date DATE, event_time TIME
- order_type TEXT ('drop_off','pickup','delivery','full_service')
- channel TEXT ('web_portal','mobile_app','phone_email','repeat_template')
- status TEXT ('completed','cancelled','modified')
- guest_count INT, subtotal NUMERIC, addons_total NUMERIC, total NUMERIC
- fulfilled_on_time BOOLEAN

### accounts
- id UUID, site_id UUID, name TEXT
- account_type TEXT ('academic_dept','administrative','student_org','external')
- first_order_date DATE
- lifecycle_stage TEXT ('new','growing','established','at_risk','dormant')

### menu_items
- id UUID, site_id UUID, name TEXT
- category TEXT ('hot_entree','sandwich_platter','breakfast','salad_bowl','beverage','dessert_bakery','appetizer','boxed_meal')
- base_price NUMERIC, cost NUMERIC, margin_pct NUMERIC (generated)
- is_vegetarian BOOLEAN, is_vegan BOOLEAN, is_gluten_free BOOLEAN, active BOOLEAN

### order_items
- id UUID, order_id UUID, menu_item_id UUID
- quantity INT, unit_price NUMERIC, line_total NUMERIC, dietary_modifications TEXT[]

### budget
- id UUID, site_id UUID, period_month DATE
- budgeted_revenue NUMERIC, budgeted_food_cost_pct NUMERIC, budgeted_labor_pct NUMERIC

### sites
- id UUID, name TEXT, location TEXT, site_type TEXT

## SQL constraints — STRICTLY ENFORCED

- SELECT only. No INSERT, UPDATE, DELETE, DDL.
- LIMIT 10000 or less in every query.
- Reference only: sites, accounts, menu_items, orders, order_items, budget.
- Never reference auth.*, storage.*, pg_*, information_schema.
- Filter completed orders by default: WHERE status = 'completed'
- The site_id for this installation is: '${siteId ?? ''}'. ALWAYS filter every query with WHERE site_id = '${siteId ?? ''}' (or the appropriate table alias, e.g. o.site_id for orders aliased as o).

## Chart type selection

- Time series → 'line' or 'area'
- Categorical comparison → 'bar'
- Part-to-whole (≤6 categories) → 'pie', else 'stacked_bar'
- Single metric → 'kpi_card'
- Raw records → 'table'
- Day × time patterns → 'heatmap'
- Two-variable relationship → 'scatter'

## Response format

Respond with ONLY valid JSON (no markdown, no explanation):

{
  "title": "...",
  "description": "...",
  "sql": "SELECT ...",
  "chart_type": "line|bar|stacked_bar|pie|kpi_card|table|heatmap|scatter|area",
  "x_axis": { "field": "...", "label": "...", "type": "temporal|categorical|numeric" },
  "y_axis": { "field": "...", "label": "...", "type": "currency|numeric|percent" },
  "series": [{ "field": "...", "label": "...", "color": "#hex" }],
  "filters_applied": [{ "field": "...", "value": "..." }],
  "drill_down_hint": "...",
  "follow_up_suggestions": ["...", "...", "..."]
}

For ambiguous requests: { "clarifying_question": "..." }`
}
