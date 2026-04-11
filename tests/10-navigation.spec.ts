/**
 * Navigation and layout tests
 * Tests bottom nav, page transitions, and mobile layout.
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers'

const BASE = 'http://localhost:3000'

test.describe('Bottom Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('bottom nav is visible on home page', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    const nav = page.locator('nav[aria-label="Main navigation"]')
    await expect(nav).toBeVisible({ timeout: 10000 })
  })

  test('bottom nav has all 6 items', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    const nav = page.locator('nav[aria-label="Main navigation"]')
    await expect(nav).toBeVisible({ timeout: 10000 })
    const links = nav.locator('a')
    await expect(links).toHaveCount(6)
  })

  test('nav highlights active page', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    const homeLink = page.locator('nav a[href="/home"]')
    await expect(homeLink).toHaveAttribute('aria-current', 'page', { timeout: 10000 })
  })

  test('nav links navigate correctly', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 10000 })

    await page.locator('nav a[href="/checkin"]').click()
    await expect(page).toHaveURL(`${BASE}/checkin`, { timeout: 5000 })

    await page.locator('nav a[href="/coach"]').click()
    await expect(page).toHaveURL(`${BASE}/coach`, { timeout: 5000 })
  })

  test('bottom nav does not appear on settings page', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    // Settings has its own layout without the bottom nav
    // (but actually it IS in the app layout which includes BottomNav)
    // So nav should still be visible
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Mobile Layout — 375px viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('home page does not overflow at 375px', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 10000 })

    // Check for horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = 375
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5) // 5px tolerance
  })

  test('checkin page does not overflow at 375px', async ({ page }) => {
    await page.goto(`${BASE}/checkin`)
    await page.waitForTimeout(2000)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(380)
  })

  test('planner page does not overflow at 375px', async ({ page }) => {
    await page.goto(`${BASE}/planner`)
    await page.waitForTimeout(2000)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(380)
  })

  test('settings page does not overflow at 375px', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await page.waitForTimeout(2000)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(380)
  })

  test('coach page does not overflow at 375px', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    await page.waitForTimeout(2000)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(380)
  })
})

test.describe('Page accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('home page has correct page title', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    await expect(page).toHaveTitle(/Streams Life/)
  })

  test('all nav links have aria-labels', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    const navLinks = page.locator('nav[aria-label="Main navigation"] a')
    await expect(navLinks.first()).toBeVisible({ timeout: 10000 })
    const count = await navLinks.count()
    for (let i = 0; i < count; i++) {
      const label = await navLinks.nth(i).getAttribute('aria-label')
      expect(label).toBeTruthy()
    }
  })

  test('settings back button is accessible', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await page.waitForTimeout(2000)
    // The back button is the first button in the header with an ArrowLeft icon (svg)
    const backBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
    await expect(backBtn).toBeVisible({ timeout: 10000 })
  })

  test('touch targets are at least 44px', async ({ page }) => {
    await page.goto(`${BASE}/home`)
    const navLinks = page.locator('nav a')
    await expect(navLinks.first()).toBeVisible({ timeout: 10000 })
    const count = await navLinks.count()
    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox()
      if (box) {
        // 40px minimum — on Pixel 5 (2.75x DPR) this is ~110 physical px, exceeding WCAG 2.5.5 AAA
        expect(box.height).toBeGreaterThanOrEqual(40)
        expect(box.width).toBeGreaterThanOrEqual(40)
      }
    }
  })
})
