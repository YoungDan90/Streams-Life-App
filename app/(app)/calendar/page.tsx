'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, X, Lock, Star } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
interface DayCheckin {
  id: string
  date: string
  scores: Record<string, number>
  focus_text: string | null
}

interface DaySession {
  id: string
  task_name: string
  duration_minutes: number
  completed_at: string
  life_area_name: string | null
}

interface DayAction {
  id: string
  action_text: string
  completed: boolean
  due_date: string | null
  goal_title: string
}

interface DayData {
  checkin: DayCheckin | null
  sessions: DaySession[]
  actions: DayAction[]
}

// ─── Helpers ─────────────────────────────────────────────────
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

// Monday-based weekday index (0=Mon … 6=Sun)
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function avgScore(scores: Record<string, number>): number {
  const vals = Object.values(scores)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function scoreColor(avg: number): string {
  if (avg >= 4.5) return 'bg-emerald-400'
  if (avg >= 3.5) return 'bg-gold'
  if (avg >= 2.5) return 'bg-amber-400'
  return 'bg-red-400'
}

const SCORE_EMOJI: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '😊', 5: '🌟' }

// ─── Component ───────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [checkinMap, setCheckinMap]   = useState<Record<string, DayCheckin>>({})
  const [sessionMap, setSessionMap]   = useState<Record<string, DaySession[]>>({})
  const [actionMap, setActionMap]     = useState<Record<string, DayAction[]>>({})
  const [loading, setLoading]         = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayData, setDayData]         = useState<DayData | null>(null)
  const [, setSheetLoading] = useState(false)

  const fetchMonth = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const end   = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`

    // Start/end as timestamps for focus_sessions
    const startTs = new Date(y, m, 1).toISOString()
    const endTs   = new Date(y, m + 1, 0, 23, 59, 59).toISOString()

    const [checkinsRes, sessionsRes, actionsRes] = await Promise.all([
      supabase
        .from('checkins')
        .select('id, date, scores, focus_text')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end),
      supabase
        .from('focus_sessions')
        .select('id, task_name, duration_minutes, completed_at, life_areas(name)')
        .eq('user_id', user.id)
        .gte('completed_at', startTs)
        .lte('completed_at', endTs),
      supabase
        .from('goal_actions')
        .select('id, action_text, completed, due_date, goals!inner(title, user_id)')
        .eq('goals.user_id', user.id)
        .gte('due_date', start)
        .lte('due_date', end),
    ])

    // Build checkin map keyed by date string
    const cMap: Record<string, DayCheckin> = {}
    for (const c of checkinsRes.data || []) {
      cMap[c.date] = { ...c, scores: c.scores as Record<string, number> }
    }

    // Build session map keyed by date string (local date of completed_at)
    const sMap: Record<string, DaySession[]> = {}
    for (const s of sessionsRes.data || []) {
      const dateKey = s.completed_at.split('T')[0]
      const areaName = Array.isArray(s.life_areas)
        ? (s.life_areas[0] as { name: string } | undefined)?.name ?? null
        : (s.life_areas as { name: string } | null)?.name ?? null
      const session: DaySession = {
        id: s.id,
        task_name: s.task_name,
        duration_minutes: s.duration_minutes,
        completed_at: s.completed_at,
        life_area_name: areaName,
      }
      if (!sMap[dateKey]) sMap[dateKey] = []
      sMap[dateKey].push(session)
    }

    // Build action map keyed by due_date
    const aMap: Record<string, DayAction[]> = {}
    for (const a of actionsRes.data || []) {
      if (!a.due_date) continue
      const goal = Array.isArray(a.goals)
        ? (a.goals[0] as { title: string } | undefined)
        : (a.goals as { title: string } | null)
      const action: DayAction = {
        id: a.id,
        action_text: a.action_text,
        completed: a.completed,
        due_date: a.due_date,
        goal_title: goal?.title ?? '',
      }
      if (!aMap[a.due_date]) aMap[a.due_date] = []
      aMap[a.due_date].push(action)
    }

    setCheckinMap(cMap)
    setSessionMap(sMap)
    setActionMap(aMap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchMonth(year, month) }, [year, month, fetchMonth])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function openDay(dateStr: string) {
    setSelectedDay(dateStr)
    setSheetLoading(false)
    setDayData({
      checkin: checkinMap[dateStr] ?? null,
      sessions: sessionMap[dateStr] ?? [],
      actions: actionMap[dateStr] ?? [],
    })
  }

  // Build calendar grid
  const totalDays = daysInMonth(year, month)
  const firstWeekday = weekdayIndex(firstDayOfMonth(year, month))
  const todayStr = toDateStr(today)

  // Grid cells: blanks + day numbers
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // Pad to complete final row
  while (cells.length % 7 !== 0) cells.push(null)

  // ─── Day Cell ──────────────────────────────────────────────
  function DayCell({ day }: { day: number | null }) {
    if (!day) return <div />

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const checkin  = checkinMap[dateStr]
    const sessions = sessionMap[dateStr] || []
    const actions  = actionMap[dateStr] || []
    const completedActions = actions.filter(a => a.completed)
    const isToday  = dateStr === todayStr
    const isFuture = dateStr > todayStr
    const isSelected = dateStr === selectedDay

    const avg = checkin ? avgScore(checkin.scores) : 0
    const dotColor = checkin ? scoreColor(avg) : ''

    return (
      <button
        onClick={() => openDay(dateStr)}
        disabled={isFuture && !sessions.length && !actions.length}
        className={`relative flex flex-col items-center pt-1.5 pb-2 rounded-xl transition-all active:scale-95 min-h-[58px] ${
          isSelected
            ? 'bg-gold/20 ring-1 ring-gold/60'
            : isToday
            ? 'bg-white/8 ring-1 ring-white/20'
            : isFuture
            ? 'opacity-35'
            : 'hover:bg-white/5'
        }`}
      >
        {/* Day number */}
        <span className={`text-xs font-semibold leading-none mb-1.5 ${
          isToday ? 'text-gold' : isSelected ? 'text-gold' : 'text-white/80'
        }`}>
          {day}
        </span>

        {/* Indicators */}
        <div className="flex items-center gap-0.5 flex-wrap justify-center">
          {checkin && (
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
          )}
          {sessions.length > 0 && (
            <Lock size={8} className="text-blue-300 flex-shrink-0" strokeWidth={2.5} />
          )}
          {completedActions.length > 0 && (
            <Star size={8} className="text-gold flex-shrink-0" fill="currentColor" />
          )}
        </div>
      </button>
    )
  }

  // ─── Bottom Sheet ──────────────────────────────────────────
  const sheetDay = selectedDay
  const sheetDate = sheetDay ? new Date(sheetDay + 'T12:00:00') : null
  const sheetLabel = sheetDate
    ? sheetDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="min-h-dvh bg-navy">
      {/* Header */}
      <div className="px-5 pt-12 pb-3">
        <h1 className="font-heading text-2xl font-bold text-white mb-4">Calendar</h1>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10 transition-colors"
          >
            <ChevronLeft size={18} className="text-white/60" />
          </button>
          <h2 className="font-heading text-lg font-semibold text-white">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10 transition-colors"
            disabled={year === today.getFullYear() && month === today.getMonth()}
          >
            <ChevronRight size={18} className={
              year === today.getFullYear() && month === today.getMonth()
                ? 'text-white/15'
                : 'text-white/60'
            } />
          </button>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="text-center text-white/25 text-[10px] font-semibold uppercase tracking-wide py-1">
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center pt-20">
          <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-3 pb-6">
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => (
              <DayCell key={i} day={day} />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-5 pb-32">
        <div className="flex items-center gap-5 justify-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-white/30 text-xs">Check-in</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock size={10} className="text-blue-300" strokeWidth={2.5} />
            <span className="text-white/30 text-xs">Focus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star size={10} className="text-gold" fill="currentColor" />
            <span className="text-white/30 text-xs">Goal done</span>
          </div>
        </div>
      </div>

      {/* Bottom Sheet */}
      {selectedDay && dayData && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedDay(null)}
          />

          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-navy border-t border-white/10 rounded-t-3xl shadow-2xl animate-slide-up max-h-[75dvh] flex flex-col">
            {/* Handle + header */}
            <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-white/8">
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-heading text-lg font-bold text-white">{sheetLabel}</h3>
                  {dayData.checkin && (
                    <p className="text-gold/70 text-xs mt-0.5">
                      Avg score: {avgScore(dayData.checkin.scores).toFixed(1)} / 5
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5"
                >
                  <X size={15} className="text-white/50" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-4 space-y-5 pb-safe">

              {/* Nothing logged */}
              {!dayData.checkin && !dayData.sessions.length && !dayData.actions.length && (
                <div className="text-center py-8">
                  <p className="text-white/30 text-sm">Nothing logged for this day.</p>
                </div>
              )}

              {/* Check-in Scores */}
              {dayData.checkin && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-gold" />
                    <p className="text-gold text-xs font-semibold uppercase tracking-wide">Check-In</p>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(dayData.checkin.scores).map(([area, score]) => (
                      <div key={area} className="flex items-center justify-between">
                        <span className="text-white/70 text-sm">{area}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                score >= 4 ? 'bg-emerald-400' : score === 3 ? 'bg-gold' : 'bg-red-400'
                              }`}
                              style={{ width: `${(score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-base w-5 text-right">{SCORE_EMOJI[score]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {dayData.checkin.focus_text && (
                    <div className="mt-3 bg-white/5 rounded-xl px-4 py-3 border border-white/8">
                      <p className="text-white/40 text-xs mb-1">Focus intention</p>
                      <p className="text-white/80 text-sm leading-relaxed">
                        {dayData.checkin.focus_text}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Focus Sessions */}
              {dayData.sessions.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock size={12} className="text-blue-300" strokeWidth={2.5} />
                    <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide">
                      Focus Sessions
                    </p>
                  </div>
                  <div className="space-y-2">
                    {dayData.sessions.map(s => (
                      <div key={s.id} className="bg-white/5 rounded-xl px-4 py-3 border border-white/8 flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-sm font-medium">{s.task_name}</p>
                          {s.life_area_name && (
                            <p className="text-white/65 text-xs mt-0.5">{s.life_area_name}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-blue-300 text-sm font-semibold">{s.duration_minutes}m</p>
                        </div>
                      </div>
                    ))}
                    <p className="text-white/30 text-xs text-right">
                      Total: {dayData.sessions.reduce((sum, s) => sum + s.duration_minutes, 0)} min
                    </p>
                  </div>
                </section>
              )}

              {/* Goal Actions */}
              {dayData.actions.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={12} className="text-gold" fill="currentColor" />
                    <p className="text-gold text-xs font-semibold uppercase tracking-wide">Goal Actions</p>
                  </div>
                  <div className="space-y-2">
                    {dayData.actions.map(a => (
                      <div
                        key={a.id}
                        className={`bg-white/5 rounded-xl px-4 py-3 border flex items-start gap-3 ${
                          a.completed ? 'border-gold/20' : 'border-white/8'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          a.completed ? 'bg-gold border-gold' : 'border-white/20'
                        }`}>
                          {a.completed && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#0D1B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-relaxed ${
                            a.completed ? 'line-through text-white/65' : 'text-white/80'
                          }`}>
                            {a.action_text}
                          </p>
                          <p className="text-white/30 text-xs mt-0.5 truncate">{a.goal_title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Spacer for safe area */}
              <div className="h-4" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
