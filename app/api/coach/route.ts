import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import type { ChatMessage } from '@/lib/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MAX_MESSAGE_LENGTH = 2000
const MAX_HISTORY_MESSAGES = 50

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { allowed } = rateLimit(user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const messages: ChatMessage[] = body?.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Validate message history length and content
    const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES)
    for (const msg of trimmedMessages) {
      if (typeof msg.content !== 'string' || msg.content.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json({ error: 'Message too long' }, { status: 400 })
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json({ error: 'Invalid message role' }, { status: 400 })
      }
    }

    // Fetch user context
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [profileRes, areasRes, checkinsRes, goalsRes, sessionsRes] = await Promise.all([
      supabase.from('profiles').select('first_name, big_why').eq('id', user.id).single(),
      supabase.from('life_areas').select('name').eq('user_id', user.id),
      supabase
        .from('checkins')
        .select('date, scores, focus_text')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false }),
      supabase
        .from('goals')
        .select('title, progress, target_date, life_areas(name)')
        .eq('user_id', user.id)
        .lt('progress', 100),
      supabase
        .from('focus_sessions')
        .select('task_name, duration_minutes')
        .eq('user_id', user.id)
        .gte('completed_at', sevenDaysAgo.toISOString()),
    ])

    const profile = profileRes.data
    const lifeAreas = (areasRes.data || []).map((a: { name: string }) => a.name).join(', ')
    const checkins = checkinsRes.data || []
    const goals = goalsRes.data || []
    const sessions = sessionsRes.data || []

    const checkInSummary = checkins.map((c: { date: string; scores: Record<string, number>; focus_text?: string }) => {
      const avgScore =
        Object.values(c.scores as Record<string, number>).reduce((a, b) => a + b, 0) /
        Object.values(c.scores as Record<string, number>).length
      return `${c.date}: avg score ${avgScore.toFixed(1)}/5. Focus: "${c.focus_text || 'none'}"`
    }).join('\n')

    const goalsSummary = goals.map((g: { title: string; progress: number; target_date: string; life_areas?: { name: string } | { name: string }[] }) => {
      const areaObj = Array.isArray(g.life_areas) ? g.life_areas[0] : g.life_areas
      const area = areaObj?.name ? `[${areaObj.name}] ` : ''
      return `- ${area}${g.title} (${g.progress}% complete, target: ${g.target_date})`
    }).join('\n')

    const focusSummary = sessions.length
      ? `Total focus sessions this week: ${sessions.length}, ${sessions.reduce((sum: number, s: { duration_minutes: number }) => sum + s.duration_minutes, 0)} minutes`
      : 'No focus sessions this week.'

    const systemPrompt = `You are Liv, a warm, direct, and structured personal life coach. You work exclusively for ${profile?.first_name || 'this person'}.

USER PROFILE:
- Name: ${profile?.first_name || 'the user'}
- Their Big Why: "${profile?.big_why || 'Not yet set'}"
- Life Areas they track: ${lifeAreas}

RECENT CHECK-IN SCORES (last 7 days):
${checkInSummary || 'No check-ins in the last 7 days.'}

GOALS (set during onboarding and via the Planner — these are the user's stated intentions, not just tasks):
${goalsSummary || 'No goals set yet.'}

FOCUS SESSIONS:
${focusSummary}

YOUR COACHING STYLE:
- Always address ${profile?.first_name || 'the user'} by their first name
- Reference their actual data — scores, goals, focus text — not generic advice
- Be warm but honest. Like a trusted mentor, not a therapist or a cheerleader
- Be direct and structured. Don't waffle or over-explain
- Always end your response with one specific, actionable suggestion
- Keep responses concise — 2-4 paragraphs maximum
- Never give generic motivational quotes as a main response
- If they mention something in their check-ins, acknowledge it specifically`

    // Convert messages to Anthropic format
    const formattedMessages = trimmedMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: formattedMessages,
    })

    const reply =
      response.content[0]?.type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Coach API error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json(
      { error: 'Failed to get response from coach' },
      { status: 500 }
    )
  }
}
