import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete user's vision board images from storage
    const { data: storageFiles } = await supabase.storage
      .from('vision-board')
      .list(user.id)

    if (storageFiles && storageFiles.length > 0) {
      const paths = storageFiles.map(f => `${user.id}/${f.name}`)
      await supabase.storage.from('vision-board').remove(paths)
    }

    // All other data is deleted by CASCADE when auth.users row is removed.
    // We use the service role admin client to delete the auth user.
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await adminClient.auth.admin.deleteUser(user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
