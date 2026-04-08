'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getTodayStr } from '@/lib/utils'
import { CheckCircle, ChevronRight } from 'lucide-react'
import type { LifeArea } from '@/lib/types'

const SCORE_EMOJIS: Record<number, string> = {
  1: '😔',
  2: '😕',
  3: '😐',
  4: '😊',
  5: '🌟',
}

export default function CheckInPage() {
  const router = useRouter()
  const [step, setStep] = useState<'rate' | 'focus' | 'done'>('rate')
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [focusText, setFocusText] = useState('')
  const [todayDone, setTodayDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lowAreas, setLowAreas] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = getTodayStr()
      const [areasRes, checkinRes] = await Promise.all([
        supabase.from('life_areas').select('*').eq('user_id', user.id),
        supabase.from('checkins').select('*').eq('user_id', user.id).eq('date', today).single(),
      ])

      setLifeAreas(areasRes.data || [])

      if (checkinRes.data) {
        setTodayDone(true)
        setScores(checkinRes.data.scores as Record<string, number>)
        setFocusText(checkinRes.data.focus_text || '')
      } else {
        // Default all scores to 3
        const defaults: Record<string, number> = {}
        ;(areasRes.data || []).forEach((a: LifeArea) => {
          defaults[a.name] = 3
        })
        setScores(defaults)
      }

      setLoading(false)
    }
    load()
  }, [])

  function setScore(area: string, score: number) {
    setScores(prev => ({ ...prev, [area]: score }))
  }

  async function handleSubmit() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('checkins').upsert({
      user_id: user.id,
      date: getTodayStr(),
      scores,
      focus_text: focusText,
    })

    const low = Object.entries(scores)
      .filter(([, v]) => v <= 3)
      .map(([k]) => k)
    setLowAreas(low)

    setSaving(false)
    setStep('done')
  }

  const avgScore =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    (Object.values(scores).length || 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (todayDone && step !== 'done') {
    return (
      <div className="px-5 pt-12 pb-8 animate-fade-in">
        <h1 className="font-heading text-2xl font-bold text-navy mb-2">Today&apos;s Check-In</h1>
        <p className="text-navy/50 text-sm mb-6">Already completed today.</p>

        <div className="card mb-5">
          <p className="text-navy/50 text-xs mb-3">Your scores today</p>
          <div className="space-y-3">
            {Object.entries(scores).map(([area, score]) => (
              <div key={area} className="flex items-center justify-between">
                <span className="text-navy text-sm">{area}</span>
                <span className="text-lg">{SCORE_EMOJIS[score]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="text-navy/50 text-xs mb-2">Today&apos;s focus</p>
          <p className="text-navy text-sm">{focusText || '—'}</p>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="px-5 pt-12 pb-8 animate-fade-in flex flex-col min-h-dvh">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle size={40} className="text-gold" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-navy mb-2">Check-in complete</h1>
          <p className="text-navy/50 text-sm mb-6">
            Your average score today: <strong className="text-navy">{avgScore.toFixed(1)} / 5</strong>
          </p>

          {lowAreas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left w-full mb-6">
              <p className="text-amber-800 font-semibold text-sm mb-2">Areas to give some love 💛</p>
              <ul className="space-y-1">
                {lowAreas.map(area => (
                  <li key={area} className="text-amber-700 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {area}
                  </li>
                ))}
              </ul>
              <p className="text-amber-600 text-xs mt-3">
                Consider one small action today in each of these areas.
              </p>
            </div>
          )}

          <div className="bg-navy/5 rounded-xl p-4 text-left w-full mb-8">
            <p className="text-navy/50 text-xs mb-2">Your focus today</p>
            <p className="text-navy text-sm">{focusText}</p>
          </div>

          <button
            onClick={() => router.push('/home')}
            className="w-full bg-navy text-gold font-semibold py-4 rounded-xl active:scale-95 transition-all"
          >
            Back to home →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'focus') {
    return (
      <div className="px-5 pt-12 pb-8 animate-slide-up flex flex-col min-h-dvh">
        <h1 className="font-heading text-2xl font-bold text-navy mb-2">One focus</h1>
        <p className="text-navy/50 text-sm mb-8">
          What is one thing you want to focus on today?
        </p>

        <label htmlFor="focus-input" className="sr-only">Today&apos;s focus intention</label>
        <textarea
          id="focus-input"
          autoFocus
          value={focusText}
          onChange={e => setFocusText(e.target.value)}
          placeholder="Today I want to focus on…"
          rows={4}
          className="w-full border border-navy/15 text-navy rounded-xl px-4 py-4 focus:outline-none focus:border-gold transition-colors placeholder:text-navy/30 resize-none text-sm leading-relaxed"
        />

        <div className="flex-1" />

        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={saving || !focusText.trim()}
            className="w-full bg-navy text-gold font-semibold py-4 rounded-xl active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Submit Check-In ✓'}
          </button>
          <button
            onClick={() => setStep('rate')}
            className="w-full text-navy/50 text-sm py-2"
          >
            ← Back to scores
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold text-navy mb-1">Daily Check-In</h1>
      <p className="text-navy/50 text-sm mb-6">
        How are you doing across each area of your life?
      </p>

      <div className="space-y-4 mb-8">
        {lifeAreas.map(area => (
          <div key={area.id} className="card">
            <p className="text-navy font-medium text-sm mb-3">{area.name}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(score => {
                const selected = scores[area.name] === score
                return (
                  <button
                    key={score}
                    onClick={() => setScore(area.name, score)}
                    aria-label={`${area.name}: score ${score}`}
                    aria-pressed={selected}
                    className={`flex-1 py-2.5 rounded-xl text-lg transition-all active:scale-95 border ${
                      selected
                        ? 'bg-navy border-navy shadow-md'
                        : 'bg-navy/5 border-navy/10 hover:border-navy/30'
                    }`}
                  >
                    <span className="block text-center" aria-hidden="true">{SCORE_EMOJIS[score]}</span>
                    <span className={`block text-center text-[10px] font-medium mt-0.5 ${selected ? 'text-gold' : 'text-navy/50'}`}>
                      {score}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setStep('focus')}
        className="w-full bg-navy text-gold font-semibold py-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        Next <ChevronRight size={18} />
      </button>
    </div>
  )
}
