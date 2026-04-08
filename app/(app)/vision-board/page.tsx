'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Image as ImageIcon, Quote, Target, ArrowLeft, Trash2 } from 'lucide-react'

type ItemType = 'image' | 'quote' | 'goal'

interface VisionItem {
  id: string
  user_id: string
  type: ItemType
  content: string | null
  image_url: string | null
  created_at: string
}

type AddStep = 'choose' | 'quote' | 'goal' | 'image'

const TYPE_CONFIG: Record<ItemType, { label: string; icon: React.ReactNode; color: string }> = {
  image:  { label: 'Image',         icon: <ImageIcon size={22} />, color: 'bg-blue-500/20 text-blue-300 border-blue-400/20' },
  quote:  { label: 'Quote',         icon: <Quote size={22} />,     color: 'bg-gold/20 text-gold border-gold/20' },
  goal:   { label: 'Goal Statement',icon: <Target size={22} />,    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20' },
}

export default function VisionBoardPage() {
  const [items, setItems] = useState<VisionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addStep, setAddStep] = useState<AddStep | null>(null)
  const [fullscreen, setFullscreen] = useState<VisionItem | null>(null)
  const [quoteText, setQuoteText] = useState('')
  const [goalText, setGoalText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('vision_board_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setItems((data || []) as VisionItem[])
    setLoading(false)
  }

  function closeAdd() {
    setAddStep(null)
    setQuoteText('')
    setGoalText('')
  }

  async function saveTextItem(type: 'quote' | 'goal', content: string) {
    if (!content.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('vision_board_items').insert({
      user_id: user.id,
      type,
      content: content.trim(),
      image_url: null,
    })
    await loadItems()
    setSaving(false)
    closeAdd()
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
    const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Only image files are supported (JPEG, PNG, WebP, GIF).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      alert('Image must be under 5MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    // Use only the MIME-derived extension, not user-supplied filename
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/gif': 'gif', 'image/heic': 'heic',
    }
    const ext = extMap[file.type] || 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('vision-board')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('vision-board')
      .getPublicUrl(path)

    await supabase.from('vision_board_items').insert({
      user_id: user.id,
      type: 'image',
      content: null,
      image_url: urlData.publicUrl,
    })

    await loadItems()
    setUploading(false)
    closeAdd()
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    const item = items.find(i => i.id === id)

    // Delete from storage if image
    if (item?.image_url) {
      const path = item.image_url.split('/vision-board/').pop()
      if (path) {
        await supabase.storage.from('vision-board').remove([path])
      }
    }

    await supabase.from('vision_board_items').delete().eq('id', id)
    setDeleteConfirm(null)
    setFullscreen(null)
    await loadItems()
  }

  // Split items into two columns for masonry layout
  const col1: VisionItem[] = []
  const col2: VisionItem[] = []
  items.forEach((item, i) => {
    if (i % 2 === 0) col1.push(item)
    else col2.push(item)
  })

  function MasonryCard({ item }: { item: VisionItem }) {
    const label = item.type === 'image'
      ? 'Vision board image — tap to view full screen'
      : item.type === 'quote'
      ? `Quote: ${item.content ?? ''}`
      : `Goal: ${item.content ?? ''}`

    return (
      <button
        onClick={() => setFullscreen(item)}
        aria-label={label}
        className="w-full text-left mb-3 rounded-2xl overflow-hidden active:scale-95 transition-all duration-200 shadow-lg"
      >
        {item.type === 'image' && item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt="Vision board image"
            className="w-full object-cover rounded-2xl"
            loading="lazy"
            width={300}
            height={200}
          />
        ) : item.type === 'quote' ? (
          <div className="bg-navy-50 border border-gold/15 rounded-2xl p-4 min-h-[100px] flex flex-col justify-between">
            <span className="text-gold/40 font-heading text-4xl leading-none">&ldquo;</span>
            <p className="font-heading text-white text-sm leading-relaxed italic mt-1">
              {item.content}
            </p>
            <span className="text-gold/40 font-heading text-4xl leading-none self-end">&rdquo;</span>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 rounded-2xl p-4 min-h-[90px] flex flex-col justify-between">
            <Target size={14} className="text-gold/60 mb-2" />
            <p className="text-white/90 text-sm font-semibold leading-relaxed">
              {item.content}
            </p>
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="min-h-dvh bg-navy">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Vision Board</h1>
          <p className="text-white/65 text-xs mt-0.5">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <button
          onClick={() => setAddStep('choose')}
          aria-label="Add item to vision board"
          className="w-11 h-11 bg-gold rounded-full flex items-center justify-center shadow-gold active:scale-95 transition-all"
        >
          <Plus size={22} className="text-navy" aria-hidden="true" />
        </button>
      </div>

      {/* Masonry grid */}
      {loading ? (
        <div className="flex items-center justify-center pt-32">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-24 px-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 border border-white/10">
            <ImageIcon size={32} className="text-white/20" />
          </div>
          <h2 className="font-heading text-xl font-bold text-white mb-2">
            Your vision starts here
          </h2>
          <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-xs">
            Add images, quotes, and goal statements that represent the life you&apos;re building.
          </p>
          <button
            onClick={() => setAddStep('choose')}
            className="bg-gold text-navy font-semibold px-6 py-3.5 rounded-xl active:scale-95 transition-all shadow-gold flex items-center gap-2"
          >
            <Plus size={18} />
            Add your first item
          </button>
        </div>
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
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* ADD MODAL */}
      {addStep && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy animate-fade-in">
          {/* Modal header */}
          <div className="flex items-center gap-3 px-5 pt-12 pb-5 border-b border-white/8">
            <button
              onClick={closeAdd}
              aria-label="Go back"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5"
            >
              <ArrowLeft size={18} className="text-white/60" aria-hidden="true" />
            </button>
            <h2 className="font-heading text-lg font-bold text-white">
              {addStep === 'choose' ? 'Add to Vision Board'
                : addStep === 'quote' ? 'Add a Quote'
                : addStep === 'goal' ? 'Add a Goal Statement'
                : 'Add an Image'}
            </h2>
          </div>

          <div className="flex-1 px-5 pt-6">
            {/* Choose type */}
            {addStep === 'choose' && (
              <div className="space-y-3 animate-slide-up">
                <p className="text-white/65 text-sm mb-5">
                  What do you want to add to your vision board?
                </p>
                {(Object.entries(TYPE_CONFIG) as [ItemType, typeof TYPE_CONFIG[ItemType]][]).map(([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => {
                      if (type === 'image') {
                        fileInputRef.current?.click()
                        setAddStep(null)
                      } else {
                        setAddStep(type)
                      }
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-95 ${cfg.color}`}
                  >
                    <div className="flex-shrink-0">{cfg.icon}</div>
                    <div className="text-left">
                      <p className="font-semibold text-white">{cfg.label}</p>
                      <p className="text-white/65 text-xs mt-0.5">
                        {type === 'image'  && 'Choose from your camera roll'}
                        {type === 'quote'  && 'A line that moves or inspires you'}
                        {type === 'goal'   && 'A bold statement of what you will achieve'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Quote input */}
            {addStep === 'quote' && (
              <div className="flex flex-col h-full animate-slide-up">
                <p className="text-white/65 text-sm mb-5">
                  Type a quote, lyric, or line that inspires you.
                </p>
                <div className="relative flex-1 mb-6">
                  <span className="absolute top-3 left-4 text-gold/30 font-heading text-4xl leading-none pointer-events-none">&ldquo;</span>
                  <textarea
                    autoFocus
                    value={quoteText}
                    onChange={e => setQuoteText(e.target.value)}
                    placeholder="Your inspiring quote…"
                    className="w-full h-48 bg-white/5 border border-gold/20 text-white rounded-2xl px-5 pt-10 pb-5 focus:outline-none focus:border-gold transition-colors placeholder:text-white/20 resize-none font-heading text-lg leading-relaxed italic"
                  />
                  <span className="absolute bottom-3 right-4 text-gold/30 font-heading text-4xl leading-none pointer-events-none">&rdquo;</span>
                </div>
                <button
                  onClick={() => saveTextItem('quote', quoteText)}
                  disabled={!quoteText.trim() || saving}
                  className="w-full bg-gold text-navy font-semibold py-4 rounded-xl active:scale-95 transition-all disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Add to Board'}
                </button>
              </div>
            )}

            {/* Goal statement input */}
            {addStep === 'goal' && (
              <div className="flex flex-col h-full animate-slide-up">
                <p className="text-white/65 text-sm mb-5">
                  Write it as if it&apos;s already true — bold, present tense, personal.
                </p>
                <div className="mb-2">
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 mb-3">
                    <p className="text-white/30 text-xs font-medium uppercase tracking-wide mb-1">Examples</p>
                    <p className="text-white/50 text-xs leading-relaxed">
                      &ldquo;I am financially free and debt-free by December.&rdquo;<br />
                      &ldquo;I run a business I love that funds the life I want.&rdquo;<br />
                      &ldquo;I am present, fit, and deeply connected to my family.&rdquo;
                    </p>
                  </div>
                </div>
                <textarea
                  autoFocus
                  value={goalText}
                  onChange={e => setGoalText(e.target.value)}
                  placeholder="I am…"
                  rows={4}
                  className="w-full bg-white/5 border border-gold/20 text-white rounded-2xl px-4 py-4 focus:outline-none focus:border-gold transition-colors placeholder:text-white/20 resize-none text-base font-semibold leading-relaxed mb-6"
                />
                <button
                  onClick={() => saveTextItem('goal', goalText)}
                  disabled={!goalText.trim() || saving}
                  className="w-full bg-gold text-navy font-semibold py-4 rounded-xl active:scale-95 transition-all disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Add to Board'}
                </button>
              </div>
            )}

            {/* Uploading state */}
            {uploading && (
              <div className="flex flex-col items-center justify-center pt-24">
                <div className="w-12 h-12 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white/50 text-sm">Uploading image…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULLSCREEN ITEM VIEWER */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
          {/* Controls */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 pt-12 pb-4 bg-gradient-to-b from-black/80 to-transparent">
            <button
              onClick={() => { setFullscreen(null); setDeleteConfirm(null) }}
              aria-label="Close fullscreen view"
              className="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center"
            >
              <X size={18} className="text-white" aria-hidden="true" />
            </button>
            <button
              onClick={() => setDeleteConfirm(fullscreen.id)}
              aria-label="Delete this item"
              className="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center"
            >
              <Trash2 size={16} className="text-red-400" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-6">
            {fullscreen.type === 'image' && fullscreen.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fullscreen.image_url}
                alt="Vision board image — full view"
                className="max-w-full max-h-full object-contain rounded-2xl"
              />
            ) : fullscreen.type === 'quote' ? (
              <div className="max-w-sm text-center px-4">
                <span className="text-gold/40 font-heading text-7xl leading-none block mb-2">&ldquo;</span>
                <p className="font-heading text-white text-2xl leading-relaxed italic">
                  {fullscreen.content}
                </p>
                <span className="text-gold/40 font-heading text-7xl leading-none block mt-2">&rdquo;</span>
              </div>
            ) : (
              <div className="max-w-sm text-center px-4">
                <Target size={36} className="text-gold mx-auto mb-6" />
                <p className="text-white text-2xl font-bold leading-relaxed">
                  {fullscreen.content}
                </p>
              </div>
            )}
          </div>

          {/* Type badge */}
          <div className="absolute bottom-10 inset-x-0 flex justify-center">
            <span className={`text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full border ${TYPE_CONFIG[fullscreen.type].color}`}>
              {TYPE_CONFIG[fullscreen.type].label}
            </span>
          </div>

          {/* Delete confirmation */}
          {deleteConfirm === fullscreen.id && (
            <div className="absolute inset-x-5 bottom-24 bg-navy border border-white/10 rounded-2xl p-5 shadow-xl animate-slide-up">
              <p className="text-white font-semibold mb-1">Remove this item?</p>
              <p className="text-white/65 text-sm mb-4">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl border border-white/15 text-white/60 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteItem(fullscreen.id)}
                  className="flex-1 py-3 rounded-xl bg-red-500/90 text-white text-sm font-semibold active:scale-95 transition-all"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
