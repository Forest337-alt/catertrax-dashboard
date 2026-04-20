import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useSession } from './session'
import type { Insight, InsightFeedback, InsightFeedbackAction } from '../types'

interface GenerateResult {
  insights_emitted: number
  errors: string[]
}

const SITE_ID = import.meta.env.VITE_DEMO_SITE_ID as string

export function useInsights() {
  const { user } = useSession()
  const [allInsights, setAllInsights] = useState<Insight[]>([])
  const [feedback, setFeedback] = useState<InsightFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    if (!SITE_ID) { setLoading(false); return }

    const now = new Date().toISOString()

    const [{ data: insightData }, { data: fbData }] = await Promise.all([
      supabase
        .from('insights')
        .select('*')
        .eq('site_id', SITE_ID)
        .eq('active', true)
        .gt('expires_at', now)
        .order('generated_at', { ascending: false }),
      user
        ? supabase
            .from('insight_feedback')
            .select('*')
            .eq('session_user_id', user.id)
        : Promise.resolve({ data: [] as InsightFeedback[], error: null }),
    ])

    setAllInsights((insightData ?? []) as Insight[])
    setFeedback((fbData ?? []) as InsightFeedback[])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // Filter out dismissed / snoozed insights for this session user
  const insights = allInsights.filter((insight) => {
    const fb = feedback.find((f) => f.insight_id === insight.id)
    if (!fb) return true
    if (fb.action === 'dismissed') return false
    if (
      fb.action === 'snoozed' &&
      fb.snoozed_until &&
      new Date(fb.snoozed_until) > new Date()
    ) return false
    return true
  })

  const submitFeedback = useCallback(
    async (insightId: string, action: InsightFeedbackAction) => {
      if (!user) return
      const snoozedUntil =
        action === 'snoozed'
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null

      const { data } = await supabase
        .from('insight_feedback')
        .insert({
          insight_id: insightId,
          session_user_id: user.id,
          action,
          snoozed_until: snoozedUntil,
        })
        .select()
        .single()

      if (data) {
        setFeedback((prev) => [
          ...prev.filter((f) => f.insight_id !== insightId),
          data as InsightFeedback,
        ])
      }
    },
    [user]
  )

  const triggerGeneration = useCallback(async (): Promise<GenerateResult> => {
    setGenerating(true)
    try {
      const { data } = await supabase.functions.invoke<GenerateResult>('generate-insights')
      await load()
      return data ?? { insights_emitted: 0, errors: [] }
    } finally {
      setGenerating(false)
    }
  }, [load])

  return {
    insights,
    loading,
    totalActive: allInsights.length,
    submitFeedback,
    reload: load,
    generating,
    triggerGeneration,
  }
}
