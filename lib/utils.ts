import { createClient } from './supabase/client'
import type { Profile, LifeArea, CheckIn, Goal, FocusSession } from './types'

export function getGreeting(firstName: string): string {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${firstName}`
  if (hour < 17) return `Good afternoon, ${firstName}`
  return `Good evening, ${firstName}`
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - startOfYear.getTime()
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7)
}

export function calculateStreak(checkins: CheckIn[]): number {
  if (!checkins.length) return 0
  const sorted = [...checkins].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  let streak = 0
  let current = new Date()
  current.setHours(0, 0, 0, 0)

  for (const c of sorted) {
    const checkinDate = new Date(c.date)
    checkinDate.setHours(0, 0, 0, 0)
    const diff = Math.round(
      (current.getTime() - checkinDate.getTime()) / 86400000
    )
    if (diff === streak) {
      streak++
      current = checkinDate
    } else {
      break
    }
  }
  return streak
}

export { SCORE_LABELS } from './types'

export function averageScores(
  scores: Record<string, number>
): number {
  const vals = Object.values(scores)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export async function fetchUserContext(userId: string) {
  const supabase = createClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [profileRes, areasRes, checkinsRes, goalsRes, sessionsRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('life_areas').select('*').eq('user_id', userId),
      supabase
        .from('checkins')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false }),
      supabase
        .from('goals')
        .select('*, life_areas(name), goal_actions(*)')
        .eq('user_id', userId)
        .lt('progress', 100),
      supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('completed_at', sevenDaysAgo.toISOString()),
    ])

  return {
    profile: profileRes.data as Profile | null,
    lifeAreas: (areasRes.data || []) as LifeArea[],
    recentCheckins: (checkinsRes.data || []) as CheckIn[],
    activeGoals: (goalsRes.data || []) as Goal[],
    focusSessions: (sessionsRes.data || []) as FocusSession[],
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
