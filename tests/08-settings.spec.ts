/**
 * Journey 7 — Settings
 */
import { test, expect } from '@playwright/test'
import { mockAuth, FAKE_PROFILE } from './helpers'

const BASE = 'http://localhost:3000'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('settings page loads correctly', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('h1')).toContainText('Settings', { timeout: 10000 })
  })

  test('account section shows user info', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=First name')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Alex')).toBeVisible()
  })

  test('edit name opens modal', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=First name')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("First name")').click()

    // Modal should open with correct title
    await expect(page.locator('text=Edit first name')).toBeVisible()
  })

  test('edit name saves and closes modal', async ({ page }) => {
    // Mock update to succeed
    await page.route('**/rest/v1/profiles**', async route => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      } else {
        const accept = route.request().headers()['accept'] || ''
        const isSingle = accept.includes('application/vnd.pgrst.object+json')
        const data = { ...FAKE_PROFILE, first_name: 'Jordan' }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: isSingle ? JSON.stringify(data) : JSON.stringify([data]),
        })
      }
    })

    await mockAuth(page)
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=First name')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("First name")').click()

    await page.locator('input[placeholder="Your name"]').fill('Jordan')
    await page.locator('button:has-text("Save")').click()

    // Modal should close
    await expect(page.locator('text=Edit first name')).not.toBeVisible({ timeout: 5000 })
  })

  test('appearance section exists', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    // Settings page has Theme section under Appearance
    await expect(page.locator('text=Theme')).toBeVisible({ timeout: 10000 })
  })

  test('notifications section has toggles', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=Notifications')).toBeVisible({ timeout: 10000 })
    // Should have 3 notification toggles (checkin, weekly, goals)
    const toggles = page.locator('[role="switch"]')
    await expect(toggles).toHaveCount(3)
  })

  test('life areas section shows user areas', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=Life Areas')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Health & Fitness')).toBeVisible()
  })

  test('delete account modal requires typing DELETE', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=Delete account')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Delete account")').click()

    await expect(page.locator('text=Delete account').nth(1)).toBeVisible()
    const deleteBtn = page.locator('button:has-text("Permanently delete my account")')
    await expect(deleteBtn).toBeDisabled()

    await page.locator('input[placeholder="DELETE"]').fill('DELETE')
    await expect(deleteBtn).toBeEnabled()
  })

  test('password change validates length', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=Change password')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Change password")').click()

    const passInputs = page.locator('input[type="password"]')
    await passInputs.first().fill('short')
    await passInputs.last().fill('short')
    await page.locator('button:has-text("Update password")').click()

    // Should show error toast
    await expect(page.locator('text=8+ characters')).toBeVisible({ timeout: 3000 })
  })

  test('feedback form works', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=Send feedback')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Send feedback")').click()

    await expect(page.locator('textarea')).toBeVisible()
    await page.locator('textarea').fill('This app is great!')
    await page.locator('button:has-text("Send feedback")').last().click()

    // Should show success toast
    await expect(page.locator('text=Feedback sent')).toBeVisible({ timeout: 5000 })
  })

  test('back button returns to home', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('h1')).toContainText('Settings', { timeout: 10000 })
    // Back button is a button with an SVG (ArrowLeft icon), next to the h1 in header
    await page.locator('button.w-9.h-9').first().click()
    await expect(page).toHaveURL(`${BASE}/home`, { timeout: 5000 })
  })

  test('plan section shows current plan', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await expect(page.locator('text=Subscription')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Free plan')).toBeVisible()
  })
})
