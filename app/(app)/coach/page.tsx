'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, PenSquare, ChevronRight, X, MessageCircle } from 'lucide-react'
import type { ChatMessage, CoachConversation } from '@/lib/types'

const STARTERS = [
  "I'm feeling overwhelmed",
  "Help me plan my week",
  "I keep avoiding one thing",
  "Review my progress with me",
  "I need some motivation",
]

function formatConvoDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function firstUserMessage(convo: CoachConversation): string {
  const first = convo.messages.find(m => m.role === 'user')
  if (!first) return 'Conversation'
  return first.content.length > 55 ? first.content.slice(0, 55) + '…' : first.content
}

export default function CoachPage() {
  const [messages, setMessages]               = useState<ChatMessage[]>([])
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [initializing, setInitializing]       = useState(true)
  const [conversationId, setConversationId]   = useState<string | null>(null)
  const [history, setHistory]                 = useState<CoachConversation[]>([])
  const [showHistory, setShowHistory]         = useState(false)

  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLTextAreaElement>(null)
  const conversationRef = useRef<string | null>(null) // always in sync, avoids stale closures

  // Keep ref in sync with state
  useEffect(() => { conversationRef.current = conversationId }, [conversationId])

  // ── Scroll to bottom ────────────────────────────────────────
  const scrollToBottom = useCallback((behaviour: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: behaviour })
    }, 50)
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // ── Load most recent conversation on mount ───────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: convos } = await supabase
        .from('coach_conversations')
        .select('id, created_at, messages')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(30)

      const list = (convos || []) as CoachConversation[]
      setHistory(list)

      // Load the most recent conversation (regardless of date)
      if (list.length > 0) {
        const latest = list[0]
        setConversationId(latest.id)
        setMessages((latest.messages as ChatMessage[]) || [])
        scrollToBottom('instant')
      }

      setInitializing(false)
    }
    init()
  }, [scrollToBottom])

  // ── Refresh history list after a save ───────────────────────
  async function refreshHistory() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data } = await supabase
      .from('coach_conversations')
      .select('id, created_at, messages')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory((data || []) as CoachConversation[])
  }

  // ── Send message ─────────────────────────────────────────────
  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    const withUser = [...messages, userMsg]
    setMessages(withUser)
    setInput('')
    setLoading(true)

    // Resize textarea back to one row
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    let finalMessages = withUser

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass the full history so Liv has complete context
        body: JSON.stringify({ messages: withUser }),
      })

      const data = await res.json()
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply || "Sorry, I had trouble responding. Please try again.",
        timestamp: new Date().toISOString(),
      }

      finalMessages = [...withUser, assistantMsg]
      setMessages(finalMessages)
    } catch {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      }
      finalMessages = [...withUser, errMsg]
      setMessages(finalMessages)
    }

    // Persist to Supabase
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const currentId = conversationRef.current
        if (currentId) {
          // Append to existing conversation
          await supabase
            .from('coach_conversations')
            .update({ messages: finalMessages })
            .eq('id', currentId)
        } else {
          // Create new conversation
          const { data: newConvo } = await supabase
            .from('coach_conversations')
            .insert({ user_id: user.id, messages: finalMessages })
            .select('id')
            .single()
          if (newConvo) {
            setConversationId(newConvo.id)
            conversationRef.current = newConvo.id
          }
        }
        await refreshHistory()
      }
    } catch {
      // Persist failure is silent — messages are still shown
    }

    setLoading(false)

    // Refocus input immediately so the user can keep typing
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Start a new conversation ─────────────────────────────────
  function startNewConversation() {
    setMessages([])
    setConversationId(null)
    conversationRef.current = null
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 150)
  }

  // ── Load a past conversation ─────────────────────────────────
  function loadConversation(convo: CoachConversation) {
    setMessages(convo.messages)
    setConversationId(convo.id)
    conversationRef.current = convo.id
    setShowHistory(false)
    scrollToBottom('instant')
  }

  // ── Auto-grow textarea ───────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Loading state ────────────────────────────────────────────
  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-cream">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* History slide-over panel */}
      {showHistory && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-72 bg-cream shadow-2xl flex flex-col animate-slide-in">
            <div className="px-5 pt-12 pb-4 border-b border-navy/8 flex items-center justify-between flex-shrink-0">
              <h2 className="font-heading text-base font-bold text-navy">Conversations</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-navy/5"
              >
                <X size={16} className="text-navy/50" />
              </button>
            </div>

            {/* New conversation button */}
            <div className="px-4 py-3 border-b border-navy/6">
              <button
                onClick={startNewConversation}
                className="w-full flex items-center gap-3 bg-navy text-gold px-4 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-all"
              >
                <PenSquare size={15} />
                New conversation
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-3 space-y-2">
              {history.length === 0 ? (
                <p className="text-navy/40 text-sm text-center pt-8">No conversations yet.</p>
              ) : (
                history.map(convo => {
                  const isActive = convo.id === conversationId
                  return (
                    <button
                      key={convo.id}
                      onClick={() => loadConversation(convo)}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-navy text-white'
                          : 'bg-navy/5 hover:bg-navy/10 text-navy'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-1 ${isActive ? 'text-gold' : 'text-navy/40'}`}>
                        {formatConvoDate(convo.created_at)}
                        {' · '}
                        {convo.messages.length} messages
                      </p>
                      <p className={`text-sm leading-snug ${isActive ? 'text-white/90' : 'text-navy/70'}`}>
                        {firstUserMessage(convo)}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Main chat layout — fixed height, never scrolls as a page */}
      <div className="flex flex-col h-dvh bg-cream">

        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-cream border-b border-navy/8 px-5 pt-12 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                <span className="text-gold font-heading font-bold text-lg">L</span>
              </div>
              <div>
                <h1 className="font-heading text-lg font-bold text-navy leading-tight">Liv</h1>
                <p className="text-navy/40 text-xs">
                  {loading ? 'Typing…' : 'Your AI life coach'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* History button */}
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy/5 hover:bg-navy/10 transition-colors"
              >
                <MessageCircle size={15} className="text-navy/50" />
                <span className="text-navy/60 text-xs font-medium">History</span>
              </button>
              {/* New conversation */}
              <button
                onClick={startNewConversation}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy text-gold hover:bg-navy-50 transition-colors"
              >
                <PenSquare size={14} />
                <span className="text-xs font-semibold">New</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Message list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 hide-scrollbar">

          {/* Empty state — show starters but keep input always visible */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-6 pb-4 text-center animate-fade-in">
              <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mb-4 shadow-card">
                <span className="text-gold font-heading font-bold text-2xl">L</span>
              </div>
              <h2 className="font-heading text-xl font-bold text-navy mb-1">
                Hello, I&apos;m Liv.
              </h2>
              <p className="text-navy/50 text-sm mb-6 max-w-xs leading-relaxed">
                Your personal life coach. I know your goals, check-ins, and your why.
                What&apos;s on your mind?
              </p>
              <div className="space-y-2 w-full max-w-xs">
                {STARTERS.map(starter => (
                  <button
                    key={starter}
                    onClick={() => sendMessage(starter)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-navy/5 text-navy text-sm hover:bg-navy/10 transition-colors border border-navy/8 active:scale-95 flex items-center justify-between group"
                  >
                    <span>{starter}</span>
                    <ChevronRight size={14} className="text-navy/25 group-hover:text-navy/50 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-navy rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-gold font-heading font-bold text-xs">L</span>
                </div>
              )}
              <div
                className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-navy text-white rounded-2xl rounded-tr-sm'
                    : 'bg-white text-navy shadow-card rounded-2xl rounded-tl-sm border border-navy/6'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2.5 animate-fade-in">
              <div className="w-7 h-7 bg-navy rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-gold font-heading font-bold text-xs">L</span>
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-card border border-navy/6">
                <div className="flex gap-1.5 items-center h-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-navy/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-navy/40 animate-bounce" style={{ animationDelay: '160ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-navy/40 animate-bounce" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar — always visible, always at bottom ── */}
        <div className="flex-shrink-0 border-t border-navy/8 bg-cream px-4 py-3 pb-safe">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message Liv…"
              rows={1}
              disabled={loading}
              className="flex-1 border border-navy/15 text-navy rounded-2xl px-4 py-3 focus:outline-none focus:border-gold transition-colors placeholder:text-navy/30 resize-none text-sm leading-relaxed disabled:opacity-60 bg-white"
              style={{ height: 'auto', minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-11 h-11 bg-navy rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-all disabled:opacity-35 mb-0"
            >
              <Send size={17} className="text-gold" />
            </button>
          </div>
          {messages.length > 0 && (
            <p className="text-navy/25 text-[10px] text-center mt-2">
              Press Enter to send · Shift+Enter for new line
            </p>
          )}
        </div>

      </div>
    </>
  )
}
