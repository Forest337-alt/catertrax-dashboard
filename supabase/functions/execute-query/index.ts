import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ROWS = 10000
const TIMEOUT_MS = 5000

// Blocked patterns (mirrors src/lib/sqlValidator.ts — run server-side as authoritative check)
const BLOCKED = [
  /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|EXECUTE|EXEC|CALL)\b/i,
  /\bINTO\s+\w+/i,
  /\bCOPY\b/i,
  /\bpg_[a-z_]+\b/i,
  /\binformation_schema\b/i,
  /\bauth\./i,
  /\bstorage\./i,
]

function validateSql(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim()
  if (!/^\s*(WITH\b|SELECT\b)/i.test(trimmed)) {
    return { valid: false, error: 'Only SELECT statements are allowed.' }
  }
  for (const p of BLOCKED) {
    if (p.test(trimmed)) return { valid: false, error: 'Query contains a disallowed statement or reference.' }
  }
  return { valid: true }
}

function enforceLimitClause(sql: string): string {
  const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i)
  if (!limitMatch) return sql.trimEnd().replace(/;?\s*$/, '') + `\nLIMIT ${MAX_ROWS}`
  const n = parseInt(limitMatch[1], 10)
  if (n > MAX_ROWS) return sql.replace(/\bLIMIT\s+\d+/i, `LIMIT ${MAX_ROWS}`)
  return sql
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(supabaseUrl, serviceKey)

  let body: { sql: string; session_user_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { sql, session_user_id } = body
  const startMs = Date.now()

  // Validate
  const validation = validateSql(sql)
  if (!validation.valid) {
    await logQuery(sb, session_user_id, sql, 'validation_failed', validation.error)
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const safeSql = enforceLimitClause(sql)

  // Execute via rpc (statement_timeout set in db)
  let rows: unknown[]
  try {
    const { data, error } = await sb.rpc('execute_readonly_query', { query: safeSql })
    if (error) throw new Error(error.message)
    rows = (data as unknown[]) ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('canceling')
    await logQuery(sb, session_user_id, sql, isTimeout ? 'timeout' : 'execution_failed', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const executionMs = Date.now() - startMs
  await logQuery(sb, session_user_id, sql, 'success', undefined, rows.length, executionMs)

  return new Response(JSON.stringify({ rows, row_count: rows.length, execution_ms: executionMs }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

async function logQuery(
  sb: ReturnType<typeof createClient>,
  sessionUserId: string | undefined,
  sql: string,
  status: string,
  errorMessage?: string,
  rowCount?: number,
  executionMs?: number,
) {
  await sb.from('query_log').insert({
    session_user_id: sessionUserId ?? null,
    user_prompt: '(direct query)',
    generated_sql: sql,
    status,
    error_message: errorMessage ?? null,
    row_count: rowCount ?? null,
    execution_ms: executionMs ?? null,
  })
}
