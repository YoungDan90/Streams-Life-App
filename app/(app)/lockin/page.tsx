'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Play, Pause, Square, Zap, ChevronDown } from 'lucide-react'
import type { LifeArea } from '@/lib/types'
import Confetti from '@/components/Confetti'

type TimerState = 'setup' | 'running' | 'paused' | 'done'

const PRESETS = [
  { label: '25 min', value: 25 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function LockInPage() {
  const [timerState, setTimerState] = useState<TimerState>('setup')
  const [taskName, setTaskName] = useState('')
  const [duration, setDuration] = useState(25)
  const [customDuration, setCustomDuration] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [selectedArea, setSelectedArea] = useState<string>('')
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [showAreaPicker, setShowAreaPicker] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const initialDurationRef = useRef<number>(0)

  useEffect(() => {
    async function loadAreas() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('life_areas').select('*').eq('user_id', user.id)
      setLifeAreas(data || [])
    }
    loadAreas()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tick = useCallback(() => {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    const remaining = initialDurationRef.current - elapsed
    if (remaining <= 0) {
      setTimeLeft(0)
      setElapsedMinutes(Math.round(initialDurationRef.current / 60))
      setTimerState('done')
      setShowConfetti(true)
      if (intervalRef.current) clearInterval(intervalRef.current)
      logSession()
    } else {
      setTimeLeft(remaining)
    }
  }, [])

  async function logSession(actualElapsedSecs?: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const durationMins = actualElapsedSecs !== undefined
      ? Math.max(1, Math.round(actualElapsedSecs / 60))
      : Math.round(initialDurationRef.current / 60)
    await supabase.from('focus_sessions').insert({
      user_id: user.id,
      task_name: taskName,
      life_area_id: selectedArea || null,
      duration_minutes: durationMins,
      completed_at: new Date().toISOString(),
    })
  }

  function startTimer() {
    const mins = useCustom ? parseInt(customDuration) || 25 : duration
    const secs = mins * 60
    initialDurationRef.current = secs
    startTimeRef.current = Date.now()
    setTimeLeft(secs)
    setTimerState('running')
    intervalRef.current = setInterval(tick, 500)
  }

  function pauseTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimerState('paused')
  }

  function resumeTimer() {
    startTimeRef.current = Date.now() - (initialDurationRef.current - timeLeft) * 1000
    setTimerState('running')
    intervalRef.current = setInterval(tick, 500)
  }

  function endSession() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const elapsedSecs = Math.round((Date.now() - startTimeRef.current) / 1000)
    const elapsedMins = Math.max(1, Math.round(elapsedSecs / 60))
    setElapsedMinutes(elapsedMins)
    logSession(elapsedSecs)
    setTimerState('done')
    setShowConfetti(true)
  }

  function resetTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimerState('setup')
    setTimeLeft(0)
    setTaskName('')
    setShowConfetti(false)
    setElapsedMinutes(0)
  }

  const totalSecs = initialDurationRef.current || duration * 60
  const progressPct =
    timerState === 'setup' ? 0 : ((totalSecs - timeLeft) / totalSecs) * 100

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60

  const circumference = 2 * Math.PI * 110
  const dashOffset = circumference - (progressPct / 100) * circumference

  // SETUP SCREEN
  if (timerState === 'setup') {
    return (
      <div className="px-5 pt-12 pb-8 animate-fade-in min-h-dvh">
        <h1 className="font-heading text-2xl font-bold text-navy mb-1">Lock In</h1>
        <p className="text-navy/50 text-sm mb-8">Distraction-free deep focus.</p>

        <div className="space-y-5">
          <div>
            <label className="block text-navy/60 text-sm font-medium mb-2">
              What are you working on?
            </label>
            <input
              type="text"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              placeholder="e.g. Write quarterly report"
              className="w-full border border-navy/15 text-navy rounded-xl px-4 py-3.5 focus:outline-none focus:border-gold transition-colors placeholder:text-navy/30 text-sm"
            />
          </div>

          <div>
            <label className="block text-navy/60 text-sm font-medium mb-2">Duration</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setDuration(p.value); setUseCustom(false) }}
                  className={`py-3 rounded-xl font-medium text-sm transition-all active:scale-95 border ${
                    !useCustom && duration === p.value
                      ? 'bg-navy text-gold border-navy'
                      : 'bg-navy/5 text-navy border-navy/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseCustom(!useCustom)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  useCustom ? 'bg-gold/10 border-gold text-gold' : 'border-navy/15 text-navy/50'
                }`}
              >
                Custom
              </button>
              {useCustom && (
                <input
                  type="number"
                  value={customDuration}
                  onChange={e => setCustomDuration(e.target.value)}
                  placeholder="Minutes"
                  min="1"
                  max="180"
                  className="flex-1 border border-navy/15 text-navy rounded-xl px-3 py-2 focus:outline-none focus:border-gold transition-colors text-sm"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-navy/60 text-sm font-medium mb-2">
              Life area (optional)
            </label>
            <button
              onClick={() => setShowAreaPicker(!showAreaPicker)}
              className="w-full flex items-center justify-between border border-navy/15 text-navy rounded-xl px-4 py-3.5 text-sm"
            >
              <span className={selectedArea ? 'text-navy' : 'text-navy/30'}>
                {lifeAreas.find(a => a.id === selectedArea)?.name || 'Select a life area'}
              </span>
              <ChevronDown size={16} className="text-navy/40" />
            </button>
            {showAreaPicker && (
              <div className="mt-2 bg-white border border-navy/10 rounded-xl overflow-hidden shadow-card animate-slide-up">
                <button
                  onClick={() => { setSelectedArea(''); setShowAreaPicker(false) }}
                  className="w-full text-left px-4 py-3 text-navy/50 text-sm hover:bg-navy/5 border-b border-navy/5"
                >
                  None
                </button>
                {lifeAreas.map(area => (
                  <button
                    key={area.id}
                    onClick={() => { setSelectedArea(area.id); setShowAreaPicker(false) }}
                    className="w-full text-left px-4 py-3 text-navy text-sm hover:bg-navy/5 border-b border-navy/5 last:border-0"
                  >
                    {area.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={startTimer}
            disabled={!taskName.trim()}
            className="w-full bg-navy text-gold font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 mt-4"
          >
            <Zap size={20} />
            Start Session
          </button>
        </div>
      </div>
    )
  }

  // DONE SCREEN
  if (timerState === 'done') {
    return (
      <div className="min-h-dvh bg-navy flex flex-col items-center justify-center px-6 text-center animate-fade-in">
        <Confetti trigger={showConfetti} />
        <div className="w-24 h-24 bg-gold/20 rounded-full flex items-center justify-center mb-6">
          <Zap size={44} className="text-gold" />
        </div>
        <h1 className="font-heading text-3xl font-bold text-white mb-2">
          Session complete
        </h1>
        <p className="text-white/60 text-lg mb-2">Well done.</p>
        <p className="text-gold/70 text-sm mb-10">
          {taskName} — {elapsedMinutes > 0 ? elapsedMinutes : (useCustom ? parseInt(customDuration) || 25 : duration)} min
        </p>
        <button
          onClick={resetTimer}
          className="w-full max-w-xs bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all shadow-gold"
        >
          Start Another Session
        </button>
      </div>
    )
  }

  // TIMER SCREEN (running / paused)
  return (
    <div className="min-h-dvh bg-navy flex flex-col items-center justify-center px-6 animate-fade-in">
      {/* Task */}
      <p className="text-white/40 text-sm uppercase tracking-widest mb-8 text-center">
        {taskName}
      </p>

      {/* Timer Ring */}
      <div className="relative mb-10">
        <svg width={260} height={260} className="-rotate-90">
          <circle
            cx={130}
            cy={130}
            r={110}
            fill="none"
            stroke="rgba(201,168,76,0.1)"
            strokeWidth={8}
          />
          <circle
            cx={130}
            cy={130}
            r={110}
            fill="none"
            stroke="#C9A84C"
            strokeWidth={8}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-heading text-6xl font-bold text-gold tabular-nums ${
              timerState === 'running' ? 'timer-pulse' : ''
            }`}
          >
            {pad(mins)}:{pad(secs)}
          </span>
          <span className="text-white/30 text-sm mt-1">
            {timerState === 'paused' ? 'Paused' : 'remaining'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        {timerState === 'running' ? (
          <button
            onClick={pauseTimer}
            className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center active:scale-95 transition-all hover:bg-white/15"
          >
            <Pause size={24} className="text-white" />
          </button>
        ) : (
          <button
            onClick={resumeTimer}
            className="w-16 h-16 bg-gold rounded-full flex items-center justify-center active:scale-95 transition-all shadow-gold"
          >
            <Play size={24} className="text-navy" fill="currentColor" />
          </button>
        )}

        <button
          onClick={endSession}
          className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center active:scale-95 transition-all hover:bg-white/10"
        >
          <Square size={20} className="text-white/50" />
        </button>
      </div>

      <button
        onClick={resetTimer}
        className="mt-8 text-white/25 text-sm hover:text-white/50 transition-colors"
      >
        Cancel session
      </button>
    </div>
  )
}
