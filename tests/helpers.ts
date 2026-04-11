import { Page, Route } from '@playwright/test'

// Must match the getWeekNumber() formula used in app/(app)/planner/page.tsx
function getCurrentWeek(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}

// ─── Fake data ───────────────────────────────────────────────
export const FAKE_USER = {
  id: 'test-user-id-123',
  email: 'test@streamslife.app',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
}

export const FAKE_PROFILE = {
  id: 'test-user-id-123',
  first_name: 'Alex',
  big_why: 'To build a life I am proud of',
  notification_time: null,
  onboarding_complete: true,
  subscription_plan: 'free',
  notify_checkin: true,
  notify_weekly: true,
  notify_goals: true,
  appearance_mode: 'light',
  text_size: 'medium',
  created_at: new Date().toISOString(),
}

export const FAKE_LIFE_AREAS = [
  { id: 'area-1', user_id: 'test-user-id-123', name: 'Health & Fitness', is_custom: false, created_at: new Date().toISOString() },
  { id: 'area-2', user_id: 'test-user-id-123', name: 'Career & Business', is_custom: false, created_at: new Date().toISOString() },
  { id: 'area-3', user_id: 'test-user-id-123', name: 'Family & Relationships', is_custom: false, created_at: new Date().toISOString() },
]

export const FAKE_CHECKIN = {
  id: 'checkin-1',
  user_id: 'test-user-id-123',
  date: new Date().toISOString().split('T')[0],
  scores: { 'Health & Fitness': 4, 'Career & Business': 3, 'Family & Relationships': 5 },
  focus_text: 'Ship the new feature by EOD',
  created_at: new Date().toISOString(),
}

export const FAKE_GOALS = [
  {
    id: 'goal-1',
    user_id: 'test-user-id-123',
    life_area_id: 'area-1',
    title: 'Run my first 5K',
    target_date: '2026-07-01',
    progress: 30,
    created_at: new Date().toISOString(),
    life_areas: { name: 'Health & Fitness' },
    goal_actions: [
      { id: 'action-1', goal_id: 'goal-1', week_number: getCurrentWeek(), action_text: 'Run 2km three times this week', completed: false, due_date: null, created_at: new Date().toISOString() },
      { id: 'action-2', goal_id: 'goal-1', week_number: getCurrentWeek(), action_text: 'Buy proper running shoes', completed: true, due_date: null, created_at: new Date().toISOString() },
    ],
  },
]

export const FAKE_SESSIONS = [
  { id: 'session-1', user_id: 'test-user-id-123', task_name: 'Write unit tests', life_area_id: 'area-2', duration_minutes: 45, completed_at: new Date().toISOString() },
]

// ─── Auth mock ───────────────────────────────────────────────
/**
 * Mock Supabase auth so the app thinks a user is logged in.
 * Strategy:
 *  1. Set e2e-bypass cookie — middleware and server components skip auth checks (dev only)
 *  2. Inject a fake session into localStorage so the browser Supabase client returns a user
 *     (the storage key "sb-127-auth-token" is derived from http://127.0.0.1:54321)
 *  3. Intercept all browser-level Supabase network calls with mock data
 */
export async function mockAuth(page: Page) {
  // Set e2e-bypass cookie so the server-side layout skips Supabase auth check.
  // Only works in development mode (NODE_ENV=development) — no security risk in production.
  await page.context().addCookies([
    { name: 'e2e-bypass', value: '1', domain: 'localhost', path: '/' },
  ])

  // Inject a fake Supabase session cookie so client-side createBrowserClient().auth.getUser()
  // finds a session and calls /auth/v1/user (which is intercepted below).
  // @supabase/ssr createBrowserClient uses document.cookie (not localStorage).
  // Cookie name "sb-127-auth-token" is derived from NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  // Cookie value is "base64-{base64url(JSON.stringify(session))}" per @supabase/ssr encoding.
  const fakeSession = {
    access_token: 'fake-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: FAKE_USER,
  }
  const sessionJson = JSON.stringify(fakeSession)
  const base64Value = 'base64-' + Buffer.from(sessionJson, 'utf8').toString('base64url')
  await page.context().addCookies([
    { name: 'sb-127-auth-token', value: base64Value, domain: 'localhost', path: '/' },
  ])

  await page.route('**/auth/v1/user', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_USER),
    })
  })

  await page.route('**/auth/v1/token**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'fake-refresh-token',
        user: FAKE_USER,
      }),
    })
  })

  await page.route('**/auth/v1/signup', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'fake-refresh-token',
        user: FAKE_USER,
      }),
    })
  })

  // Helper: detect whether the request is a .single() query
  // .single() sets Accept: application/vnd.pgrst.object+json — the client expects
  // a single JSON object (not an array). Returning an array causes data.field = undefined.
  function isSingleQuery(route: Route): boolean {
    const accept = route.request().headers()['accept'] || ''
    return accept.includes('application/vnd.pgrst.object+json')
  }

  // Mock profile fetch — profiles are always queried with .single()
  await page.route('**/rest/v1/profiles**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isSingleQuery(route) ? JSON.stringify(FAKE_PROFILE) : JSON.stringify([FAKE_PROFILE]),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_PROFILE) })
    }
  })

  // Mock life_areas
  await page.route('**/rest/v1/life_areas**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_LIFE_AREAS),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_LIFE_AREAS) })
    }
  })

  // Mock checkins — may be queried as list or with .single() for today's check-in
  await page.route('**/rest/v1/checkins**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isSingleQuery(route) ? JSON.stringify(FAKE_CHECKIN) : JSON.stringify([FAKE_CHECKIN]),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_CHECKIN) })
    }
  })

  // Mock goals
  await page.route('**/rest/v1/goals**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_GOALS),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_GOALS) })
    }
  })

  // Mock goal_actions
  await page.route('**/rest/v1/goal_actions**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // Mock focus_sessions
  await page.route('**/rest/v1/focus_sessions**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_SESSIONS),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
  })

  // Mock coach_conversations
  await page.route('**/rest/v1/coach_conversations**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // Mock vision_board_items
  await page.route('**/rest/v1/vision_board_items**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // Mock feedback
  await page.route('**/rest/v1/feedback**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // Mock storage
  await page.route('**/storage/v1/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  })

  // Mock API routes
  await page.route('**/api/coach', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: "Hello Alex! I'm Liv, your AI life coach. How can I help you today?" }),
    })
  })

  await page.route('**/api/planner', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plan: [
          { week: 1, actions: ['Run 2km three times', 'Buy running shoes'] },
          { week: 2, actions: ['Run 3km twice', 'Track your pace'] },
        ],
      }),
    })
  })

  await page.route('**/api/weekly-summary', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ summary: 'Great week, Alex! You showed strong consistency in your check-ins. Focus on Health next week.' }),
    })
  })

  await page.route('**/api/export', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'Date,Score\n2026-04-08,4.2',
    })
  })

  await page.route('**/api/feedback', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })

  await page.route('**/api/settings/delete-account', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

// ─── Set a fake session cookie so middleware passes ───────────
export async function setFakeSession(page: Page, baseURL: string) {
  // Supabase SSR reads cookies named sb-<project-ref>-auth-token
  // Since we're mocking all API calls, we just need the middleware auth check to pass.
  // We mock the auth/user endpoint, so as long as the middleware supabase client
  // calls that endpoint and gets a user back, it will allow the request through.
  // This is handled by the route mock above.
  void page
  void baseURL
}
