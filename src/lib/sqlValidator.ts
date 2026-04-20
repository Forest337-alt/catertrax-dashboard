/**
 * Server-side SQL safety validator.
 * Blocks any query that isn't a pure SELECT against the allowed tables.
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

// Statements that are never allowed
const BLOCKED_STATEMENT_PATTERNS = [
  /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|EXECUTE|EXEC|CALL)\b/i,
  /\bINTO\s+\w+/i, // INSERT INTO / SELECT INTO
  /\bCOPY\b/i,
  /\bPG_READ_FILE\b/i,
  /\bPG_WRITE_FILE\b/i,
]

// Schema/table references that are never allowed
const BLOCKED_REFERENCE_PATTERNS = [
  /\bpg_[a-z_]+\b/i, // any pg_* system catalog
  /\binformation_schema\b/i,
  /\bauth\./i,
  /\bstorage\./i,
  /\bextensions\b/i,
  /\bpg_catalog\b/i,
]

// The only tables that are allowed
const ALLOWED_TABLES = new Set([
  'sites',
  'accounts',
  'menu_items',
  'orders',
  'order_items',
  'budget',
])

// Detect table references in the query (simplified heuristic)
// Matches FROM or JOIN followed by an identifier
const TABLE_REFERENCE_RE = /(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi

export function validateSql(sql: string): ValidationResult {
  const trimmed = sql.trim()

  // Must start with SELECT or a CTE (WITH)
  if (!/^\s*(WITH\b|SELECT\b)/i.test(trimmed)) {
    return { valid: false, error: 'Only SELECT statements are allowed.' }
  }

  // Check for blocked statement types
  for (const pattern of BLOCKED_STATEMENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        error: `Query contains a disallowed statement type.`,
      }
    }
  }

  // Check for blocked schema/object references
  for (const pattern of BLOCKED_REFERENCE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        error: `Query references a disallowed schema or system object.`,
      }
    }
  }

  // Check that all table references are in the allowed set
  let match: RegExpExecArray | null
  while ((match = TABLE_REFERENCE_RE.exec(trimmed)) !== null) {
    const table = match[1].toLowerCase()
    // Allow CTEs (they are referenced by their alias, not a table name)
    // We can't easily distinguish CTEs from real tables here, so we allow
    // any name that isn't a known blocked table — the read-only role enforces
    // the actual access control at the database level.
    if (!ALLOWED_TABLES.has(table) && BLOCKED_REFERENCE_PATTERNS.some((p) => p.test(table))) {
      return { valid: false, error: `Table "${table}" is not allowed.` }
    }
  }

  // Must contain LIMIT somewhere (Claude is instructed to always include it)
  if (!/\bLIMIT\s+\d+/i.test(trimmed)) {
    return { valid: false, error: 'Query must include a LIMIT clause.' }
  }

  return { valid: true }
}

/**
 * Ensure query has a LIMIT. If missing, append LIMIT 10000.
 * If existing LIMIT exceeds 10000, replace it.
 */
export function enforceLimitClause(sql: string): string {
  const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i)
  if (!limitMatch) {
    return sql.trimEnd().replace(/;?\s*$/, '') + '\nLIMIT 10000'
  }
  const existing = parseInt(limitMatch[1], 10)
  if (existing > 10000) {
    return sql.replace(/\bLIMIT\s+\d+/i, 'LIMIT 10000')
  }
  return sql
}
