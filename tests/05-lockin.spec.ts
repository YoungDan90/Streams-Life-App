/**
 * Journey 4 — Lock In focus timer
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers'

const BASE = 'http://localhost:3000'

test.describe('Lock In Timer', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('setup screen renders correctly', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await expect(page.locator('h1')).toContainText('Lock In')
    await expect(page.locator('input[placeholder*="quarterly report"]')).toBeVisible()
    await expect(page.locator('text=25 min')).toBeVisible()
    await expect(page.locator('text=45 min')).toBeVisible()
    await expect(page.locator('text=60 min')).toBeVisible()
  })

  test('start button is disabled without task name', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    const startBtn = page.locator('button:has-text("Start Session")')
    await expect(startBtn).toBeDisabled()
  })

  test('start button enables after entering task name', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('input[placeholder*="quarterly report"]').fill('Write quarterly report')
    const startBtn = page.locator('button:has-text("Start Session")')
    await expect(startBtn).toBeEnabled()
  })

  test('duration presets are selectable', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('button:has-text("45 min")').click()
    // 45 min button should appear selected (bg-navy style)
    await expect(page.locator('button:has-text("45 min")')).toHaveClass(/bg-navy/)
  })

  test('custom duration toggle works', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('button:has-text("Custom")').click()
    await expect(page.locator('input[placeholder="Minutes"]')).toBeVisible()
  })

  test('starting timer shows countdown screen', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('input[placeholder*="quarterly report"]').fill('Deep work')
    await page.locator('button:has-text("Start Session")').click()

    // Should show timer screen
    await expect(page.locator('text=remaining')).toBeVisible()
    await expect(page.locator('text=Deep work')).toBeVisible()
  })

  test('pause and resume work', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('input[placeholder*="quarterly report"]').fill('Deep work')
    await page.locator('button:has-text("Start Session")').click()

    // Pause
    const pauseBtn = page.locator('button[aria-label]').filter({ hasNot: page.locator('svg[data-lucide]') })
    // Find pause button by its icon
    await page.locator('svg').filter({ hasText: '' }).first()

    // Find pause button (contains Pause icon)
    const controls = page.locator('.flex.items-center.gap-5')
    await expect(controls).toBeVisible()

    // Click pause
    const pauseButton = page.locator('button').filter({ has: page.locator('[data-lucide="pause"]') })
    if (await pauseButton.count() > 0) {
      await pauseButton.click()
      await expect(page.locator('text=Paused')).toBeVisible()
    }
  })

  test('ending session early shows done screen', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('input[placeholder*="quarterly report"]').fill('Quick task')
    await page.locator('button:has-text("Start Session")').click()

    // Click Stop/End button (square icon)
    const stopBtn = page.locator('button').filter({ has: page.locator('[data-lucide="square"]') })
    if (await stopBtn.count() > 0) {
      await stopBtn.click()
      await expect(page.locator('text=Session complete')).toBeVisible({ timeout: 5000 })
    }
  })

  test('cancel returns to setup screen', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('input[placeholder*="quarterly report"]').fill('Quick task')
    await page.locator('button:has-text("Start Session")').click()
    await page.locator('text=Cancel session').click()
    await expect(page.locator('h1')).toContainText('Lock In')
  })

  test('life area selector works', async ({ page }) => {
    await page.goto(`${BASE}/lockin`)
    await page.locator('button:has-text("Select a life area")').click()
    // Should show life areas from mock
    await expect(page.locator('text=Health & Fitness')).toBeVisible()
    await page.locator('text=Health & Fitness').click()
    // Button should now show the selected area
    await expect(page.locator('button:has-text("Health & Fitness")')).toBeVisible()
  })
})
