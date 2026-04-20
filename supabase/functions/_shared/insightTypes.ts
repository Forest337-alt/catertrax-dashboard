import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightPriority = 'high' | 'medium' | 'low'
export type InsightConfidence = 'High' | 'Medium' | 'Low'

export interface GeneratedInsight {
  insight_type: string
  priority: InsightPriority
  confidence: InsightConfidence
  category: string
  headline: string
  observation: string
  interpretation: string
  recommendation: string
  evidence: Array<{ label: string; value: string }>
  action_label: string
  expires_at: Date
}

export interface GeneratorContext {
  supabase: SupabaseClient
  siteId: string
  now: Date
}

export interface InsightGenerator {
  type: string
  description: string
  generate(ctx: GeneratorContext): Promise<GeneratedInsight[]>
}

// ─── Query helper ─────────────────────────────────────────────────────────────
// Executes a SQL string via the run_insight_query RPC (service role, readonly).
// Returns an array of typed row objects.

export async function runQuery<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  sql: string
): Promise<T[]> {
  const { data, error } = await supabase.rpc('run_insight_query', { query_text: sql })
  if (error) throw new Error(`run_insight_query failed: ${error.message}`)
  if (!data) return []
  // run_insight_query returns a JSONB array; data is already parsed by the JS client
  return data as T[]
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function fmt$(n: number, decimals = 0): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtPct(n: number, decimals = 1): string {
  return n.toFixed(decimals) + '%'
}
