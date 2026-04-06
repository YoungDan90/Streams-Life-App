'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Plus, Clock } from 'lucide-react'
import type { ChatMessage, CoachConversation } from '@/lib/types'
import { formatShortDate } from '@/lib/utils'

const STARTERS = [
  "I'm feeling overwhelmed",
  "Help me plan my week",
  "I keep avoiding one thing",
  "Review my progress with me",
  "I need some motivation",
]

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [pastConversations, setPastConversations] = useState<CoachConversation[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadOrCreateConversation()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadOrCreateConversation() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    // Look for today's conversation
    const { data: existing } = await supabase
      .from('coach_conversations')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      setConversationId(existing.id)
      setMessages((existing.messages as ChatMessage[]) || [])
    }

    // Load past 30 days history
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: history } = await supabase
      .from('coach_conversations')
      .select('id, created_at, messages')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(30)

    setPastConversations((history || []) as CoachConversation[])
    setInitializing(false)
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      const data = await res.json()
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply || 'Sorry, I had trouble responding. Please try again.',
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [...updatedMessages, assistantMsg]
      setMessages(finalMessages)

      // Save to Supabase
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        if (conversationId) {
          await supabase
            .from('coach_conversations')
            .update({ messages: finalMessages })
            .eq('id', conversationId)
        } else {
          const { data: newConvo } = await supabase
            .from('coach_conversations')
            .insert({ user_id: user.id, messages: finalMessages })
            .select()
            .single()
          if (newConvo) setConversationId(newConvo.id)
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date().toISOString(),
        },
      ])
    }

    setLoading(false)
  }

  async function startNewConversation() {
    setMessages([])
    setConversationId(null)
    setShowHistory(false)
  }

  function loadConversation(convo: CoachConversation) {
    setMessages(convo.messages)
    setConversationId(convo.id)
    setShowHistory(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="bg-cream border-b border-navy/8 px-5 pt-12 pb-3 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Sage Avatar */}
            <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center shadow-sm">
              <span className="text-gold font-heading font-bold text-lg">S</span>
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold text-navy">Sage</h1>
              <p className="text-navy/40 text-xs">Your AI life coach</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-navy/5 hover:bg-navy/10 transition-colors"
            >
              <Clock size={17} className="text-navy/60" />
            </button>
            <button
              onClick={startNewConversation}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-navy/5 hover:bg-navy/10 transition-colors"
            >
              <Plus size={18} className="text-navy/60" />
            </button>
          </div>
        </div>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="bg-white border-b border-navy/8 px-5 py-4 animate-slide-up max-h-64 overflow-y-auto hide-scrollbar">
          <p className="text-navy/40 text-xs font-medium uppercase tracking-wide mb-3">
            Past 30 days
          </p>
          {pastConversations.length === 0 ? (
            <p className="text-navy/40 text-sm">No past conversations.</p>
          ) : (
            <div className="space-y-2">
              {pastConversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c)}
                  className="w-full text-left p-3 rounded-xl bg-navy/5 hover:bg-navy/10 transition-colors"
                >
                  <p className="text-navy/50 text-xs mb-1">
                    {formatShortDate(c.created_at)}
                  </p>
                  <p className="text-navy text-sm truncate">
                    {(c.messages[0]?.content || 'Conversation').substring(0, 60)}…
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 hide-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
            <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mb-4 shadow-card">
              <span className="text-gold font-heading font-bold text-2xl">S</span>
            </div>
            <h2 className="font-heading text-xl font-bold text-navy mb-2">
              Hello, I&apos;m Sage.
            </h2>
            <p className="text-navy/50 text-sm mb-8 max-w-xs">
              Your personal life coach. I know your goals, your check-ins, and your why. What&apos;s on your mind?
            </p>
            <div className="space-y-2 w-full max-w-sm">
              {STARTERS.map(starter => (
                <button
                  key={starter}
                  onClick={() => sendMessage(starter)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-navy/5 text-navy text-sm hover:bg-navy/10 transition-colors border border-navy/8 active:scale-95"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-gold font-heading font-bold text-sm">S</span>
                </div>
              )}
              <div
                className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-navy text-white rounded-tr-sm'
                    : 'bg-white text-navy shadow-card rounded-tl-sm border border-navy/6'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-gold font-heading font-bold text-sm">S</span>
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-card border border-navy/6">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-navy/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-navy/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-navy/30 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-navy/8 bg-cream px-4 py-3 pb-safe">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Sage…"
            rows={1}
            className="flex-1 border border-navy/15 text-navy rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors placeholder:text-navy/30 resize-none text-sm leading-relaxed max-h-32"
            style={{ overflowY: input.includes('\n') ? 'auto' : 'hidden' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-navy rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-all disabled:opacity-40"
          >
            <Send size={18} className="text-gold" />
          </button>
        </div>
      </div>
    </div>
  )
}
