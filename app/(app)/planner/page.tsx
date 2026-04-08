'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronRight, ChevronDown, Check, AlertCircle, Trophy, CalendarDays } from 'lucide-react'
import type { Goal, GoalAction, LifeArea } from '@/lib/types'
import Confetti from '@/components/Confetti'

type PlannerView = 'goals' | 'this-week' | 'add-goal'

interface WeekPlan {
  week: number
  actions: string[]
}

function getWeekNumber() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}

function isOverdue(action: GoalAction): boolean {
  if (!action.due_date) return false
  return new Date(action.due_date) < new Date() && !action.completed
}

export default function PlannerPage() {
  const [view, setView] = useState<PlannerView>('goals')
  const [goals, setGoals] = useState<Goal[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confetti, setConfetti] = useState(false)

  // Add goal form
  const [newGoalText, setNewGoalText] = useState('')
  const [newGoalAreaId, setNewGoalAreaId] = useState('')
  const [newGoalDate, setNewGoalDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState<WeekPlan[]>([])
  const [savingGoal, setSavingGoal] = useState(false)
  const [planError, setPlanError] = useState('')

  const currentWeek = getWeekNumber()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [goalsRes, areasRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*, life_areas(name), goal_actions(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('life_areas').select('*').eq('user_id', user.id),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setLifeAreas(areasRes.data || [])
    setLoading(false)
  }

  async function toggleAction(action: GoalAction, goal: Goal) {
    const supabase = createClient()
    const completed = !action.completed
    await supabase
      .from('goal_actions')
      .update({ completed })
      .eq('id', action.id)

    // Recalculate goal progress
    const allActions = goal.actions || []
    const completedCount = allActions.filter(
      a => (a.id === action.id ? completed : a.completed)
    ).length
    const newProgress = Math.round((completedCount / allActions.length) * 100)

    await supabase
      .from('goals')
      .update({ progress: newProgress })
      .eq('id', goal.id)

    if (newProgress >= 100) setConfetti(true)

    await loadData()
  }

  async function generatePlan() {
    if (!newGoalText.trim() || !newGoalAreaId || !newGoalDate) return
    setGenerating(true)
    setPlanError('')

    const area = lifeAreas.find(a => a.id === newGoalAreaId)
    const weeksAvailable = Math.max(
      1,
      Math.round(
        (new Date(newGoalDate).getTime() - Date.now()) / (7 * 86400000)
      )
    )

    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: newGoalText,
          lifeArea: area?.name || '',
          targetDate: newGoalDate,
          weeksAvailable,
        }),
      })

      const data = await res.json()
      if (data.plan) {
        setGeneratedPlan(data.plan)
      } else {
        setPlanError('Failed to generate plan. Please try again.')
      }
    } catch {
      setPlanError('Connection error. Please try again.')
    }

    setGenerating(false)
  }

  function updateAction(weekIdx: number, actionIdx: number, value: string) {
    setGeneratedPlan(prev => {
      const updated = prev.map((w, wi) =>
        wi === weekIdx
          ? { ...w, actions: w.actions.map((a, ai) => (ai === actionIdx ? value : a)) }
          : w
      )
      return updated
    })
  }

  function removeAction(weekIdx: number, actionIdx: number) {
    setGeneratedPlan(prev =>
      prev.map((w, wi) =>
        wi === weekIdx
          ? { ...w, actions: w.actions.filter((_, ai) => ai !== actionIdx) }
          : w
      )
    )
  }

  async function saveGoal() {
    setSavingGoal(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: goal } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        life_area_id: newGoalAreaId,
        title: newGoalText,
        target_date: newGoalDate,
        progress: 0,
      })
      .select()
      .single()

    if (goal) {
      const startWeek = currentWeek
      const actionRows = generatedPlan.flatMap(week =>
        week.actions.map(text => ({
          goal_id: goal.id,
          week_number: startWeek + week.week - 1,
          action_text: text,
          completed: false,
          due_date: null,
        }))
      )

      await supabase.from('goal_actions').insert(actionRows)
    }

    setNewGoalText('')
    setNewGoalAreaId('')
    setNewGoalDate('')
    setGeneratedPlan([])
    setSavingGoal(false)
    setView('goals')
    await loadData()
  }

  // Max target date (90 days out)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 90)
  const maxDateStr = maxDate.toISOString().split('T')[0]
  const minDateStr = new Date().toISOString().split('T')[0]

  const thisWeekActions = goals.flatMap(goal =>
    (goal.actions || [])
      .filter(a => a.week_number === currentWeek)
      .map(a => ({ ...a, goalTitle: goal.title }))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      <Confetti trigger={confetti} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-navy">Planner</h1>
        <button
          onClick={() => { setView('add-goal'); setGeneratedPlan([]) }}
          className="w-9 h-9 bg-navy rounded-xl flex items-center justify-center active:scale-95 transition-all"
        >
          <Plus size={18} className="text-gold" />
        </button>
      </div>

      {/* Tab bar */}
      {view !== 'add-goal' && (
        <div className="flex bg-navy/5 rounded-xl p-1 mb-6 gap-1">
          {(['goals', 'this-week'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                view === v ? 'bg-white text-navy shadow-sm' : 'text-navy/50'
              }`}
            >
              {v === 'goals' ? 'All Goals' : 'This Week'}
            </button>
          ))}
        </div>
      )}

      {/* ALL GOALS VIEW */}
      {view === 'goals' && (
        <div className="space-y-4">
          {goals.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays size={40} className="text-navy/20 mx-auto mb-3" />
              <p className="text-navy/40 text-sm">No goals yet.</p>
              <p className="text-navy/30 text-xs mt-1">Tap + to set your first 90-day goal.</p>
            </div>
          )}

          {goals.map(goal => {
            const isExpanded = expandedGoal === goal.id
            const actions = goal.actions || []
            const completed = actions.filter(a => a.completed).length
            const isComplete = goal.progress >= 100

            return (
              <div key={goal.id} className={`card ${isComplete ? 'border border-gold/30 bg-gold/5' : ''}`}>
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {isComplete && <Trophy size={14} className="text-gold" />}
                        <p className="text-navy font-semibold text-sm">{goal.title}</p>
                      </div>
                      <p className="text-navy/40 text-xs">
                        {(goal.life_area as unknown as LifeArea)?.name || ''} · {completed}/{actions.length} actions
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-navy/30 mt-0.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-navy/8 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full transition-all duration-700"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <p className="text-right text-navy/40 text-xs mt-1">{goal.progress}%</p>
                </button>

                {isExpanded && (
                  <div className="mt-4 border-t border-navy/5 pt-4 space-y-2">
                    {actions
                      .filter(a => a.week_number === currentWeek)
                      .map(action => (
                        <div
                          key={action.id}
                          className="flex items-start gap-3"
                        >
                          <button
                            onClick={() => toggleAction(action, goal)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                              action.completed
                                ? 'bg-gold border-gold'
                                : isOverdue(action)
                                ? 'border-amber-400'
                                : 'border-navy/20'
                            }`}
                          >
                            {action.completed && <Check size={11} className="text-navy" />}
                          </button>
                          <span
                            className={`text-sm leading-relaxed ${
                              action.completed ? 'line-through text-navy/30' : 'text-navy/70'
                            }`}
                          >
                            {action.action_text}
                          </span>
                          {isOverdue(action) && !action.completed && (
                            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      ))}

                    {actions.filter(a => a.week_number !== currentWeek && !a.completed).length > 0 && (
                      <p className="text-navy/30 text-xs pt-1">
                        + {actions.filter(a => a.week_number !== currentWeek && !a.completed).length} upcoming actions
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* THIS WEEK VIEW */}
      {view === 'this-week' && (
        <div className="space-y-3">
          {thisWeekActions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-navy/40 text-sm">No actions scheduled this week.</p>
            </div>
          ) : (
            thisWeekActions.map(action => {
              const goal = goals.find(g => g.actions?.some(a => a.id === action.id))
              if (!goal) return null
              return (
                <div
                  key={action.id}
                  className={`card flex items-start gap-3 ${
                    isOverdue(action) ? 'border border-amber-200 bg-amber-50/50' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleAction(action, goal)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      action.completed
                        ? 'bg-gold border-gold'
                        : isOverdue(action)
                        ? 'border-amber-400'
                        : 'border-navy/20'
                    }`}
                  >
                    {action.completed && <Check size={11} className="text-navy" />}
                  </button>
                  <div className="flex-1">
                    <p
                      className={`text-sm ${
                        action.completed ? 'line-through text-navy/30' : 'text-navy'
                      }`}
                    >
                      {action.action_text}
                    </p>
                    <p className="text-navy/40 text-xs mt-1">{(action as { goalTitle?: string }).goalTitle}</p>
                  </div>
                  {isOverdue(action) && !action.completed && (
                    <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ADD GOAL VIEW */}
      {view === 'add-goal' && (
        <div className="animate-slide-up">
          <button
            onClick={() => setView('goals')}
            className="text-navy/40 text-sm mb-6 flex items-center gap-1"
          >
            ← Back to goals
          </button>

          <h2 className="font-heading text-xl font-bold text-navy mb-6">New Goal</h2>

          <div className="space-y-5 mb-6">
            <div>
              <label className="block text-navy/60 text-sm font-medium mb-2">
                What&apos;s your goal?
              </label>
              <textarea
                value={newGoalText}
                onChange={e => setNewGoalText(e.target.value)}
                placeholder="e.g. Run my first 5K, Launch my side project, Read 12 books this year"
                rows={3}
                className="w-full border border-navy/15 text-navy rounded-xl px-4 py-3.5 focus:outline-none focus:border-gold transition-colors placeholder:text-navy/30 resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-navy/60 text-sm font-medium mb-2">Life area</label>
              <select
                value={newGoalAreaId}
                onChange={e => setNewGoalAreaId(e.target.value)}
                className="w-full border border-navy/15 text-navy rounded-xl px-4 py-3.5 focus:outline-none focus:border-gold transition-colors text-sm appearance-none bg-white"
              >
                <option value="">Select a life area</option>
                {lifeAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-navy/60 text-sm font-medium mb-2">
                Target date (within 90 days)
              </label>
              <input
                type="date"
                value={newGoalDate}
                onChange={e => setNewGoalDate(e.target.value)}
                min={minDateStr}
                max={maxDateStr}
                className="w-full border border-navy/15 text-navy rounded-xl px-4 py-3.5 focus:outline-none focus:border-gold transition-colors text-sm"
              />
            </div>
          </div>

          {generatedPlan.length === 0 ? (
            <>
              {planError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
                  {planError}
                </div>
              )}
              <button
                onClick={generatePlan}
                disabled={generating || !newGoalText.trim() || !newGoalAreaId || !newGoalDate}
                className="w-full bg-navy text-gold font-semibold py-4 rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    Generating plan…
                  </>
                ) : (
                  <>
                    <ChevronRight size={18} />
                    Generate Plan
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="animate-slide-up">
              <h3 className="font-heading text-base font-semibold text-navy mb-4">
                Your Week-by-Week Plan
              </h3>
              <p className="text-navy/40 text-xs mb-4">
                Edit or remove any actions before saving.
              </p>

              <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto hide-scrollbar pr-1">
                {generatedPlan.map((week, wi) => (
                  <div key={wi} className="card">
                    <p className="text-gold text-xs font-semibold uppercase tracking-wide mb-3">
                      Week {week.week}
                    </p>
                    <div className="space-y-2">
                      {week.actions.map((action, ai) => (
                        <div key={ai} className="flex items-center gap-2">
                          <input
                            value={action}
                            onChange={e => updateAction(wi, ai, e.target.value)}
                            aria-label={`Week ${week.week} action ${ai + 1}`}
                            className="flex-1 text-sm text-navy border border-navy/10 rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
                          />
                          <button
                            onClick={() => removeAction(wi, ai)}
                            aria-label="Remove action"
                            className="text-navy/50 hover:text-red-400 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={saveGoal}
                  disabled={savingGoal}
                  className="w-full bg-gold text-navy font-semibold py-4 rounded-xl active:scale-95 transition-all disabled:opacity-40"
                >
                  {savingGoal ? 'Saving…' : 'Save Goal & Plan ✓'}
                </button>
                <button
                  onClick={() => setGeneratedPlan([])}
                  className="w-full text-navy/40 text-sm py-2"
                >
                  Regenerate plan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
