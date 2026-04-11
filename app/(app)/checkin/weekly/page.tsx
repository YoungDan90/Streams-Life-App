'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, TrendingDown, Minus, Share2, Flame } from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import type { CheckIn, LifeArea } from '@/lib/types'

interface WeekData {
  area: string
  current: number
  previous: number
  fullMark: 5
}

export default function WeeklyReviewPage() {
  const [data, setData] = useState<WeekData[]>([])
  const [summary, setSummary] = useState('')
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date()
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(now.getDate() - 7)
      const fourteenDaysAgo = new Date(now)
      fourteenDaysAgo.setDate(now.getDate() - 14)

      const [areasRes, checkinsRes] = await Promise.all([
        supabase.from('life_areas').select('*').eq('user_id', user.id),
        supabase
          .from('checkins')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
          .order('date', { ascending: false }),
      ])

      const areas: LifeArea[] = areasRes.data || []
      const checkins: CheckIn[] = checkinsRes.data || []

      const thisWeek = checkins.filter(
        c => new Date(c.date) >= sevenDaysAgo
      )
      const lastWeek = checkins.filter(
        c =>
          new Date(c.date) >= fourteenDaysAgo &&
          new Date(c.date) < sevenDaysAgo
      )

      function avgForArea(cins: CheckIn[], areaName: string): number {
        const scores = cins.map(c => (c.scores as Record<string, number>)[areaName]).filter(Boolean)
        if (!scores.length) return 0
        return scores.reduce((a, b) => a + b, 0) / scores.length
      }

      const weekData: WeekData[] = areas.map(a => ({
        area: a.name.split(' ')[0], // short label for chart
        current: avgForArea(thisWeek, a.name),
        previous: avgForArea(lastWeek, a.name),
        fullMark: 5,
      }))

      setData(weekData)

      // Calculate streak
      let s = 0
      let current = new Date()
      current.setHours(0, 0, 0, 0)
      const sorted = [...checkins].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      for (const c of sorted) {
        const d = new Date(c.date)
        d.setHours(0, 0, 0, 0)
        if (Math.round((current.getTime() - d.getTime()) / 86400000) === s) {
          s++
          current = d
        } else break
      }
      setStreak(s)
      setLoading(false)
    }
    load()
  }, [])

  const generateSummary = useCallback(async () => {
    if (summary) return
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      setSummary(json.summary || '')
    } catch {
      setSummary('Unable to generate summary at this time.')
    }
    setSummaryLoading(false)
  }, [summary])

  useEffect(() => {
    if (!loading && data.length) generateSummary()
  }, [loading, data.length, generateSummary])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy">Weekly Review</h1>
          <p className="text-navy/50 text-sm">Your last 7 days</p>
        </div>
        <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full">
          <Flame size={14} className="text-orange-500" />
          <span className="text-orange-600 font-semibold text-sm">{streak}</span>
        </div>
      </div>

      {/* Radar Chart */}
      {data.length > 0 && (
        <div className="card mb-5">
          <h2 className="font-heading text-sm font-semibold text-navy mb-4">Life Balance Radar</h2>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={data}>
              <PolarGrid stroke="rgba(13,27,42,0.08)" />
              <PolarAngleAxis
                dataKey="area"
                tick={{ fontSize: 11, fill: '#0D1B2A', opacity: 0.6 }}
              />
              <Radar
                name="Previous"
                dataKey="previous"
                stroke="rgba(13,27,42,0.2)"
                fill="rgba(13,27,42,0.05)"
                strokeDasharray="4 2"
              />
              <Radar
                name="This Week"
                dataKey="current"
                stroke="#C9A84C"
                fill="rgba(201,168,76,0.15)"
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-gold rounded" />
              <span className="text-navy/50 text-xs">This week</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-navy/20 rounded border-dashed" />
              <span className="text-navy/50 text-xs">Last week</span>
            </div>
          </div>
        </div>
      )}

      {/* Area comparisons */}
      <div className="card mb-5">
        <h2 className="font-heading text-sm font-semibold text-navy mb-3">Area Changes</h2>
        <div className="space-y-2">
          {data.map(d => {
            const diff = d.current - d.previous
            return (
              <div key={d.area} className="flex items-center justify-between py-1">
                <span className="text-navy/70 text-sm">{d.area}</span>
                <div className="flex items-center gap-2">
                  <span className="text-navy font-medium text-sm">
                    {d.current > 0 ? d.current.toFixed(1) : '—'}
                  </span>
                  {diff > 0.1 ? (
                    <TrendingUp size={14} className="text-green-500" />
                  ) : diff < -0.1 ? (
                    <TrendingDown size={14} className="text-red-400" />
                  ) : (
                    <Minus size={14} className="text-navy/30" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-navy rounded-card p-5 mb-5 shadow-card">
        <p className="text-gold text-xs font-medium uppercase tracking-wide mb-3">
          Liv&apos;s Weekly Summary
        </p>
        {summaryLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-white/50 text-sm">Generating summary…</span>
          </div>
        ) : (
          <p className="text-white/80 text-sm leading-relaxed">{summary}</p>
        )}
      </div>

      {/* Share button */}
      <button
        onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: 'My Streams Life Weekly Review',
              text: `This week's average across ${data.length} life areas. Powered by Streams Life.`,
            })
          }
        }}
        className="w-full flex items-center justify-center gap-2 bg-white border-2 border-navy/10 text-navy font-medium py-3 rounded-xl active:scale-95 transition-all"
      >
        <Share2 size={16} />
        Share my week
      </button>
    </div>
  )
}
