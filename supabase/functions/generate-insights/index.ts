import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { revenuePaceAnomaly } from '../insights/revenuePaceAnomaly.ts'
import { foodCostDrift } from '../insights/foodCostDrift.ts'
import { dormantAccountRisk } from '../insights/dormantAccountRisk.ts'

const GENERATORS = [
  revenuePaceAnomaly,
  foodCostDrift,
  dormantAccountRisk,
]

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id')

  if (sitesError || !sites) {
    return new Response(JSON.stringify({ error: 'Failed to fetch sites', detail: sitesError?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results = {
    sites_processed: 0,
    generators_run: 0,
    insights_emitted: 0,
    errors: [] as string[],
  }

  const now = new Date()

  for (const site of sites) {
    results.sites_processed++

    for (const generator of GENERATORS) {
      results.generators_run++

      try {
        // Skip if an active insight of this type already exists for this site
        const { data: existing } = await supabase
          .from('insights')
          .select('id')
          .eq('site_id', site.id)
          .eq('insight_type', generator.type)
          .eq('active', true)
          .gt('expires_at', now.toISOString())
          .limit(1)

        if (existing && existing.length > 0) continue

        // Run the generator
        const insights = await generator.generate({ supabase, siteId: site.id, now })

        // Write each emitted insight
        for (const insight of insights) {
          const { error: insertError } = await supabase
            .from('insights')
            .insert({
              site_id: site.id,
              ...insight,
              evidence: insight.evidence,
              expires_at: insight.expires_at.toISOString(),
              active: true,
            })

          if (insertError) {
            results.errors.push(`insert ${generator.type} on ${site.id}: ${insertError.message}`)
          } else {
            results.insights_emitted++
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results.errors.push(`${generator.type} on ${site.id}: ${msg}`)
      }
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
