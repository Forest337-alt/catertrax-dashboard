/**
 * Standalone seed script — replaces all suggested views with the 32 spec views.
 * Run: npm run seed:views
 *
 * Reads VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (or VITE_SUPABASE_ANON_KEY),
 * and VITE_DEMO_SITE_ID from .env.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildSuggestedViews } from './suggestedViews.mjs'

const __dir = dirname(fileURLToPath(import.meta.url))

// Load .env manually (no dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(__dir, '../../.env')
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env file, use existing env */ }
}
loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const SITE_ID     = process.env.VITE_DEMO_SITE_ID

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

if (!SITE_ID) {
  console.error('Missing VITE_DEMO_SITE_ID in .env')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  console.log('🌱 Seeding suggested views...')
  console.log(`   Site ID: ${SITE_ID}`)

  // Delete existing suggested views
  const { error: delErr } = await sb.from('saved_views').delete().eq('is_suggested', true)
  if (delErr) {
    console.error('Failed to delete existing suggested views:', delErr.message)
    process.exit(1)
  }

  // Insert all 32 views
  const views = buildSuggestedViews(SITE_ID)
  const { error: insErr } = await sb.from('saved_views').insert(views)
  if (insErr) {
    console.error('Failed to insert suggested views:', insErr.message)
    process.exit(1)
  }

  console.log(`✓ ${views.length} suggested views seeded`)
}

run().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
