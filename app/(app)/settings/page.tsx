'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ChevronRight, X, Check, Trash2, Download,
  AlertTriangle, Crown, Star, Eye, FileText, Mail, ExternalLink,
  Plus, Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Toast, { ToastState } from '@/components/ui/Toast'
import type { Profile, LifeArea, CheckIn, Goal, FocusSession } from '@/lib/types'

// ─── App version ────────────────────────────────────────────
const APP_VERSION = '1.0.0'

// ─── Plan feature lists ──────────────────────────────────────
const FREE_FEATURES = [
  'Daily check-ins',
  'Basic Liv coaching',
  'Lock In focus timer',
  '3 active goals',
]
const PRO_FEATURES = [
  'Unlimited goals',
  'Full Liv conversation history',
  'Vision board',
  'Check-in progress heatmap',
  'Calendar view',
  'Weekly AI summary',
  'Priority support',
]

// ─── Helpers ────────────────────────────────────────────────
type ModalType =
  | 'editName' | 'editEmail' | 'changePassword' | 'deleteAccount'
  | 'upgrade' | 'editBigWhy' | 'resetConversations' | 'livContext'
  | 'clearCheckins' | 'deleteAllData' | 'feedback' | 'editArea' | 'deleteArea'

export default function SettingsPage() {
  const router = useRouter()

  // Profile state
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [lifeAreas, setLifeAreas]   = useState<LifeArea[]>([])
  const [loading, setLoading]       = useState(true)

  // Liv context state
  const [livContext, setLivContext]  = useState<{
    checkins: CheckIn[]
    goals: Goal[]
    sessions: FocusSession[]
  } | null>(null)

  // Modal
  const [modal, setModal]           = useState<ModalType | null>(null)
  const [editingArea, setEditingArea] = useState<LifeArea | null>(null)

  // Form values
  const [firstName, setFirstName]   = useState('')
  const [email, setEmail]           = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [bigWhy, setBigWhy]         = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [areaEditName, setAreaEditName] = useState('')
  const [newAreaName, setNewAreaName] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Toast
  const [toast, setToast]           = useState<ToastState | null>(null)
  const [saving, setSaving]         = useState(false)

  const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  function openModal(m: ModalType) {
    setModal(m)
    setSaving(false)
    setDeleteConfirmText('')
    setNewPassword('')
    setConfirmPassword('')
  }

  function closeModal() {
    setModal(null)
    setEditingArea(null)
    setDeleteConfirmText('')
  }

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, areasRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('life_areas').select('*').eq('user_id', user.id).order('created_at'),
      ])

      const p = profileRes.data as Profile
      setProfile(p)
      setLifeAreas(areasRes.data || [])
      setFirstName(p?.first_name || '')
      setBigWhy(p?.big_why || '')
      setEmail(user.email || '')
      setLoading(false)
    }
    load()
  }, [])

  // ── Save profile field ─────────────────────────────────────
  async function saveProfile(patch: Partial<Profile>) {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) { showToast('Failed to save', 'error'); setSaving(false); return }

    setProfile(prev => prev ? { ...prev, ...patch } : prev)
    showToast('Saved')
    setSaving(false)
    closeModal()
  }

  // ── Toggle (instant save) ──────────────────────────────────
  async function togglePref(field: keyof Profile, value: boolean | string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id)
    setProfile(prev => prev ? { ...prev, [field]: value } : prev)
    showToast('Saved')
  }

  // ── Change email ───────────────────────────────────────────
  async function handleChangeEmail() {
    if (!email.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email })
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('Confirmation sent to new email')
    setSaving(false)
    closeModal()
  }

  // ── Change password ────────────────────────────────────────
  async function handleChangePassword() {
    if (newPassword.length < 8) { showToast('Password must be 8+ characters', 'error'); return }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('Password updated')
    setSaving(false)
    closeModal()
  }

  // ── Delete account ─────────────────────────────────────────
  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setSaving(true)
    const res = await fetch('/api/settings/delete-account', { method: 'POST' })
    if (!res.ok) { showToast('Failed to delete account', 'error'); setSaving(false); return }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/signup')
  }

  // ── Life areas ─────────────────────────────────────────────
  async function saveAreaName() {
    if (!editingArea || !areaEditName.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('life_areas').update({ name: areaEditName.trim() }).eq('id', editingArea.id)
    setLifeAreas(prev => prev.map(a => a.id === editingArea.id ? { ...a, name: areaEditName.trim() } : a))
    showToast('Life area updated')
    setSaving(false)
    closeModal()
  }

  async function deleteArea() {
    if (!editingArea) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('life_areas').delete().eq('id', editingArea.id)
    setLifeAreas(prev => prev.filter(a => a.id !== editingArea.id))
    showToast('Life area removed')
    setSaving(false)
    closeModal()
  }

  async function addArea() {
    if (!newAreaName.trim() || lifeAreas.length >= 10) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('life_areas')
      .insert({ user_id: user.id, name: newAreaName.trim(), is_custom: true })
      .select().single()
    if (data) setLifeAreas(prev => [...prev, data as LifeArea])
    setNewAreaName('')
    showToast('Life area added')
    setSaving(false)
  }

  // ── Reset Liv conversations ────────────────────────────────
  async function resetConversations() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('coach_conversations').delete().eq('user_id', user.id)
    showToast('Conversation history cleared')
    setSaving(false)
    closeModal()
  }

  // ── Load Liv context ───────────────────────────────────────
  async function loadLivContext() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const [checkinsRes, goalsRes, sessionsRes] = await Promise.all([
      supabase.from('checkins').select('*').eq('user_id', user.id)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0]).order('date', { ascending: false }),
      supabase.from('goals').select('*, life_areas(name)').eq('user_id', user.id).lt('progress', 100),
      supabase.from('focus_sessions').select('*').eq('user_id', user.id)
        .gte('completed_at', sevenDaysAgo.toISOString()),
    ])
    setLivContext({
      checkins: (checkinsRes.data || []) as CheckIn[],
      goals: (goalsRes.data || []) as Goal[],
      sessions: (sessionsRes.data || []) as FocusSession[],
    })
    openModal('livContext')
  }

  // ── Clear check-in history ─────────────────────────────────
  async function clearCheckins() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('checkins').delete().eq('user_id', user.id)
    showToast('Check-in history cleared')
    setSaving(false)
    closeModal()
  }

  // ── Delete all data ────────────────────────────────────────
  async function deleteAllData() {
    if (deleteConfirmText !== 'DELETE') return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Delete storage images first
    const { data: storageFiles } = await supabase.storage
      .from('vision-board-images')
      .list(user.id)
    if (storageFiles && storageFiles.length > 0) {
      const paths = storageFiles.map(f => `${user.id}/${f.name}`)
      await supabase.storage.from('vision-board-images').remove(paths)
    }

    await Promise.all([
      supabase.from('checkins').delete().eq('user_id', user.id),
      supabase.from('goals').delete().eq('user_id', user.id),
      supabase.from('focus_sessions').delete().eq('user_id', user.id),
      supabase.from('coach_conversations').delete().eq('user_id', user.id),
      supabase.from('vision_board_items').delete().eq('user_id', user.id),
    ])
    showToast('All data deleted')
    setSaving(false)
    closeModal()
  }

  // ── Send feedback ──────────────────────────────────────────
  async function sendFeedback() {
    if (!feedbackText.trim()) return
    setSaving(true)
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: feedbackText }),
    })
    setFeedbackText('')
    showToast('Feedback sent — thank you!')
    setSaving(false)
    closeModal()
  }

  // ── Export CSV ─────────────────────────────────────────────
  async function exportData() {
    showToast('Preparing export…')
    const res = await fetch('/api/export')
    if (!res.ok) { showToast('Export failed', 'error'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `streams-life-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Export downloaded')
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-cream">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isPro = profile.subscription_plan === 'pro'

  // ── Shared UI primitives ────────────────────────────────────
  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-5">
        <p className="text-navy/40 text-xs font-semibold uppercase tracking-widest px-1 mb-2">{title}</p>
        <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-navy/5">
          {children}
        </div>
      </div>
    )
  }

  function Row({
    label, value, onPress, destructive = false, icon, badge,
  }: {
    label: string
    value?: string
    onPress?: () => void
    destructive?: boolean
    icon?: React.ReactNode
    badge?: React.ReactNode
  }) {
    return (
      <button
        onClick={onPress}
        disabled={!onPress}
        className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${
          onPress ? (destructive ? 'active:bg-red-50' : 'active:bg-navy/3 hover:bg-navy/2') : ''
        }`}
      >
        <div className="flex items-center gap-3">
          {icon && <span className={destructive ? 'text-red-400' : 'text-navy/40'}>{icon}</span>}
          <span className={`text-sm font-medium ${destructive ? 'text-red-500' : 'text-navy'}`}>
            {label}
          </span>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {value && <span className="text-navy/40 text-sm">{value}</span>}
          {onPress && <ChevronRight size={15} className={destructive ? 'text-red-300' : 'text-navy/50'} />}
        </div>
      </button>
    )
  }

  function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
    return (
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-gold' : 'bg-navy/30'}`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            on ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    )
  }

  function ToggleRow({ label, sublabel, on, onChange }: {
    label: string; sublabel?: string; on: boolean; onChange: (v: boolean) => void
  }) {
    return (
      <div className="flex items-center justify-between px-4 py-3.5">
        <div>
          <p className="text-navy text-sm font-medium">{label}</p>
          {sublabel && <p className="text-navy/50 text-xs mt-0.5">{sublabel}</p>}
        </div>
        <Toggle on={on} onChange={onChange} label={label} />
      </div>
    )
  }

  // ── Modal shell ────────────────────────────────────────────
  function Modal({ title, onClose, children }: {
    title: string; onClose: () => void; children: React.ReactNode
  }) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[85dvh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-navy/6 flex-shrink-0">
            <h3 className="font-heading text-base font-bold text-navy">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-navy/5">
              <X size={15} className="text-navy/60" aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 py-5 hide-scrollbar">
            {children}
          </div>
        </div>
      </>
    )
  }

  function Input({ label, value, onChange, type = 'text', placeholder }: {
    label: string; value: string; onChange: (v: string) => void
    type?: string; placeholder?: string
  }) {
    return (
      <div className="mb-4">
        <label className="block text-navy/60 text-xs font-medium mb-1.5">{label}</label>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-navy/15 text-navy rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors text-sm placeholder:text-navy/30"
        />
      </div>
    )
  }

  function SaveBtn({ onPress, label = 'Save', disabled }: {
    onPress: () => void; label?: string; disabled?: boolean
  }) {
    return (
      <button
        onClick={onPress}
        disabled={saving || disabled}
        className="w-full bg-navy text-gold font-semibold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-40 mt-2"
      >
        {saving ? 'Saving…' : label}
      </button>
    )
  }

  // ─────────────────────────────────────────────────────────
  return (
    <>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="min-h-dvh bg-cream">
        {/* Header */}
        <div className="bg-cream px-5 pt-12 pb-4 flex items-center gap-3 border-b border-navy/6">
          <button
            onClick={() => router.push('/home')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-navy/5 active:bg-navy/10 flex-shrink-0"
          >
            <ArrowLeft size={18} className="text-navy/70" />
          </button>
          <h1 className="font-heading text-xl font-bold text-navy">Settings</h1>
        </div>

        {/* Plan badge */}
        {isPro && (
          <div className="mx-5 mt-4 bg-navy rounded-2xl px-4 py-3 flex items-center gap-3 shadow-card">
            <Crown size={18} className="text-gold" />
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Pro Member</p>
              <p className="text-white/40 text-xs">All features unlocked</p>
            </div>
            <span className="bg-gold/20 text-gold text-xs font-bold px-2.5 py-1 rounded-full">PRO</span>
          </div>
        )}

        <div className="px-5 pt-5 pb-32">

          {/* ── ACCOUNT ── */}
          <SectionCard title="Account">
            <Row
              label="First name"
              value={profile.first_name || '—'}
              onPress={() => openModal('editName')}
            />
            <Row
              label="Email"
              value={email}
              onPress={() => openModal('editEmail')}
            />
            <Row
              label="Change password"
              onPress={() => openModal('changePassword')}
            />
            <Row
              label="Delete account"
              destructive
              icon={<Trash2 size={15} />}
              onPress={() => openModal('deleteAccount')}
            />
          </SectionCard>

          {/* ── SUBSCRIPTION ── */}
          <SectionCard title="Subscription">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-navy font-semibold text-sm">Current plan</p>
                  <p className="text-navy/40 text-xs mt-0.5">
                    {isPro ? 'Streams Life Pro' : 'Free plan'}
                  </p>
                </div>
                {isPro
                  ? <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Check size={11} /> Pro
                    </span>
                  : <span className="bg-navy/5 text-navy/50 text-xs font-semibold px-3 py-1.5 rounded-full">Free</span>
                }
              </div>

              {/* Feature list */}
              <div className="space-y-1.5 mb-4">
                {(isPro ? PRO_FEATURES : FREE_FEATURES).map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={12} className={isPro ? 'text-gold' : 'text-navy/30'} />
                    <span className="text-navy/70 text-xs">{f}</span>
                  </div>
                ))}
              </div>

              {!isPro && (
                <>
                  <button
                    onClick={() => openModal('upgrade')}
                    className="w-full bg-gold text-navy font-bold py-3.5 rounded-xl active:scale-95 transition-all shadow-gold flex items-center justify-center gap-2 mb-2"
                  >
                    <Crown size={16} />
                    Upgrade to Pro
                  </button>
                  <button className="w-full text-navy/40 text-xs py-2 active:text-navy/60">
                    Restore purchase
                  </button>
                </>
              )}
            </div>
          </SectionCard>

          {/* ── NOTIFICATIONS ── */}
          <SectionCard title="Notifications">
            <ToggleRow
              label="Daily check-in reminder"
              sublabel={profile.notification_time ? `At ${profile.notification_time}` : 'No time set'}
              on={profile.notify_checkin ?? false}
              onChange={v => togglePref('notify_checkin', v)}
            />
            {profile.notify_checkin && (
              <div className="px-4 pb-3">
                <label className="block text-navy/50 text-xs mb-1.5">Reminder time</label>
                <input
                  type="time"
                  defaultValue={profile.notification_time || '08:00'}
                  onChange={async e => {
                    await togglePref('notification_time' as keyof Profile, e.target.value)
                  }}
                  className="border border-navy/15 text-navy rounded-xl px-3 py-2 focus:outline-none focus:border-gold text-sm"
                />
              </div>
            )}
            <ToggleRow
              label="Weekly review reminder"
              sublabel="Every Sunday morning"
              on={profile.notify_weekly ?? false}
              onChange={v => togglePref('notify_weekly', v)}
            />
            <ToggleRow
              label="Goal deadline reminders"
              sublabel="48 hours before due date"
              on={profile.notify_goals ?? false}
              onChange={v => togglePref('notify_goals', v)}
            />
          </SectionCard>

          {/* ── APPEARANCE ── */}
          <SectionCard title="Appearance">
            <div className="px-4 py-3.5">
              <p className="text-navy text-sm font-medium mb-3">Theme</p>
              <div className="flex gap-2">
                {(['light', 'dark'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => togglePref('appearance_mode', mode)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize ${
                      profile.appearance_mode === mode
                        ? 'bg-navy text-gold border-navy'
                        : 'bg-navy/5 text-navy/50 border-navy/10'
                    }`}
                  >
                    {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-3.5 border-t border-navy/5">
              <p className="text-navy text-sm font-medium mb-3">Text size</p>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => togglePref('text_size', size)}
                    className={`flex-1 py-2.5 rounded-xl font-medium border transition-all capitalize ${
                      profile.text_size === size
                        ? 'bg-navy text-gold border-navy'
                        : 'bg-navy/5 text-navy/50 border-navy/10'
                    } ${size === 'small' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-sm'}`}
                  >
                    {size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* ── LIFE AREAS ── */}
          <SectionCard title="Life Areas">
            {lifeAreas.map(area => (
              <div key={area.id} className="flex items-center justify-between px-4 py-3.5 border-b border-navy/5 last:border-0">
                <span className="text-navy text-sm font-medium">{area.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingArea(area); setAreaEditName(area.name); openModal('editArea') }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-navy/5 active:bg-navy/10"
                  >
                    <Pencil size={12} className="text-navy/50" />
                  </button>
                  <button
                    onClick={() => { setEditingArea(area); openModal('deleteArea') }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 active:bg-red-100"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add new area */}
            {lifeAreas.length < 10 && (
              <div className="px-4 py-3.5 border-t border-navy/5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAreaName}
                    onChange={e => setNewAreaName(e.target.value)}
                    placeholder="Add a new life area"
                    className="flex-1 border border-navy/15 text-navy rounded-xl px-3 py-2.5 focus:outline-none focus:border-gold text-sm placeholder:text-navy/30"
                    onKeyDown={e => { if (e.key === 'Enter') addArea() }}
                  />
                  <button
                    onClick={addArea}
                    disabled={!newAreaName.trim()}
                    className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
                  >
                    <Plus size={16} className="text-gold" />
                  </button>
                </div>
                <p className="text-navy/50 text-xs mt-1.5">{lifeAreas.length}/10 areas</p>
              </div>
            )}
            {lifeAreas.length >= 10 && (
              <div className="px-4 py-3 bg-amber-50 border-t border-navy/5">
                <p className="text-amber-700 text-xs">Maximum of 10 life areas reached.</p>
              </div>
            )}
          </SectionCard>

          {/* ── LIV COACH ── */}
          <SectionCard title="Liv Coach">
            <Row
              label="Update my Big Why"
              value={profile.big_why ? profile.big_why.slice(0, 30) + '…' : 'Not set'}
              onPress={() => { setBigWhy(profile.big_why || ''); openModal('editBigWhy') }}
            />
            <Row
              label="What Liv knows about me"
              icon={<Eye size={14} />}
              onPress={loadLivContext}
            />
            <Row
              label="Reset conversation history"
              destructive
              icon={<Trash2 size={15} />}
              onPress={() => openModal('resetConversations')}
            />
          </SectionCard>

          {/* ── PRIVACY & DATA ── */}
          <SectionCard title="Privacy & Data">
            <Row
              label="Export my data (CSV)"
              icon={<Download size={14} />}
              onPress={exportData}
            />
            <Row
              label="Clear check-in history"
              destructive
              icon={<Trash2 size={15} />}
              onPress={() => openModal('clearCheckins')}
            />
            <Row
              label="Delete all my data"
              destructive
              icon={<Trash2 size={15} />}
              onPress={() => openModal('deleteAllData')}
            />
            <Row
              label="Privacy Policy"
              icon={<FileText size={14} />}
              onPress={() => window.open('https://streamslife.app/privacy', '_blank')}
            />
          </SectionCard>

          {/* ── ABOUT ── */}
          <SectionCard title="About">
            <Row label="Version" value={APP_VERSION} />
            <Row
              label="Send feedback"
              icon={<Mail size={14} />}
              onPress={() => openModal('feedback')}
            />
            <Row
              label="Rate Streams Life"
              icon={<Star size={14} />}
              onPress={() => window.open('https://streamslife.app/rate', '_blank')}
            />
            <Row
              label="Terms of Service"
              icon={<ExternalLink size={14} />}
              onPress={() => window.open('https://streamslife.app/terms', '_blank')}
            />
          </SectionCard>

          {/* Sign out */}
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full text-red-500 font-semibold py-4 rounded-2xl bg-white shadow-card text-sm active:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────── */}

      {modal === 'editName' && (
        <Modal title="Edit first name" onClose={closeModal}>
          <Input label="First name" value={firstName} onChange={setFirstName} placeholder="Your name" />
          <SaveBtn onPress={() => saveProfile({ first_name: firstName })} />
        </Modal>
      )}

      {modal === 'editEmail' && (
        <Modal title="Change email" onClose={closeModal}>
          <p className="text-navy/50 text-sm mb-4">
            We&apos;ll send a confirmation to your new email address.
          </p>
          <Input label="New email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <SaveBtn onPress={handleChangeEmail} label="Send confirmation" />
        </Modal>
      )}

      {modal === 'changePassword' && (
        <Modal title="Change password" onClose={closeModal}>
          <Input label="New password" value={newPassword} onChange={setNewPassword} type="password" placeholder="Minimum 8 characters" />
          <Input label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="••••••••" />
          <SaveBtn onPress={handleChangePassword} label="Update password" />
        </Modal>
      )}

      {modal === 'deleteAccount' && (
        <Modal title="Delete account" onClose={closeModal}>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm leading-relaxed">
              This will <strong>permanently delete</strong> your account, all check-ins, goals, focus sessions, conversations, and vision board items. This cannot be undone.
            </p>
          </div>
          <Input
            label='Type DELETE to confirm'
            value={deleteConfirmText}
            onChange={setDeleteConfirmText}
            placeholder="DELETE"
          />
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirmText !== 'DELETE' || saving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-40 mt-2"
          >
            {saving ? 'Deleting…' : 'Permanently delete my account'}
          </button>
        </Modal>
      )}

      {modal === 'upgrade' && (
        <Modal title="Upgrade to Pro" onClose={closeModal}>
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Crown size={28} className="text-gold" />
            </div>
            <p className="text-navy/60 text-sm">Unlock the full Streams Life experience</p>
          </div>

          <div className="space-y-2 mb-6">
            {PRO_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-4 h-4 bg-gold/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check size={10} className="text-gold" />
                </div>
                <span className="text-navy/80 text-sm">{f}</span>
              </div>
            ))}
          </div>

          {/* Pricing options */}
          <div className="space-y-3 mb-5">
            <div className="border-2 border-gold rounded-2xl p-4 relative">
              <div className="absolute -top-2.5 right-4 bg-gold text-navy text-[10px] font-bold px-2 py-0.5 rounded-full">
                BEST VALUE
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-navy font-bold">Annual</p>
                  <p className="text-navy/50 text-xs">£4.99/month, billed annually</p>
                </div>
                <div className="text-right">
                  <p className="text-navy font-bold text-lg">£59.99</p>
                  <p className="text-emerald-600 text-xs font-semibold">Save 37%</p>
                </div>
              </div>
            </div>
            <div className="border border-navy/15 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-navy font-bold">Monthly</p>
                  <p className="text-navy/50 text-xs">Billed every month</p>
                </div>
                <p className="text-navy font-bold text-lg">£7.99</p>
              </div>
            </div>
          </div>

          {/* Stripe integration placeholder */}
          {/* TODO: Stripe integration to be added */}
          <button
            onClick={() => { showToast('Payment coming soon — stay tuned!'); closeModal() }}
            className="w-full bg-gold text-navy font-bold py-4 rounded-xl active:scale-95 transition-all shadow-gold flex items-center justify-center gap-2"
          >
            <Crown size={16} />
            Start 7-day free trial
          </button>
          <p className="text-navy/50 text-xs text-center mt-3">
            Cancel anytime. No charge until trial ends.
          </p>
        </Modal>
      )}

      {modal === 'editBigWhy' && (
        <Modal title="Your Big Why" onClose={closeModal}>
          <p className="text-navy/50 text-sm mb-4">What does living a full life mean to you?</p>
          <textarea
            value={bigWhy}
            onChange={e => setBigWhy(e.target.value)}
            rows={5}
            placeholder="For me, a full life means…"
            className="w-full border border-navy/15 text-navy rounded-xl px-4 py-3 focus:outline-none focus:border-gold text-sm resize-none mb-2"
          />
          <SaveBtn onPress={() => saveProfile({ big_why: bigWhy })} />
        </Modal>
      )}

      {modal === 'livContext' && livContext && (
        <Modal title="What Liv knows" onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <p className="text-navy/40 text-xs font-semibold uppercase tracking-wide mb-2">Your Big Why</p>
              <p className="text-navy/70 text-sm leading-relaxed bg-navy/4 rounded-xl px-3 py-2.5">
                {profile.big_why || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-navy/40 text-xs font-semibold uppercase tracking-wide mb-2">Life areas</p>
              <div className="flex flex-wrap gap-1.5">
                {lifeAreas.map(a => (
                  <span key={a.id} className="bg-navy/6 text-navy/70 text-xs px-2.5 py-1 rounded-full">{a.name}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-navy/40 text-xs font-semibold uppercase tracking-wide mb-2">
                Recent check-ins (last 7 days)
              </p>
              {livContext.checkins.length === 0
                ? <p className="text-navy/40 text-sm">No check-ins this week.</p>
                : livContext.checkins.map(c => {
                    const avg = Object.values(c.scores).reduce((a, b) => a + b, 0) / Object.values(c.scores).length
                    return (
                      <div key={c.id} className="flex items-center justify-between py-1.5">
                        <span className="text-navy/70 text-sm">{c.date}</span>
                        <span className="text-navy font-semibold text-sm">{avg.toFixed(1)}/5</span>
                      </div>
                    )
                  })
              }
            </div>
            <div>
              <p className="text-navy/40 text-xs font-semibold uppercase tracking-wide mb-2">
                Active goals ({livContext.goals.length})
              </p>
              {livContext.goals.length === 0
                ? <p className="text-navy/40 text-sm">No active goals.</p>
                : livContext.goals.map(g => (
                    <div key={g.id} className="py-1.5">
                      <p className="text-navy/80 text-sm">{g.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-navy/8 rounded-full">
                          <div className="h-full bg-gold rounded-full" style={{ width: `${g.progress}%` }} />
                        </div>
                        <span className="text-navy/40 text-xs">{g.progress}%</span>
                      </div>
                    </div>
                  ))
              }
            </div>
            <div>
              <p className="text-navy/40 text-xs font-semibold uppercase tracking-wide mb-2">
                Focus sessions this week ({livContext.sessions.length})
              </p>
              <p className="text-navy/70 text-sm">
                {livContext.sessions.reduce((sum, s) => sum + s.duration_minutes, 0)} minutes total
              </p>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'resetConversations' && (
        <Modal title="Reset conversation history" onClose={closeModal}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 text-sm leading-relaxed">
              This will delete all of your Liv conversations. Liv will start fresh with no memory of previous chats.
            </p>
          </div>
          <button
            onClick={resetConversations}
            disabled={saving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? 'Clearing…' : 'Clear all conversations'}
          </button>
        </Modal>
      )}

      {modal === 'editArea' && editingArea && (
        <Modal title="Edit life area" onClose={closeModal}>
          <Input label="Area name" value={areaEditName} onChange={setAreaEditName} placeholder="e.g. Health & Fitness" />
          <SaveBtn onPress={saveAreaName} />
        </Modal>
      )}

      {modal === 'deleteArea' && editingArea && (
        <Modal title="Remove life area" onClose={closeModal}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 text-sm leading-relaxed">
              Removing <strong>{editingArea.name}</strong> won&apos;t delete existing check-ins or goals, but they will no longer be linked to this area.
            </p>
          </div>
          <button
            onClick={deleteArea}
            disabled={saving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? 'Removing…' : `Remove ${editingArea.name}`}
          </button>
        </Modal>
      )}

      {modal === 'clearCheckins' && (
        <Modal title="Clear check-in history" onClose={closeModal}>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm leading-relaxed">
              This will permanently delete all your check-in history. Your goals and focus sessions will not be affected.
            </p>
          </div>
          <button
            onClick={clearCheckins}
            disabled={saving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? 'Clearing…' : 'Clear check-in history'}
          </button>
        </Modal>
      )}

      {modal === 'deleteAllData' && (
        <Modal title="Delete all data" onClose={closeModal}>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm leading-relaxed">
              This will permanently delete <strong>all your data</strong> including check-ins, goals, focus sessions, conversations, and vision board items. Your account will remain.
            </p>
          </div>
          <Input
            label="Type DELETE to confirm"
            value={deleteConfirmText}
            onChange={setDeleteConfirmText}
            placeholder="DELETE"
          />
          <button
            onClick={deleteAllData}
            disabled={deleteConfirmText !== 'DELETE' || saving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-40 mt-2"
          >
            {saving ? 'Deleting…' : 'Delete all my data'}
          </button>
        </Modal>
      )}

      {modal === 'feedback' && (
        <Modal title="Send feedback" onClose={closeModal}>
          <p className="text-navy/50 text-sm mb-4">
            We read every message. What&apos;s on your mind?
          </p>
          <textarea
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            rows={5}
            placeholder="Your feedback, idea, or bug report…"
            className="w-full border border-navy/15 text-navy rounded-xl px-4 py-3 focus:outline-none focus:border-gold text-sm resize-none mb-2"
          />
          <SaveBtn onPress={sendFeedback} label="Send feedback" disabled={!feedbackText.trim()} />
        </Modal>
      )}
    </>
  )
}
