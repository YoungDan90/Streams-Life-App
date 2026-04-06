'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/home')
  }

  return (
    <div className="animate-slide-up">
      <h2 className="text-white text-xl font-semibold text-center mb-6">Set new password</h2>

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="block text-gold/80 text-sm font-medium mb-1.5">New Password</label>
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
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
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
          className="w-full bg-gold text-navy font-semibold py-3.5 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
