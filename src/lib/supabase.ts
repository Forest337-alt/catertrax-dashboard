import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Execute a validated SELECT query via the execute-query Edge Function.
 * Returns rows or throws on validation/execution failure.
 */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  sessionUserId?: string
): Promise<T[]> {
  const { data, error } = await supabase.functions.invoke<{ rows: T[]; row_count: number }>(
    'execute-query',
    {
      body: { sql, session_user_id: sessionUserId ?? null },
    }
  )

  if (error) {
    let message = error.message
    try {
      const ctx = (error as unknown as { context?: unknown }).context
      if (ctx instanceof Response) {
        const text = await ctx.text()
        try { const body = JSON.parse(text) as { error?: string }; if (body?.error) message = body.error; else if (text) message = text }
        catch { if (text) message = text }
      } else if (ctx && typeof ctx === 'object' && 'error' in ctx) {
        message = String((ctx as { error: unknown }).error)
      } else if (typeof ctx === 'string' && ctx) {
        message = ctx
      }
    } catch { /* ignore */ }
    throw new Error(message)
  }
  if (!data) throw new Error('No data returned from execute-query')

  return data.rows
}
