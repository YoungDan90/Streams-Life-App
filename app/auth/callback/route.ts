import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Validate `next` to prevent open redirect — must be a relative path
  const rawNext = searchParams.get('next') ?? '/home'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/home'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
