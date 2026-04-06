import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface PlanRequest {
  goal: string
  lifeArea: string
  targetDate: string
  weeksAvailable: number
}

export async function POST(req: NextRequest) {
  try {
    const { goal, lifeArea, targetDate, weeksAvailable }: PlanRequest = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent check-in context for this life area
    const { data: recentCheckins } = await supabase
      .from('checkins')
      .select('scores')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(3)

    const areaScores = (recentCheckins || []).map((c: { scores: Record<string, number> }) =>
      (c.scores as Record<string, number>)[lifeArea]
    ).filter(Boolean)
    const avgAreaScore = areaScores.length
      ? (areaScores.reduce((a: number, b: number) => a + b, 0) / areaScores.length).toFixed(1)
      : null

    const contextNote = avgAreaScore
      ? `The user currently scores themselves ${avgAreaScore}/5 in ${lifeArea} based on recent check-ins.`
      : ''

    const prompt = `You are a structured life coach creating a week-by-week action plan.

GOAL: "${goal}"
LIFE AREA: ${lifeArea}
TARGET DATE: ${targetDate}
WEEKS AVAILABLE: ${weeksAvailable}
${contextNote}

Create a practical, progressive week-by-week action plan to achieve this goal.

Requirements:
- Exactly ${Math.min(weeksAvailable, 12)} weeks of actions
- 2-3 specific, actionable tasks per week (not vague statements)
- Actions should build progressively — early weeks are foundation, later weeks are momentum
- Be concrete and specific — not "work on your goal" but "spend 30 minutes doing X"
- Consider the user's current score — if low, start with smaller wins first

Respond ONLY with valid JSON in this exact format:
{
  "plan": [
    {
      "week": 1,
      "actions": ["specific action 1", "specific action 2", "specific action 3"]
    },
    {
      "week": 2,
      "actions": ["specific action 1", "specific action 2"]
    }
  ]
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : '{}'

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Planner API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate plan' },
      { status: 500 }
    )
  }
}
