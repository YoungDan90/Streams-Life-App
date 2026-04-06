'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Check if onboarding complete
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single()

      if (!profile?.onboarding_complete) {
        router.push('/onboarding')
      } else {
        router.push('/home')
      }
    }
  }

  return (
    <div className="animate-slide-up">
      <h2 className="text-white text-xl font-semibold text-center mb-6">Welcome back</h2>

      <form onSubmit={handleLogin} className="space-y-4">
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
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-gold/80 text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-gold/60 text-xs hover:text-gold">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-white/50 text-sm mt-6">
        New here?{' '}
        <Link href="/signup" className="text-gold hover:text-gold-light font-medium">
          Create an account
        </Link>
      </p>
    </div>
  )
}
