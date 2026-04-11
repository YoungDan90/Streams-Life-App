'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Image as ImageIcon, Quote, Target, Trash2, AlertCircle, Loader2 } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
type ItemType = 'image' | 'quote' | 'goal'

interface VisionItem {
  id: string
  user_id: string
  type: ItemType
  content: string | null
  image_url: string | null   // stores the storage PATH (e.g. "userId/1234.jpg"), not a URL
  created_at: string
  displayUrl?: string        // client-side signed URL for display (not persisted)
}

type AddStep = 'choose' | 'quote' | 'goal'

const BUCKET = 'vision-board-images'
const SIGNED_URL_TTL = 31536000 // 1 year in seconds

// ── Page ───────────────────────────────────────────────────────
export default function VisionBoardPage() {
  const [items, setItems]             = useState<VisionItem[]>([])
  const [loaded, setLoaded]           = useState(false)
  const [addStep, setAddStep]         = useState<AddStep | null>(null)
  const [fullscreen, setFullscreen]   = useState<VisionItem | null>(null)
  const [quoteText, setQuoteText]     = useState('')
  const [goalText, setGoalText]       = useState('')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [longPressId, setLongPressId] = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const pressTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed   = useRef(false)

  // ── Load items + generate signed URLs ─────────────────────────
  const loadItems = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoaded(true); return }

    const { data, error } = await supabase
      .from('vision_board_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error || !data) { setLoaded(true); return }

    // Batch-generate signed URLs for all image items
    const imagePaths = data
      .filter(i => i.type === 'image' && i.image_url)
      .map(i => i.image_url as string)

    const signedMap: Record<string, string> = {}
    if (imagePaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(imagePaths, SIGNED_URL_TTL)
      signed?.forEach(s => {
        if (s.signedUrl && s.path) signedMap[s.path] = s.signedUrl
      })
    }

    const enriched: VisionItem[] = data.map(item => ({
      ...item,
      displayUrl: item.type === 'image' && item.image_url
        ? (signedMap[item.image_url] ?? undefined)
        : undefined,
    }))

    setItems(enriched)
    setLoaded(true)
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  // ── Close add sheet ────────────────────────────────────────────
  function closeAdd() {
    setAddStep(null)
    setQuoteText('')
    setGoalText('')
    setSaving(false)
    setSaveError('')
    setUploadError('')
  }

  // ── Save quote or goal ─────────────────────────────────────────
  async function saveTextItem(type: 'quote' | 'goal', content: string) {
    const trimmed = content.trim()
    if (!trimmed) return
    setSaving(true)
    setSaveError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setSaveError('Not signed in.'); return }

    const { data: newRow, error } = await supabase
      .from('vision_board_items')
      .insert({ user_id: user.id, type, content: trimmed, image_url: null })
      .select()
      .single()

    if (error || !newRow) {
      setSaving(false)
      setSaveError('Could not save. Please try again.')
      return
    }

    // Optimistic: prepend immediately so the user sees it right away
    setItems(prev => [newRow as VisionItem, ...prev])
    closeAdd()
  }

  // ── Image upload ───────────────────────────────────────────────
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
    const MAX     = 5 * 1024 * 1024

    if (!ALLOWED.includes(file.type)) {
      setUploadError('Only images are supported (JPEG, PNG, WebP, GIF).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX) {
      setUploadError('Image must be under 5 MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    // Show a local blob preview immediately so the user sees something
    const previewUrl = URL.createObjectURL(file)
    const tempId: string = `temp-${Date.now()}`
    const tempItem: VisionItem = {
      id: tempId,
      user_id: user.id,
      type: 'image',
      content: null,
      image_url: null,
      created_at: new Date().toISOString(),
      displayUrl: previewUrl,
    }
    setItems(prev => [tempItem, ...prev])

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png',
      'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
    }
    const ext  = extMap[file.type] || 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false })

    if (storageErr) {
      setItems(prev => prev.filter(i => i.id !== tempId))
      URL.revokeObjectURL(previewUrl)
      setUploadError(`Upload failed: ${storageErr.message}`)
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Persist the storage PATH (not URL) in the DB
    const { data: newRow, error: dbErr } = await supabase
      .from('vision_board_items')
      .insert({ user_id: user.id, type: 'image', content: null, image_url: path })
      .select()
      .single()

    if (dbErr || !newRow) {
      // Rollback: remove temp item and the uploaded file
      setItems(prev => prev.filter(i => i.id !== tempId))
      URL.revokeObjectURL(previewUrl)
      await supabase.storage.from(BUCKET).remove([path])
      setUploadError('Could not save image record. Please try again.')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Replace temp placeholder with real DB row, keeping the blob preview URL
    setItems(prev => prev.map(i =>
      i.id === tempId
        ? { ...(newRow as VisionItem), displayUrl: previewUrl }
        : i
    ))

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Delete item ────────────────────────────────────────────────
  async function deleteItem(item: VisionItem) {
    setDeleting(true)
    const supabase = createClient()

    if (item.type === 'image' && item.image_url) {
      await supabase.storage.from(BUCKET).remove([item.image_url])
      if (item.displayUrl?.startsWith('blob:')) URL.revokeObjectURL(item.displayUrl)
    }

    await supabase.from('vision_board_items').delete().eq('id', item.id)

    setItems(prev => prev.filter(i => i.id !== item.id))
    setDeleteConfirm(null)
    setFullscreen(null)
    setLongPressId(null)
    setDeleting(false)
  }

  // ── Long-press handlers ────────────────────────────────────────
  function startPress(id: string) {
    longPressed.current = false
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      setLongPressId(id)
    }, 600)
  }
  function cancelPress() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }
  function handleCardTap(item: VisionItem) {
    if (longPressed.current) return   // was a hold — don't open fullscreen
    setFullscreen(item)
  }

  // ── Masonry split ──────────────────────────────────────────────
  const col1: VisionItem[] = []
  const col2: VisionItem[] = []
  items.forEach((item, i) => { (i % 2 === 0 ? col1 : col2).push(item) })

  // ── Masonry card ───────────────────────────────────────────────
  function MasonryCard({ item }: { item: VisionItem }) {
    const isTemp       = item.id.startsWith('temp-')
    const isLongHeld   = longPressId === item.id
    const cardAriaLabel =
      item.type === 'image'
        ? 'Vision board image — tap to view'
        : item.type === 'quote'
        ? `Quote: ${item.content}`
        : `Goal: ${item.content}`

    return (
      <div
        className="relative mb-3"
        onTouchStart={() => startPress(item.id)}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onMouseDown={() => startPress(item.id)}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
      >
        <button
          onClick={() => handleCardTap(item)}
          aria-label={cardAriaLabel}
          disabled={isTemp}
          className={`w-full text-left rounded-2xl overflow-hidden transition-all duration-200 shadow-lg block ${
            isTemp ? 'opacity-70 cursor-wait' : 'active:scale-95'
          }`}
        >
          {item.type === 'image' ? (
            <div className="relative">
              {item.displayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.displayUrl}
                  alt="Vision board image"
                  className="w-full object-cover rounded-2xl"
                  loading="lazy"
                />
              ) : (
                <div className="bg-navy/30 rounded-2xl h-28 flex items-center justify-center">
                  <ImageIcon size={24} className="text-white/30" aria-hidden="true" />
                </div>
              )}
              {isTemp && (
                <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                  <Loader2 size={20} className="text-white animate-spin" aria-hidden="true" />
                </div>
              )}
            </div>
          ) : item.type === 'quote' ? (
            // Quote card — dark navy, italic serif, gold quotes
            <div className="bg-[#0D1B2A] border border-[#C9A84C]/25 rounded-2xl p-5 min-h-[120px] flex flex-col justify-between">
              <span className="text-[#C9A84C]/60 font-heading text-4xl leading-none select-none" aria-hidden="true">
                &ldquo;
              </span>
              <p className="font-heading text-white text-sm leading-relaxed italic mt-1 mb-2">
                {item.content}
              </p>
              <span className="text-[#C9A84C]/60 font-heading text-4xl leading-none self-end select-none" aria-hidden="true">
                &rdquo;
              </span>
            </div>
          ) : (
            // Goal card — white, gold left border
            <div className="bg-white border-l-[3px] border-[#C9A84C] rounded-2xl px-4 py-4 min-h-[100px] flex flex-col justify-between shadow-sm">
              <Target size={14} className="text-[#C9A84C] mb-2 flex-shrink-0" aria-hidden="true" />
              <p className="text-[#0D1B2A] text-sm font-semibold leading-relaxed">
                {item.content}
              </p>
            </div>
          )}
        </button>

        {/* Long-press delete overlay */}
        {isLongHeld && (
          <div className="absolute inset-0 rounded-2xl bg-black/65 flex items-center justify-center animate-fade-in z-10">
            <button
              onClick={() => { setDeleteConfirm(item.id); setLongPressId(null) }}
              aria-label="Delete this item"
              className="bg-red-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 active:scale-95 transition-all shadow-xl"
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
            <button
              onClick={() => setLongPressId(null)}
              aria-label="Cancel"
              className="absolute top-2 right-2 w-7 h-7 bg-white/20 rounded-full flex items-center justify-center"
            >
              <X size={12} className="text-white" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-navy">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Vision Board</h1>
          {loaded && (
            <p className="text-white/65 text-xs mt-0.5">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          )}
        </div>
        <button
          onClick={() => { setAddStep('choose'); setUploadError('') }}
          aria-label="Add item to vision board"
          className="w-11 h-11 bg-gold rounded-full flex items-center justify-center shadow-gold active:scale-95 transition-all"
        >
          <Plus size={22} className="text-navy" aria-hidden="true" />
        </button>
      </div>

      {/* Upload error banner (shown on main screen) */}
      {uploadError && (
        <div className="mx-4 mb-4 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-2 animate-fade-in">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-red-300 text-sm">{uploadError}</p>
          </div>
          <button onClick={() => setUploadError('')} aria-label="Dismiss error">
            <X size={14} className="text-red-400" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── Loading skeleton ────────────────────────────────────── */}
      {!loaded ? (
        <div className="flex items-center justify-center pt-32">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" aria-label="Loading your vision board" />
        </div>

      /* ── Empty state — only shown when ZERO items saved ────── */
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-24 px-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 border border-white/10">
            <ImageIcon size={32} className="text-white/25" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-xl font-bold text-white mb-2">
            Your vision starts here
          </h2>
          <p className="text-white/65 text-sm leading-relaxed mb-8 max-w-xs">
            Add images, quotes, and goal statements that represent the life you&apos;re building.
          </p>
          <button
            onClick={() => setAddStep('choose')}
            className="bg-gold text-navy font-semibold px-6 py-3.5 rounded-xl active:scale-95 transition-all shadow-gold flex items-center gap-2"
          >
            <Plus size={18} aria-hidden="true" />
            Add your first item
          </button>
        </div>

      /* ── Masonry grid ─────────────────────────────────────── */
      ) : (
        <div className="px-3 pb-32 flex gap-3">
          <div className="flex-1 flex flex-col">
            {col1.map(item => <MasonryCard key={item.id} item={item} />)}
          </div>
          <div className="flex-1 flex flex-col pt-6">
            {col2.map(item => <MasonryCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
        aria-hidden="true"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* ── ADD SHEET ──────────────────────────────────────────── */}
      {addStep && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy animate-fade-in">
          {/* Modal header */}
          <div className="flex items-center gap-3 px-5 pt-12 pb-5 border-b border-white/8">
            <button
              onClick={closeAdd}
              aria-label="Go back"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5"
            >
              <X size={18} className="text-white/70" aria-hidden="true" />
            </button>
            <h2 className="font-heading text-lg font-bold text-white">
              {addStep === 'choose' ? 'Add to Vision Board'
                : addStep === 'quote' ? 'Add a Quote'
                : 'Add a Goal Statement'}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-10">

            {/* ── Choose type ─────────────────────────────────── */}
            {addStep === 'choose' && (
              <div className="space-y-3 animate-slide-up">
                <p className="text-white/65 text-sm mb-5">What do you want to add?</p>

                {/* Image */}
                <button
                  onClick={() => {
                    setUploadError('')
                    fileInputRef.current?.click()
                    setAddStep(null)
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300 transition-all active:scale-95"
                >
                  <ImageIcon size={22} aria-hidden="true" />
                  <div className="text-left">
                    <p className="font-semibold text-white">Image</p>
                    <p className="text-white/65 text-xs mt-0.5">Choose from your camera roll</p>
                  </div>
                </button>

                {/* Quote */}
                <button
                  onClick={() => setAddStep('quote')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gold/20 bg-gold/10 text-gold transition-all active:scale-95"
                >
                  <Quote size={22} aria-hidden="true" />
                  <div className="text-left">
                    <p className="font-semibold text-white">Quote</p>
                    <p className="text-white/65 text-xs mt-0.5">A line that moves or inspires you</p>
                  </div>
                </button>

                {/* Goal statement */}
                <button
                  onClick={() => setAddStep('goal')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 transition-all active:scale-95"
                >
                  <Target size={22} aria-hidden="true" />
                  <div className="text-left">
                    <p className="font-semibold text-white">Goal Statement</p>
                    <p className="text-white/65 text-xs mt-0.5">A bold statement of what you will achieve</p>
                  </div>
                </button>
              </div>
            )}

            {/* ── Quote input ──────────────────────────────────── */}
            {addStep === 'quote' && (
              <div className="flex flex-col animate-slide-up">
                <p className="text-white/65 text-sm mb-5">
                  Type a quote, lyric, or line that inspires you.
                </p>
                <div className="relative mb-6">
                  <span className="absolute top-3 left-4 text-gold/40 font-heading text-4xl leading-none pointer-events-none select-none" aria-hidden="true">
                    &ldquo;
                  </span>
                  <label htmlFor="quote-input" className="sr-only">Your quote</label>
                  <textarea
                    id="quote-input"
                    autoFocus
                    value={quoteText}
                    onChange={e => setQuoteText(e.target.value)}
                    placeholder="Your inspiring quote…"
                    rows={5}
                    className="w-full bg-white/5 border border-gold/20 text-white rounded-2xl px-5 pt-10 pb-5 focus:outline-none focus:border-gold transition-colors placeholder:text-white/25 resize-none font-heading text-lg leading-relaxed italic"
                  />
                  <span className="absolute bottom-3 right-4 text-gold/40 font-heading text-4xl leading-none pointer-events-none select-none" aria-hidden="true">
                    &rdquo;
                  </span>
                </div>

                {saveError && (
                  <p className="text-red-400 text-sm mb-3 flex items-center gap-2">
                    <AlertCircle size={14} aria-hidden="true" /> {saveError}
                  </p>
                )}

                <button
                  onClick={() => saveTextItem('quote', quoteText)}
                  disabled={!quoteText.trim() || saving}
                  className="w-full bg-gold text-navy font-semibold py-4 rounded-xl active:scale-95 transition-all disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Add to Board'}
                </button>
              </div>
            )}

            {/* ── Goal statement input ─────────────────────────── */}
            {addStep === 'goal' && (
              <div className="flex flex-col animate-slide-up">
                <p className="text-white/65 text-sm mb-4">
                  Write it as if it&apos;s already true — bold, present tense, personal.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-5">
                  <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-1">Examples</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    &ldquo;I am financially free and debt-free by December.&rdquo;<br />
                    &ldquo;I run a business I love that funds the life I want.&rdquo;
                  </p>
                </div>

                <label htmlFor="goal-input" className="sr-only">Your goal statement</label>
                <textarea
                  id="goal-input"
                  autoFocus
                  value={goalText}
                  onChange={e => setGoalText(e.target.value)}
                  placeholder="I am…"
                  rows={4}
                  className="w-full bg-white/5 border border-gold/20 text-white rounded-2xl px-4 py-4 focus:outline-none focus:border-gold transition-colors placeholder:text-white/25 resize-none text-base font-semibold leading-relaxed mb-6"
                />

                {saveError && (
                  <p className="text-red-400 text-sm mb-3 flex items-center gap-2">
                    <AlertCircle size={14} aria-hidden="true" /> {saveError}
                  </p>
                )}

                <button
                  onClick={() => saveTextItem('goal', goalText)}
                  disabled={!goalText.trim() || saving}
                  className="w-full bg-gold text-navy font-semibold py-4 rounded-xl active:scale-95 transition-all disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Add to Board'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Uploading overlay (shown over main screen) ─────────── */}
      {uploading && (
        <div className="fixed inset-0 z-40 bg-navy/80 flex flex-col items-center justify-center animate-fade-in">
          <div className="w-14 h-14 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4" aria-hidden="true" />
          <p className="text-white font-semibold">Uploading image…</p>
          <p className="text-white/50 text-sm mt-1">This won&apos;t take long</p>
        </div>
      )}

      {/* ── Fullscreen viewer ──────────────────────────────────── */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
          {/* Controls */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 pt-12 pb-4 bg-gradient-to-b from-black/80 to-transparent">
            <button
              onClick={() => { setFullscreen(null); setDeleteConfirm(null) }}
              aria-label="Close"
              className="w-10 h-10 bg-white/15 backdrop-blur rounded-full flex items-center justify-center"
            >
              <X size={18} className="text-white" aria-hidden="true" />
            </button>
            <button
              onClick={() => setDeleteConfirm(fullscreen.id)}
              aria-label="Delete this item"
              className="w-10 h-10 bg-white/15 backdrop-blur rounded-full flex items-center justify-center"
            >
              <Trash2 size={16} className="text-red-400" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-6">
            {fullscreen.type === 'image' && fullscreen.displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fullscreen.displayUrl}
                alt="Vision board image — full view"
                className="max-w-full max-h-full object-contain rounded-2xl"
              />
            ) : fullscreen.type === 'quote' ? (
              <div className="max-w-sm text-center px-4">
                <span className="text-gold/50 font-heading text-7xl leading-none block mb-2" aria-hidden="true">&ldquo;</span>
                <p className="font-heading text-white text-2xl leading-relaxed italic">
                  {fullscreen.content}
                </p>
                <span className="text-gold/50 font-heading text-7xl leading-none block mt-2" aria-hidden="true">&rdquo;</span>
              </div>
            ) : (
              <div className="max-w-sm text-center px-4">
                <Target size={36} className="text-gold mx-auto mb-6" aria-hidden="true" />
                <p className="text-white text-2xl font-bold leading-relaxed">
                  {fullscreen.content}
                </p>
              </div>
            )}
          </div>

          {/* Delete confirmation */}
          {deleteConfirm === fullscreen.id && (
            <div className="absolute inset-x-5 bottom-10 bg-[#0D1B2A] border border-white/10 rounded-2xl p-5 shadow-2xl animate-slide-up z-20">
              <p className="text-white font-semibold mb-1">Remove this item?</p>
              <p className="text-white/65 text-sm mb-4">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl border border-white/15 text-white/70 text-sm font-medium active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteItem(fullscreen)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  {deleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirm (from long press — outside fullscreen) ─ */}
      {deleteConfirm && !fullscreen && (() => {
        const item = items.find(i => i.id === deleteConfirm)
        if (!item) return null
        return (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setDeleteConfirm(null)}>
            <div
              className="w-full bg-[#0D1B2A] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl animate-slide-up"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-white font-semibold mb-1">Remove this item?</p>
              <p className="text-white/65 text-sm mb-5">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3.5 rounded-xl border border-white/15 text-white/70 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteItem(item)}
                  disabled={deleting}
                  className="flex-1 py-3.5 rounded-xl bg-red-500 text-white font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  {deleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
