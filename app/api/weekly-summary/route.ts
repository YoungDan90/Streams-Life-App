import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [profileRes, areasRes, checkinsRes] = await Promise.all([
      supabase.from('profiles').select('first_name, big_why').eq('id', user.id).single(),
      supabase.from('life_areas').select('name').eq('user_id', user.id),
      supabase
        .from('checkins')
        .select('date, scores, focus_text')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false }),
    ])

    const profile = profileRes.data
    const areas = (areasRes.data || []).map((a: { name: string }) => a.name)
    const checkins = checkinsRes.data || []

    if (!checkins.length) {
      return NextResponse.json({
        summary:
          'No check-ins recorded this week. Start your daily check-in to unlock your weekly AI summary.',
      })
    }

    // Average scores per area
    const areaAverages: Record<string, number[]> = {}
    areas.forEach(a => { areaAverages[a] = [] })

    checkins.forEach((c: { scores: Record<string, number>; focus_text?: string }) => {
      Object.entries(c.scores as Record<string, number>).forEach(([area, score]) => {
        if (!areaAverages[area]) areaAverages[area] = []
        areaAverages[area].push(score)
      })
    })

    const scoreSummary = Object.entries(areaAverages)
      .map(([area, scores]) => {
        if (!scores.length) return null
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        return `${area}: ${avg.toFixed(1)}/5`
      })
      .filter(Boolean)
      .join(', ')

    const focusHighlights = checkins
      .filter((c: { focus_text?: string }) => c.focus_text)
      .map((c: { date: string; focus_text?: string }) => `${c.date}: "${c.focus_text}"`)
      .join('\n')

    const prompt = `You are Sage, a personal life coach. Write a concise weekly review summary for ${profile?.first_name || 'the user'}.

USER CONTEXT:
- Big Why: "${profile?.big_why || 'Not set'}"
- Check-ins this week: ${checkins.length} of 7 days
- Average scores: ${scoreSummary}
- What they focused on:
${focusHighlights || 'No focus text recorded.'}

Write a 3-sentence summary:
1. One sentence acknowledging their overall week honestly and warmly
2. One specific encouragement based on a bright spot in their data
3. One specific challenge or focus for the coming week

Keep it personal, direct, and grounded in their actual data. Do not use generic platitudes. Address them by first name (${profile?.first_name || 'there'}).`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary =
      response.content[0]?.type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Weekly summary error:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
