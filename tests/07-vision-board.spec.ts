/**
 * Journey 6 — Vision Board
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers'

const BASE = 'http://localhost:3000'

test.describe('Vision Board', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('empty state shows helpful prompt', async ({ page }) => {
    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Your vision starts here')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Add your first item')).toBeVisible()
  })

  test('+ button opens item type chooser', async ({ page }) => {
    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Your vision starts here')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Add item to vision board"]').click()
    // Should show type chooser with Quote and Goal Statement buttons
    await expect(page.locator('button:has-text("Quote")')).toBeVisible()
    await expect(page.locator('button:has-text("Goal Statement")')).toBeVisible()
  })

  test('adding a quote shows quote form', async ({ page }) => {
    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Your vision starts here')).toBeVisible({ timeout: 10000 })
    // Click the FAB + button (bottom right)
    await page.locator('button[aria-label="Add item to vision board"]').click()
    await page.locator('button:has-text("Quote")').click()
    await expect(page.locator('textarea[placeholder*="inspiring quote"]')).toBeVisible()
  })

  test('adding a goal statement shows goal form', async ({ page }) => {
    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Your vision starts here')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Add item to vision board"]').click()
    await page.locator('button:has-text("Goal Statement")').click()
    await expect(page.locator('textarea[placeholder*="I am"]')).toBeVisible()
  })

  test('submitting a quote adds it to the grid', async ({ page }) => {
    // Override to return the new item after POST so it appears in the grid
    await page.route('**/rest/v1/vision_board_items**', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'new-item-1',
            user_id: 'test-user-id-123',
            type: 'quote',
            content: 'The best time to start was yesterday.',
            image_url: null,
            created_at: new Date().toISOString(),
          }]),
        })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })

    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Your vision starts here')).toBeVisible({ timeout: 10000 })

    await page.locator('button[aria-label="Add item to vision board"]').click()
    await page.locator('button:has-text("Quote")').click()
    await page.locator('textarea').fill('The best time to start was yesterday.')
    await page.locator('button:has-text("Add to Board")').click()

    // Quote should appear in grid after successful insert
    await expect(page.locator('text=The best time to start was yesterday.')).toBeVisible({ timeout: 5000 })
  })

  test('submitting a goal adds it to the grid', async ({ page }) => {
    await page.route('**/rest/v1/vision_board_items**', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'new-item-2',
            user_id: 'test-user-id-123',
            type: 'goal',
            content: 'Launch my business by Q3',
            image_url: null,
            created_at: new Date().toISOString(),
          }]),
        })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })

    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Your vision starts here')).toBeVisible({ timeout: 10000 })

    await page.locator('button[aria-label="Add item to vision board"]').click()
    await page.locator('button:has-text("Goal Statement")').click()
    await page.locator('textarea').fill('Launch my business by Q3')
    await page.locator('button:has-text("Add to Board")').click()

    await expect(page.locator('text=Launch my business by Q3')).toBeVisible({ timeout: 5000 })
  })

  test('existing items load on page open', async ({ page }) => {
    await page.route('**/rest/v1/vision_board_items**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'item-1', user_id: 'test-user-id-123', type: 'quote', content: 'Dream big', image_url: null, created_at: new Date().toISOString() },
          { id: 'item-2', user_id: 'test-user-id-123', type: 'goal', content: 'Build my empire', image_url: null, created_at: new Date().toISOString() },
        ]),
      })
    })

    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Dream big')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Build my empire')).toBeVisible()
  })

  test('empty state is not shown when items exist', async ({ page }) => {
    await page.route('**/rest/v1/vision_board_items**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'item-1', user_id: 'test-user-id-123', type: 'quote', content: 'Dream big', image_url: null, created_at: new Date().toISOString() },
        ]),
      })
    })

    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Dream big')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Your vision starts here')).not.toBeVisible()
  })

  test('X/close button closes add sheet', async ({ page }) => {
    await page.goto(`${BASE}/vision-board`)
    await expect(page.locator('text=Your vision starts here')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Add item to vision board"]').click()
    await page.locator('button:has-text("Quote")').click()

    // Close with back button
    await page.locator('button[aria-label="Go back"]').click()
    await expect(page.locator('text=Your vision starts here')).toBeVisible()
  })
})
