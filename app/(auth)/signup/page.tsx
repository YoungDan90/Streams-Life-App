'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      // Never expose whether an email is already registered.
      // Log the error code server-side (not here — this is client code),
      // and always show the same message.
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Supabase may return a session immediately (email confirmation disabled)
    // or require email verification. Handle both cases.
    if (data.session) {
      // Confirmed immediately — create profile and go to onboarding
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          onboarding_complete: false,
        })
      }
      router.push('/onboarding')
    } else {
      // Email confirmation required — show a neutral "check your email" screen
      // regardless of whether the email already existed (prevents enumeration)
      setSent(true)
      setLoading(false)
    }
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
          If that address isn&apos;t already registered, we&apos;ve sent a confirmation link to{' '}
          <strong className="text-gold">{email}</strong>. Follow the link to activate your account.
        </p>
        <Link href="/login" className="text-gold text-sm font-medium hover:text-gold-light">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <h2 className="text-white text-xl font-semibold text-center mb-6">Create your account</h2>

      <form onSubmit={handleSignup} className="space-y-4">
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

        <div>
          <label className="block text-gold/80 text-sm font-medium mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-navy-50 border border-gold/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors placeholder:text-white/30"
            placeholder="Minimum 8 characters"
          />
        </div>

        <div>
          <label className="block text-gold/80 text-sm font-medium mb-1.5">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            className="w-full bg-navy-50 border border-gold/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-gold transition-colors placeholder:text-white/30"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold text-navy font-semibold py-3.5 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Creating account…' : 'Get Started'}
        </button>
      </form>

      <p className="text-center text-white/50 text-sm mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-gold hover:text-gold-light font-medium">
          Sign in
        </Link>
      </p>

      <p className="text-center text-white/30 text-xs mt-4 px-4">
        By signing up you agree to keep your data private and secure.
      </p>
    </div>
  )
}
