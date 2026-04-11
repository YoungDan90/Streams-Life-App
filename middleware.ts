import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // E2E test bypass: allow tests to skip auth in development by setting the e2e-bypass cookie
  if (process.env.NODE_ENV === 'development' && request.cookies.get('e2e-bypass')?.value === '1') {
    return supabaseResponse
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured (e.g. test/dev with placeholder values), skip auth checks
  const isConfigured = supabaseUrl && supabaseUrl.startsWith('http')
  if (!isConfigured) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // If Supabase is unreachable (e.g. test environment, network error), skip auth checks
    return supabaseResponse
  }

  const { pathname } = request.nextUrl
  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublic && !pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.png$).*)',
  ],
}
