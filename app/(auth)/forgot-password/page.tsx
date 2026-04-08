'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    // Always show the sent screen regardless of whether the email exists —
    // this prevents timing/response-based email enumeration attacks.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="animate-fade-in text-center">
        <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-white text-xl font-semibold mb-2">Check your email</h2>
        <p className="text-white/60 text-sm mb-6">
          If <strong className="text-gold">{email}</strong> is registered, you&apos;ll receive a reset link shortly. Check your inbox and spam folder.
        </p>
        <Link href="/login" className="text-gold text-sm font-medium hover:text-gold-light">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <h2 className="text-white text-xl font-semibold text-center mb-2">Reset your password</h2>
      <p className="text-white/50 text-sm text-center mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="block text-gold/80 text-sm font-medium mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-navy-50 border border-gold/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors placeholder:text-white/30"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold text-navy font-semibold py-3.5 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link href="/login" className="text-gold/60 text-sm hover:text-gold">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}
