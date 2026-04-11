import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'
import ThemeApplier from '@/components/ThemeApplier'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // E2E test bypass: when running Playwright tests against a non-Supabase environment,
  // skip auth and render the layout with defaults. Only active in development.
  if (process.env.NODE_ENV === 'development') {
    const cookieStore = await cookies()
    if (cookieStore.get('e2e-bypass')?.value === '1') {
      return (
        <div className="min-h-dvh bg-cream flex flex-col">
          <ThemeApplier appearanceMode="light" />
          <main className="flex-1 pb-24 safe-top">{children}</main>
          <BottomNav />
        </div>
      )
    }
  }

  let profile = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('onboarding_complete, appearance_mode')
      .eq('id', user.id)
      .single()
    profile = profileData

    if (!profile?.onboarding_complete) {
      redirect('/onboarding')
    }
  } catch (err) {
    // If redirect() was called it throws internally — re-throw so Next.js handles it
    if (err && typeof err === 'object' && 'digest' in err) throw err
    // Otherwise re-throw so Next.js surfaces the actual error
    throw err
  }

  const appearanceMode = (profile?.appearance_mode as 'light' | 'dark') || 'light'

  return (
    <div className="min-h-dvh bg-cream dark:bg-navy flex flex-col">
      <ThemeApplier appearanceMode={appearanceMode} />
      <main className="flex-1 pb-24 safe-top">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
