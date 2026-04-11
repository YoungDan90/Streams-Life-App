/**
 * Journey 1 (continued) — Onboarding flow
 * Tests the multi-step onboarding wizard.
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers'

const BASE = 'http://localhost:3000'

test.describe('Onboarding — Multi-step wizard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)

    // Override profile to not be onboarding complete so middleware allows /onboarding
    await page.route('**/rest/v1/profiles**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'test-user-id-123',
            onboarding_complete: false,
            first_name: null,
            appearance_mode: 'light',
          }]),
        })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
    })
  })

  test('step 1 — welcome screen shows correctly', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    await expect(page.locator('h1')).toContainText('Streams Life')
    await expect(page.locator('text=Get Started')).toBeVisible()
  })

  test('step 2 — name input requires at least one character', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    // Click Get Started → step 2
    await page.locator('text=Get Started').click()
    await expect(page.locator('text=What\'s your name')).toBeVisible()

    // Continue button should be disabled without a name
    const continueBtn = page.locator('button:has-text("Continue")')
    await expect(continueBtn).toBeDisabled()

    // Enter name — button should enable
    await page.locator('input[type="text"]').fill('Alex')
    await expect(continueBtn).toBeEnabled()
  })

  test('step 3 — life areas require at least 3 selections', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    await page.locator('text=Get Started').click()
    await page.locator('input[type="text"]').fill('Alex')
    await page.locator('button:has-text("Continue")').click()

    await expect(page.locator('text=Your life areas')).toBeVisible()

    // Continue should be disabled with fewer than 3 areas
    const continueBtn = page.locator('button:has-text("Continue")')
    await expect(continueBtn).toBeDisabled()

    // Select 2 areas — still disabled
    await page.locator('button:has-text("Health & Fitness")').click()
    await page.locator('button:has-text("Career & Business")').click()
    await expect(continueBtn).toBeDisabled()

    // Select 3rd — now enabled
    await page.locator('button:has-text("Personal Growth")').click()
    await expect(continueBtn).toBeEnabled()
  })

  test('step 4 — goals step shows selected areas', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    // Navigate through steps quickly
    await page.locator('text=Get Started').click()
    await page.locator('input[type="text"]').fill('Alex')
    await page.locator('button:has-text("Continue")').click()

    await page.locator('button:has-text("Health & Fitness")').click()
    await page.locator('button:has-text("Career & Business")').click()
    await page.locator('button:has-text("Personal Growth")').click()
    await page.locator('button:has-text("Continue")').click()

    // Step 4 — goals
    await expect(page.locator('text=Set your goals')).toBeVisible()
    // Should show the 3 selected areas as labels
    await expect(page.locator('text=HEALTH & FITNESS')).toBeVisible()
  })

  test('step 5 — big why requires 10+ characters', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    await page.locator('text=Get Started').click()
    await page.locator('input[type="text"]').fill('Alex')
    await page.locator('button:has-text("Continue")').click()
    await page.locator('button:has-text("Health & Fitness")').click()
    await page.locator('button:has-text("Career & Business")').click()
    await page.locator('button:has-text("Personal Growth")').click()
    await page.locator('button:has-text("Continue")').click()
    await page.locator('button:has-text("Continue")').click() // skip goals

    // Step 5 — big why
    await expect(page.locator('text=Your big why')).toBeVisible()
    const continueBtn = page.locator('button:has-text("Continue")')
    await expect(continueBtn).toBeDisabled()

    await page.locator('textarea').fill('Short')
    await expect(continueBtn).toBeDisabled() // still less than 10 chars

    await page.locator('textarea').fill('To build a life I am proud of')
    await expect(continueBtn).toBeEnabled()
  })

  test('back button works on step 2', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    await page.locator('text=Get Started').click()
    await expect(page.locator('text=What\'s your name')).toBeVisible()

    await page.locator('text=← Back').click()
    await expect(page.locator('text=Get Started')).toBeVisible()
  })

  test('progress bar is visible after step 1', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    await page.locator('text=Get Started').click()
    // Progress bar container should be visible after step 1 — check the track and step counter
    await expect(page.locator('text=Step 2 of 7')).toBeVisible({ timeout: 10000 })
  })
})
