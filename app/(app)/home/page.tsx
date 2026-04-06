import { createClient } from '@/lib/supabase/server'
import { getGreeting, formatDate, calculateStreak, averageScores, getTodayStr } from '@/lib/utils'
import Link from 'next/link'
import ProgressRing from '@/components/ui/ProgressRing'
import ScoreBar from '@/components/ui/ScoreBar'
import { Zap, TrendingUp, ChevronRight, Flame } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getTodayStr()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [profileRes, , checkinsRes, goalsRes, sessionsRes, todayCheckinRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('life_areas').select('*').eq('user_id', user.id),
      supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30),
      supabase
        .from('goals')
        .select('*, goal_actions(*)')
        .eq('user_id', user.id)
        .lt('progress', 100)
        .order('target_date', { ascending: true })
        .limit(5),
      supabase
        .from('focus_sessions')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .gte('completed_at', sevenDaysAgo.toISOString()),
      supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single(),
    ])

  const profile = profileRes.data
  const checkins = checkinsRes.data || []
  const goals = goalsRes.data || []
  const sessions = sessionsRes.data || []
  const todayCheckin = todayCheckinRes.data

  const streak = calculateStreak(checkins)
  const totalFocusMinutes = sessions.reduce((sum: number, s: { duration_minutes: number }) => sum + (s.duration_minutes || 0), 0)
  const lastCheckin = checkins[0]
  const avgScore = lastCheckin
    ? averageScores(lastCheckin.scores as Record<string, number>)
    : null

  // Today's top action
  const weekNumber = Math.ceil(
    (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 86400000)
  )
  const todayAction = goals
    .flatMap((g: { goal_actions?: { week_number: number; completed: boolean; action_text: string }[] }) => g.goal_actions || [])
    .find((a: { week_number: number; completed: boolean }) => a.week_number === weekNumber && !a.completed)

  // Daily insight prompts
  const INSIGHTS = [
    '"The quality of your life is the quality of your focus." — Wherever you spend time intentionally, you grow.',
    '"Small daily improvements over time lead to stunning results." — Build the habit, trust the compound effect.',
    '"You don\'t rise to the level of your goals. You fall to the level of your systems." — Your systems are your life.',
    '"An investment in yourself pays the best interest." — Today is a day to invest in what matters.',
    '"Life is not measured by the number of breaths we take, but by the moments that take our breath away."',
  ]
  const insight = INSIGHTS[new Date().getDay() % INSIGHTS.length]

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <p className="text-navy/50 text-sm">{formatDate(new Date())}</p>
        <h1 className="font-heading text-2xl font-bold text-navy mt-1">
          {getGreeting(profile?.first_name || 'there')}
        </h1>
      </div>

      {/* Streak + Focus stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
            <Flame size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-navy font-bold text-xl">{streak}</p>
            <p className="text-navy/50 text-xs">day streak</p>
          </div>
        </div>

        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-gold" />
          </div>
          <div>
            <p className="text-navy font-bold text-xl">{totalFocusMinutes}</p>
            <p className="text-navy/50 text-xs">focus mins</p>
          </div>
        </div>
      </div>

      {/* Life balance ring */}
      {lastCheckin && avgScore !== null ? (
        <div className="card mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-base font-semibold text-navy">Life Balance</h2>
            <span className="text-navy/40 text-xs">Latest check-in</span>
          </div>
          <div className="flex items-center gap-6">
            <ProgressRing value={((avgScore - 1) / 4) * 100} size={90} strokeWidth={7}>
              <span className="font-bold text-navy text-lg">{avgScore.toFixed(1)}</span>
            </ProgressRing>
            <div className="flex-1 space-y-2">
              {Object.entries(lastCheckin.scores as Record<string, number>)
                .slice(0, 4)
                .map(([area, score]) => (
                  <ScoreBar key={area} label={area} score={score} />
                ))}
            </div>
          </div>
        </div>
      ) : (
        <Link href="/checkin" className="card mb-5 block">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-semibold text-navy mb-1">
                Start your day right
              </h2>
              <p className="text-navy/50 text-sm">Complete today&apos;s check-in</p>
            </div>
            <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center">
              <ChevronRight size={20} className="text-navy" />
            </div>
          </div>
        </Link>
      )}

      {/* Today's check-in CTA (if not done) */}
      {!todayCheckin && lastCheckin && (
        <Link href="/checkin" className="block mb-5">
          <div className="bg-navy rounded-card p-4 flex items-center justify-between shadow-card">
            <div>
              <p className="text-gold text-xs font-medium uppercase tracking-wide mb-1">Today</p>
              <p className="text-white font-semibold">Complete check-in</p>
            </div>
            <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
              <ChevronRight size={20} className="text-gold" />
            </div>
          </div>
        </Link>
      )}

      {/* Today's Focus */}
      {todayAction && (
        <div className="card mb-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-gold" />
            <h2 className="font-heading text-base font-semibold text-navy">Today&apos;s Focus</h2>
          </div>
          <p className="text-navy/70 text-sm leading-relaxed">{(todayAction as { action_text: string }).action_text}</p>
          <Link href="/planner" className="text-gold text-xs font-medium mt-2 block">
            View planner →
          </Link>
        </div>
      )}

      {/* Daily Insight */}
      <div className="bg-navy rounded-card p-5 mb-5 shadow-card">
        <p className="text-gold text-xs font-medium uppercase tracking-wide mb-2">Daily Insight</p>
        <p className="text-white/80 text-sm leading-relaxed italic">{insight}</p>
      </div>

      {/* Lock In shortcut */}
      <Link href="/lockin">
        <div className="bg-gold rounded-card p-4 flex items-center justify-between shadow-gold active:scale-95 transition-all">
          <div className="flex items-center gap-3">
            <Zap size={22} className="text-navy" />
            <div>
              <p className="text-navy font-semibold">Lock In</p>
              <p className="text-navy/60 text-xs">Start a focus session</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-navy/60" />
        </div>
      </Link>
    </div>
  )
}
