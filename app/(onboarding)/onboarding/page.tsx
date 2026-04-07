'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_LIFE_AREAS } from '@/lib/types'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

const GOAL_PLACEHOLDERS: Record<string, string> = {
  'Health & Fitness':        'e.g. Lose 8 pounds by summer',
  'Family & Relationships':  'e.g. Have a weekly family dinner',
  'Faith & Spirituality':    'e.g. Meditate for 10 minutes every morning',
  'Finance & Wealth':        'e.g. Save £500 per month',
  'Career & Business':       'e.g. Launch my side project',
  'Personal Growth':         'e.g. Read 12 books this year',
  'Social Life':             'e.g. See friends at least once a week',
  'Rest & Recreation':       'e.g. Take one full day off each week',
}

function getPlaceholder(area: string): string {
  return GOAL_PLACEHOLDERS[area] || 'e.g. Set a meaningful goal for this area'
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [firstName, setFirstName] = useState('')
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [customAreas, setCustomAreas] = useState<string[]>(['', ''])
  const [areaGoals, setAreaGoals] = useState<Record<string, string>>({})
  const [bigWhy, setBigWhy] = useState('')
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [notifyTime, setNotifyTime] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const TOTAL_STEPS = 7
  const progress = (step / TOTAL_STEPS) * 100

  function toggleArea(area: string) {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  function updateCustomArea(index: number, value: string) {
    setCustomAreas(prev => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  function getAllAreas(): string[] {
    return [
      ...selectedAreas,
      ...customAreas.filter(a => a.trim().length > 0),
    ]
  }

  function setGoalForArea(area: string, value: string) {
    setAreaGoals(prev => ({ ...prev, [area]: value }))
  }

  function canProceed(): boolean {
    if (step === 2) return firstName.trim().length > 0
    if (step === 3) return getAllAreas().length >= 3
    if (step === 5) return bigWhy.trim().length > 10
    return true
  }

  async function handleFinish() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const areas = getAllAreas()

    // Save profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        first_name: firstName.trim(),
        big_why: bigWhy.trim(),
        notification_time: notifyEnabled ? notifyTime : null,
        onboarding_complete: true,
      })

    if (profileError) {
      setError('Failed to save profile. Please try again.')
      setSaving(false)
      return
    }

    // Save life areas — get IDs back so we can link goals
    const { data: insertedAreas, error: areasError } = await supabase
      .from('life_areas')
      .insert(
        areas.map(name => ({
          user_id: user.id,
          name,
          is_custom: !DEFAULT_LIFE_AREAS.includes(name),
        }))
      )
      .select('id, name')

    if (areasError) {
      setError('Failed to save life areas. Please try again.')
      setSaving(false)
      return
    }

    // Save goals for areas that have a goal entered
    const ninetyDaysOut = new Date()
    ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90)
    const targetDate = ninetyDaysOut.toISOString().split('T')[0]

    const goalRows = (insertedAreas || [])
      .filter(area => areaGoals[area.name]?.trim())
      .map(area => ({
        user_id: user.id,
        life_area_id: area.id,
        title: areaGoals[area.name].trim(),
        target_date: targetDate,
        progress: 0,
      }))

    if (goalRows.length > 0) {
      await supabase.from('goals').insert(goalRows)
    }

    router.push('/home')
  }

  const goalsEntered = Object.values(areaGoals).filter(v => v.trim()).length

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Progress bar */}
      {step > 1 && (
        <div className="px-6 pt-12 pb-2">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-white/40 text-xs mt-2 text-right">Step {step} of {TOTAL_STEPS}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 pt-8 pb-10 animate-slide-up">

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="w-24 h-24 bg-gold rounded-3xl flex items-center justify-center mb-6 shadow-gold">
              <span className="font-heading text-5xl font-bold text-navy">S</span>
            </div>
            <h1 className="font-heading text-4xl font-bold text-white mb-3">
              Streams Life
            </h1>
            <p className="text-gold text-lg mb-4">Build the business. Live the life.</p>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Your personal life operating system — helping you build daily structure, sustained focus, and long-term momentum across every area of your life.
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-10 w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all shadow-gold"
            >
              Get Started →
            </button>
          </div>
        )}

        {/* Step 2: Your Name */}
        {step === 2 && (
          <div className="flex flex-col flex-1">
            <h2 className="font-heading text-3xl font-bold text-white mb-2">
              What&apos;s your name?
            </h2>
            <p className="text-white/50 text-sm mb-8">
              We&apos;ll use this to personalise your experience.
            </p>
            <input
              autoFocus
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Your first name"
              className="w-full bg-navy-50 border border-gold/20 text-white text-lg rounded-xl px-4 py-4 focus:outline-none focus:border-gold transition-colors placeholder:text-white/30"
            />
            <div className="flex-1" />
            <button
              onClick={() => setStep(3)}
              disabled={!canProceed()}
              className="w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 3: Life Areas */}
        {step === 3 && (
          <div className="flex flex-col flex-1">
            <h2 className="font-heading text-3xl font-bold text-white mb-2">
              Your life areas
            </h2>
            <p className="text-white/50 text-sm mb-6">
              Select the areas that matter most to you. Choose at least 3.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {DEFAULT_LIFE_AREAS.map(area => {
                const selected = selectedAreas.includes(area)
                return (
                  <button
                    key={area}
                    onClick={() => toggleArea(area)}
                    className={`py-3 px-3 rounded-xl text-sm font-medium text-left transition-all active:scale-95 border ${
                      selected
                        ? 'bg-gold text-navy border-gold'
                        : 'bg-white/5 text-white/70 border-white/10 hover:border-gold/40'
                    }`}
                  >
                    {area}
                  </button>
                )
              })}
            </div>

            <p className="text-white/40 text-xs mb-3">Add your own (optional)</p>
            <div className="space-y-2 mb-6">
              {customAreas.map((area, i) => (
                <input
                  key={i}
                  type="text"
                  value={area}
                  onChange={e => updateCustomArea(i, e.target.value)}
                  placeholder={`Custom area ${i + 1}`}
                  className="w-full bg-navy-50 border border-gold/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors placeholder:text-white/30 text-sm"
                />
              ))}
            </div>

            <p className="text-gold/60 text-xs mb-4">
              {getAllAreas().length} selected{getAllAreas().length < 3 && ' (need at least 3)'}
            </p>

            <button
              onClick={() => setStep(4)}
              disabled={!canProceed()}
              className="w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 4: Goals per life area (NEW) */}
        {step === 4 && (
          <div className="flex flex-col flex-1">
            <h2 className="font-heading text-3xl font-bold text-white mb-2">
              Set your goals
            </h2>
            <p className="text-white/50 text-sm mb-6">
              What do you want to achieve in each area? Even one sentence is enough — Liv will help you build a plan.
            </p>

            <div className="space-y-4 flex-1 overflow-y-auto hide-scrollbar pb-4">
              {getAllAreas().map(area => (
                <div key={area}>
                  <label className="block text-gold/80 text-xs font-semibold uppercase tracking-wide mb-2">
                    {area}
                  </label>
                  <input
                    type="text"
                    value={areaGoals[area] || ''}
                    onChange={e => setGoalForArea(area, e.target.value)}
                    placeholder={getPlaceholder(area)}
                    className="w-full bg-navy-50 border border-gold/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors placeholder:text-white/25 text-sm"
                  />
                </div>
              ))}
            </div>

            <p className="text-white/30 text-xs mt-4 mb-4">
              {goalsEntered > 0
                ? `${goalsEntered} of ${getAllAreas().length} goals set — you can always add more later.`
                : 'Skip any area you&apos;re not ready to set a goal for yet.'}
            </p>

            <button
              onClick={() => setStep(5)}
              className="w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 5: Big Why (was step 4) */}
        {step === 5 && (
          <div className="flex flex-col flex-1">
            <h2 className="font-heading text-3xl font-bold text-white mb-2">
              Your big why
            </h2>
            <p className="text-white/50 text-sm mb-8">
              What does living a full life mean to you?
            </p>
            <textarea
              autoFocus
              value={bigWhy}
              onChange={e => setBigWhy(e.target.value)}
              placeholder="For me, a full life means…"
              rows={5}
              className="w-full bg-navy-50 border border-gold/20 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-gold transition-colors placeholder:text-white/30 resize-none text-sm leading-relaxed"
            />
            <p className="text-white/30 text-xs mt-2">
              This is private and helps Liv give you more personal coaching.
            </p>
            <div className="flex-1" />
            <button
              onClick={() => setStep(6)}
              disabled={!canProceed()}
              className="w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 6: Notifications (was step 5) */}
        {step === 6 && (
          <div className="flex flex-col flex-1">
            <h2 className="font-heading text-3xl font-bold text-white mb-2">
              Daily reminder
            </h2>
            <p className="text-white/50 text-sm mb-8">
              Would you like a daily check-in reminder?
            </p>

            <div className="space-y-3 mb-8">
              <button
                onClick={() => setNotifyEnabled(true)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  notifyEnabled
                    ? 'bg-gold/10 border-gold text-white'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  notifyEnabled ? 'border-gold' : 'border-white/30'
                }`}>
                  {notifyEnabled && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                </div>
                <span className="font-medium">Yes, remind me</span>
              </button>

              <button
                onClick={() => setNotifyEnabled(false)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  !notifyEnabled
                    ? 'bg-gold/10 border-gold text-white'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  !notifyEnabled ? 'border-gold' : 'border-white/30'
                }`}>
                  {!notifyEnabled && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                </div>
                <span className="font-medium">Not now</span>
              </button>
            </div>

            {notifyEnabled && (
              <div className="animate-fade-in mb-6">
                <label className="block text-gold/80 text-sm font-medium mb-2">
                  What time?
                </label>
                <input
                  type="time"
                  value={notifyTime}
                  onChange={e => setNotifyTime(e.target.value)}
                  className="w-full bg-navy-50 border border-gold/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors text-lg"
                />
              </div>
            )}

            <div className="flex-1" />
            <button
              onClick={() => setStep(7)}
              className="w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 7: Ready (was step 6) */}
        {step === 7 && (
          <div className="flex flex-col flex-1">
            <h2 className="font-heading text-3xl font-bold text-white mb-2">
              You&apos;re ready, {firstName} 🌟
            </h2>
            <p className="text-white/50 text-sm mb-6">
              Here&apos;s what you&apos;ve set up for yourself.
            </p>

            <div className="space-y-4 mb-6 overflow-y-auto hide-scrollbar flex-1">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-gold text-xs font-medium mb-2 uppercase tracking-wide">Your life areas</p>
                <div className="flex flex-wrap gap-2">
                  {getAllAreas().map(area => (
                    <span key={area} className="bg-gold/10 text-gold text-xs px-3 py-1 rounded-full border border-gold/20">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              {goalsEntered > 0 && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-gold text-xs font-medium mb-3 uppercase tracking-wide">Your goals</p>
                  <div className="space-y-2">
                    {getAllAreas()
                      .filter(area => areaGoals[area]?.trim())
                      .map(area => (
                        <div key={area}>
                          <p className="text-white/40 text-xs">{area}</p>
                          <p className="text-white/80 text-sm">{areaGoals[area]}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-gold text-xs font-medium mb-1 uppercase tracking-wide">Your why</p>
                <p className="text-white/70 text-sm leading-relaxed">{bigWhy}</p>
              </div>

              {notifyEnabled && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-gold text-xs font-medium mb-1 uppercase tracking-wide">Daily reminder</p>
                  <p className="text-white/70 text-sm">{notifyTime} every day</p>
                </div>
              )}
            </div>

            <p className="text-white/40 text-sm text-center mb-4">
              Your AI coach Liv will use all of this to guide you. Let&apos;s build a life you&apos;re proud of.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all disabled:opacity-50 shadow-gold"
            >
              {saving ? 'Setting up…' : "Let's go →"}
            </button>
          </div>
        )}
      </div>

      {/* Back button */}
      {step > 1 && (
        <div className="px-6 pb-8">
          <button
            onClick={() => setStep((step - 1) as Step)}
            className="text-white/40 text-sm hover:text-white/70 transition-colors"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}
