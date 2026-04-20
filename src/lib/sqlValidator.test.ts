import { describe, it, expect } from 'vitest'
import { validateSql, enforceLimitClause } from './sqlValidator'

// ─── Valid queries ────────────────────────────────────────────────────────────

describe('validateSql — valid queries', () => {
  it('allows a simple SELECT', () => {
    const result = validateSql('SELECT id, total FROM orders WHERE site_id = $1 LIMIT 100')
    expect(result.valid).toBe(true)
  })

  it('allows a CTE (WITH ... SELECT)', () => {
    const result = validateSql(`
      WITH monthly AS (
        SELECT DATE_TRUNC('month', event_date) AS month, SUM(total) AS revenue
        FROM orders WHERE status = 'completed' GROUP BY 1
      )
      SELECT * FROM monthly LIMIT 12
    `)
    expect(result.valid).toBe(true)
  })

  it('allows JOINs across allowed tables', () => {
    const result = validateSql(`
      SELECT a.name, SUM(o.total)
      FROM orders o
      JOIN accounts a ON a.id = o.account_id
      WHERE o.site_id = '123' AND o.status = 'completed'
      GROUP BY a.id
      LIMIT 50
    `)
    expect(result.valid).toBe(true)
  })

  it('allows order_items join with menu_items', () => {
    const result = validateSql(`
      SELECT mi.name, SUM(oi.quantity) AS units
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.site_id = 'abc'
      LIMIT 100
    `)
    expect(result.valid).toBe(true)
  })

  it('allows budget table', () => {
    const result = validateSql(`SELECT * FROM budget WHERE site_id = 'x' LIMIT 20`)
    expect(result.valid).toBe(true)
  })
})

// ─── Blocked DML ──────────────────────────────────────────────────────────────

describe('validateSql — blocked DML statements', () => {
  it('blocks INSERT', () => {
    const r = validateSql("INSERT INTO orders (id) VALUES ('1')")
    expect(r.valid).toBe(false)
  })

  it('blocks UPDATE', () => {
    const r = validateSql("UPDATE orders SET status = 'cancelled' WHERE id = '1' LIMIT 1")
    expect(r.valid).toBe(false)
  })

  it('blocks DELETE', () => {
    const r = validateSql("DELETE FROM orders WHERE id = '1'")
    expect(r.valid).toBe(false)
  })

  it('blocks TRUNCATE', () => {
    const r = validateSql('TRUNCATE TABLE orders')
    expect(r.valid).toBe(false)
  })

  it('blocks DROP TABLE', () => {
    const r = validateSql('DROP TABLE orders')
    expect(r.valid).toBe(false)
  })

  it('blocks ALTER TABLE', () => {
    const r = validateSql('ALTER TABLE orders ADD COLUMN foo TEXT')
    expect(r.valid).toBe(false)
  })

  it('blocks CREATE TABLE', () => {
    const r = validateSql('CREATE TABLE evil (id UUID)')
    expect(r.valid).toBe(false)
  })

  it('blocks GRANT', () => {
    const r = validateSql('GRANT ALL ON orders TO public')
    expect(r.valid).toBe(false)
  })

  it('blocks EXECUTE', () => {
    const r = validateSql('EXECUTE some_function()')
    expect(r.valid).toBe(false)
  })
})

// ─── Blocked schema references ────────────────────────────────────────────────

describe('validateSql — blocked schema/object references', () => {
  it('blocks pg_* catalog references', () => {
    const r = validateSql('SELECT * FROM pg_tables LIMIT 10')
    expect(r.valid).toBe(false)
  })

  it('blocks pg_stat_user_tables', () => {
    const r = validateSql('SELECT * FROM pg_stat_user_tables LIMIT 10')
    expect(r.valid).toBe(false)
  })

  it('blocks information_schema', () => {
    const r = validateSql('SELECT * FROM information_schema.tables LIMIT 10')
    expect(r.valid).toBe(false)
  })

  it('blocks auth.* references', () => {
    const r = validateSql('SELECT * FROM auth.users LIMIT 10')
    expect(r.valid).toBe(false)
  })

  it('blocks storage.* references', () => {
    const r = validateSql('SELECT * FROM storage.objects LIMIT 10')
    expect(r.valid).toBe(false)
  })
})

// ─── LIMIT enforcement ────────────────────────────────────────────────────────

describe('validateSql — LIMIT requirement', () => {
  it('rejects queries without LIMIT', () => {
    const r = validateSql('SELECT * FROM orders WHERE site_id = $1')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/LIMIT/i)
  })

  it('accepts queries with LIMIT', () => {
    const r = validateSql('SELECT * FROM orders WHERE site_id = $1 LIMIT 500')
    expect(r.valid).toBe(true)
  })
})

// ─── enforceLimitClause ───────────────────────────────────────────────────────

describe('enforceLimitClause', () => {
  it('appends LIMIT 10000 when missing', () => {
    const out = enforceLimitClause('SELECT * FROM orders WHERE site_id = $1')
    expect(out).toContain('LIMIT 10000')
  })

  it('leaves LIMIT 100 unchanged', () => {
    const out = enforceLimitClause('SELECT * FROM orders LIMIT 100')
    expect(out).toMatch(/LIMIT 100/)
    expect(out).not.toMatch(/LIMIT 10000/)
  })

  it('replaces LIMIT 99999 with LIMIT 10000', () => {
    const out = enforceLimitClause('SELECT * FROM orders LIMIT 99999')
    expect(out).toContain('LIMIT 10000')
    expect(out).not.toContain('99999')
  })

  it('removes trailing semicolon before appending LIMIT', () => {
    const out = enforceLimitClause('SELECT * FROM orders;')
    expect(out).not.toContain(';')
    expect(out).toContain('LIMIT 10000')
  })
})
