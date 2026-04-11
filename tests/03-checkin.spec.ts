/**
 * Journey 2 — Daily Check-In
 */
import { test, expect, type Route } from '@playwright/test'
import { mockAuth, FAKE_LIFE_AREAS } from './helpers'

function isSingleQuery(route: Route): boolean {
  const accept = route.request().headers()['accept'] || ''
  return accept.includes('application/vnd.pgrst.object+json')
}

const BASE = 'http://localhost:3000'

test.describe('Daily Check-In', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)

    // Override checkins to return empty (so todayDone = false)
    // .single() queries get null (no row found); list queries get []
    await page.route('**/rest/v1/checkins**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isSingleQuery(route) ? JSON.stringify(null) : JSON.stringify([]),
      })
    })
  })

  test('checkin page loads with life areas', async ({ page }) => {
    await page.goto(`${BASE}/checkin`)
    // Should show life area names
    for (const area of FAKE_LIFE_AREAS) {
      await expect(page.locator(`text=${area.name}`)).toBeVisible({ timeout: 10000 })
    }
  })

  test('score buttons are interactive and show selection', async ({ page }) => {
    await page.goto(`${BASE}/checkin`)

    // Wait for areas to load
    await expect(page.locator(`text=Health & Fitness`)).toBeVisible({ timeout: 10000 })

    // Click score 5 for first area
    const scoreButtons = page.locator('[aria-label*="Health & Fitness: score 5"]')
    await scoreButtons.first().click()
    await expect(scoreButtons.first()).toHaveAttribute('aria-pressed', 'true')
  })

  test('proceeding to focus step works', async ({ page }) => {
    await page.goto(`${BASE}/checkin`)
    await expect(page.locator('text=Health & Fitness')).toBeVisible({ timeout: 10000 })

    // Click Next button
    const nextBtn = page.locator('button:has-text("Next")')
    await nextBtn.click()

    // Should be on focus step
    await expect(page.locator('text=One focus')).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('focus step allows submitting without text', async ({ page }) => {
    await page.goto(`${BASE}/checkin`)
    await expect(page.locator('text=Health & Fitness')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Next")').click()

    // Mock the upsert
    await page.route('**/rest/v1/checkins**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    // Submit without focus text - button should be enabled and show different label
    const submitBtn = page.locator('button:has-text("Submit without focus")')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toBeEnabled()
  })

  test('focus step allows submitting with text', async ({ page }) => {
    await page.goto(`${BASE}/checkin`)
    await expect(page.locator('text=Health & Fitness')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Next")').click()

    await page.route('**/rest/v1/checkins**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'new' }) })
    })

    await page.locator('textarea').fill('Ship the feature today')
    const submitBtn = page.locator('button:has-text("Submit Check-In")')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    // Should show done state
    await expect(page.locator('text=Check-in complete')).toBeVisible({ timeout: 5000 })
  })

  test('back button on focus step returns to scores', async ({ page }) => {
    await page.goto(`${BASE}/checkin`)
    await expect(page.locator('text=Health & Fitness')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Next")').click()
    await expect(page.locator('text=One focus')).toBeVisible()

    await page.locator('button:has-text("← Back to scores")').click()
    await expect(page.locator('text=Daily Check-In')).toBeVisible()
  })

  test('already completed today shows read-only view', async ({ page }) => {
    // Override to return today's checkin — .single() gets object, list queries get array
    await page.route('**/rest/v1/checkins**', async route => {
      const today = new Date().toISOString().split('T')[0]
      const checkin = {
        id: 'checkin-1',
        user_id: 'test-user-id-123',
        date: today,
        scores: { 'Health & Fitness': 4, 'Career & Business': 3, 'Family & Relationships': 5 },
        focus_text: 'Ship the new feature',
        created_at: new Date().toISOString(),
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isSingleQuery(route) ? JSON.stringify(checkin) : JSON.stringify([checkin]),
      })
    })

    await page.goto(`${BASE}/checkin`)
    await expect(page.locator('text=Already completed today')).toBeVisible({ timeout: 10000 })
  })
})
