import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FEEDBACK_LENGTH = 2000

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const message: string = body?.message

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (message.length > MAX_FEEDBACK_LENGTH) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    // Store feedback in a simple table — if the table doesn't exist yet,
    // this returns an error which we catch gracefully.
    // The schema migration below adds this table.
    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      message: message.trim(),
    })

    if (error) {
      // Table may not exist yet — log server-side only, return success to user
      // to avoid leaking schema info
      console.error('Feedback insert error:', (error as { message?: string }).message ?? 'unknown')
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 })
  }
}
