import { supabase } from './supabase'
import { parseChartSpecResponse } from './chartSpec'
import type { ChartSpec, ChatMessage } from '../types'

export interface GenerateViewResult {
  spec: ChartSpec
  rawResponse: string
}

export interface GenerateViewError {
  clarifying_question?: string
  error: string
}

/**
 * Send a user message to the Claude Edge Function and parse the response.
 * Conversation history is passed so follow-up prompts work.
 */
export async function generateView(
  userMessage: string,
  history: ChatMessage[],
  sessionUserId: string,
  siteId?: string
): Promise<GenerateViewResult | GenerateViewError> {
  const messages = [
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const { data, error } = await supabase.functions.invoke<{ content: string }>('generate-view', {
    body: { messages, session_user_id: sessionUserId, site_id: siteId },
  })

  if (error) {
    // Supabase stores the raw Response in error.context — read the body to get the real message
    let message = error.message
    try {
      const ctx = (error as unknown as { context?: unknown }).context
      if (ctx instanceof Response) {
        const text = await ctx.text()
        try {
          const body = JSON.parse(text) as { error?: string }
          if (body?.error) message = body.error
          else if (text) message = text
        } catch {
          if (text) message = text
        }
      } else if (ctx && typeof ctx === 'object' && 'error' in ctx) {
        message = String((ctx as { error: unknown }).error)
      } else if (typeof ctx === 'string' && ctx) {
        message = ctx
      }
    } catch {
      // ignore — fall back to generic message
    }
    return { error: message }
  }

  if (!data?.content) {
    return { error: 'Empty response from AI' }
  }

  try {
    const parsed = parseChartSpecResponse(data.content)

    if ('clarifying_question' in parsed) {
      return { clarifying_question: parsed.clarifying_question, error: '' }
    }

    return { spec: parsed, rawResponse: data.content }
  } catch (parseError) {
    return {
      error: `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    }
  }
}
