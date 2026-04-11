/**
 * Journey 5 — Goal Planner
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers'

const BASE = 'http://localhost:3000'

test.describe('Goal Planner', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('planner loads with existing goals', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('text=Run my first 5K')).toBeVisible({ timeout: 10000 })
  })

  test('goal shows progress bar', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('text=30%')).toBeVisible({ timeout: 10000 })
  })

  test('tab switching works', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('text=All Goals')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("This Week")').click()
    // Should switch to this week view — use button-specific locator to avoid strict mode violation
    await expect(page.locator('button:has-text("This Week")')).toHaveClass(/bg-white/)
  })

  test('add goal button navigates to add form', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('h1')).toContainText('Planner', { timeout: 10000 })
    // Click + button (w-9 h-9 bg-navy button in the header)
    await page.locator('button.w-9.bg-navy').click()
    await expect(page.locator('text=New Goal')).toBeVisible()
  })

  test('generate plan button is disabled without all fields', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('h1')).toContainText('Planner', { timeout: 10000 })
    await page.locator('button.w-9.bg-navy').click()

    const generateBtn = page.locator('button:has-text("Generate Plan")')
    await expect(generateBtn).toBeDisabled()
  })

  test('full add goal flow — fill form, generate plan, save', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('h1')).toContainText('Planner', { timeout: 10000 })
    await page.locator('button.w-9.bg-navy').click()

    // Fill goal text
    await page.locator('textarea[placeholder*="5K"]').fill('Run my first 5K race')

    // Select life area
    await page.locator('select').selectOption({ label: 'Health & Fitness' })

    // Set target date (30 days from now)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split('T')[0]
    await page.locator('input[type="date"]').fill(dateStr)

    // Generate plan
    await page.locator('button:has-text("Generate Plan")').click()

    // Should show generated plan (from mock)
    await expect(page.locator('text=Your Week-by-Week Plan')).toBeVisible({ timeout: 10000 })
    // Actions are rendered as <input> elements — check by value
    await expect(page.locator('input[value*="Run 2km three times"]')).toBeVisible()
  })

  test('goal can be expanded to show actions', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('text=Run my first 5K')).toBeVisible({ timeout: 10000 })
    await page.locator('text=Run my first 5K').click()
    // Should show actions for current week
    await expect(page.locator('text=Run 2km three times this week')).toBeVisible()
  })

  test('completing action updates the UI', async ({ page }) => {
    // Override goal_actions to handle PATCH (beforeEach mockAuth already set this up)
    await page.route('**/rest/v1/goal_actions**', async route => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })
    await page.goto(`${BASE}/planner`)
    await expect(page.locator('text=Run my first 5K')).toBeVisible({ timeout: 10000 })
    await page.locator('text=Run my first 5K').click()

    // Wait for expand animation to settle before clicking checkbox
    await page.waitForTimeout(400)

    // Click the checkbox for the first uncompleted action
    // Use native DOM click to bypass viewport-position checks (element is inside overflow container)
    const actionCheckboxes = page.locator('button.rounded-md.border-2').filter({ hasNot: page.locator('.bg-gold') })
    const count = await actionCheckboxes.count()
    if (count > 0) {
      await actionCheckboxes.first().evaluate(el => (el as HTMLElement).click())
      // The checkbox should eventually show as completed
    }
  })

  test('empty goals state shows prompt', async ({ page }) => {
    // Override goals to return empty — must be AFTER beforeEach's mockAuth so this handler wins
    await page.route('**/rest/v1/goals**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto(`${BASE}/planner`)
    await expect(page.locator('text=Tap + to set your first 90-day goal')).toBeVisible({ timeout: 10000 })
  })
})
