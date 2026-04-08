import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsv).join(',')
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [checkinsRes, goalsRes, sessionsRes] = await Promise.all([
      supabase
        .from('checkins')
        .select('date, scores, focus_text, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      supabase
        .from('goals')
        .select('title, progress, target_date, created_at, life_areas(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('focus_sessions')
        .select('task_name, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false }),
    ])

    const checkins = checkinsRes.data || []
    const goals = goalsRes.data || []
    const sessions = sessionsRes.data || []

    const sections: string[] = []

    // --- Check-ins ---
    sections.push('CHECK-INS')
    sections.push(toCsvRow(['Date', 'Focus Note', 'Avg Score', 'Raw Scores']))
    for (const c of checkins) {
      const scores = c.scores as Record<string, number>
      const values = Object.values(scores)
      const avg = values.length
        ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
        : ''
      const rawScores = Object.entries(scores)
        .map(([k, v]) => `${k}:${v}`)
        .join(' | ')
      sections.push(toCsvRow([c.date, c.focus_text, avg, rawScores]))
    }

    sections.push('')

    // --- Goals ---
    sections.push('GOALS')
    sections.push(toCsvRow(['Title', 'Life Area', 'Progress %', 'Target Date', 'Created']))
    for (const g of goals) {
      const areaObj = Array.isArray(g.life_areas) ? g.life_areas[0] : g.life_areas
      const area = (areaObj as { name?: string } | null)?.name || ''
      sections.push(toCsvRow([g.title, area, g.progress, g.target_date, g.created_at]))
    }

    sections.push('')

    // --- Focus Sessions ---
    sections.push('FOCUS SESSIONS')
    sections.push(toCsvRow(['Task', 'Duration (mins)', 'Completed At']))
    for (const s of sessions) {
      sections.push(toCsvRow([s.task_name, s.duration_minutes, s.completed_at]))
    }

    const csv = sections.join('\n')
    const filename = `streams-life-export-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
