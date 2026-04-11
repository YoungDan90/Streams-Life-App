/**
 * Journey 3 — Liv Coach conversation
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers'

const BASE = 'http://localhost:3000'

test.describe('Liv Coach', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test('coach page loads with input immediately visible', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    // Input box should be visible immediately (not hidden behind loading)
    const input = page.locator('textarea[placeholder="Message Liv…"]')
    await expect(input).toBeVisible({ timeout: 10000 })
  })

  test('empty state shows starter prompts', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    await expect(page.locator('text=Hello, I\'m Liv.')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=I\'m feeling overwhelmed')).toBeVisible()
  })

  test('send button is disabled when input is empty', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    await expect(page.locator('textarea[placeholder="Message Liv…"]')).toBeVisible({ timeout: 10000 })
    const sendBtn = page.locator('button[aria-label="Send message"]')
    await expect(sendBtn).toBeDisabled()
  })

  test('typing enables send button', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    const input = page.locator('textarea[placeholder="Message Liv…"]')
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('Hello Liv')
    const sendBtn = page.locator('button[aria-label="Send message"]')
    await expect(sendBtn).toBeEnabled()
  })

  test('sending a message shows user bubble and Liv response', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    const input = page.locator('textarea[placeholder="Message Liv…"]')
    await expect(input).toBeVisible({ timeout: 10000 })

    await input.fill("I'm feeling overwhelmed")
    await page.locator('button[aria-label="Send message"]').click()

    // User message appears
    await expect(page.locator('text=I\'m feeling overwhelmed').last()).toBeVisible({ timeout: 5000 })

    // Liv response appears (mocked)
    await expect(page.locator("text=Hello Alex! I'm Liv")).toBeVisible({ timeout: 10000 })
  })

  test('history panel can be opened', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    await expect(page.locator('text=History')).toBeVisible({ timeout: 10000 })
    await page.locator('text=History').click()
    // Use role-based locator to avoid matching "No conversations yet." substring
    await expect(page.locator('h2:has-text("Conversations")')).toBeVisible()
  })

  test('new conversation button clears messages', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    await expect(page.locator('text=New')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("New")').first().click()
    // Empty state should show
    await expect(page.locator('text=Hello, I\'m Liv.')).toBeVisible()
  })

  test('starter prompt clicking sends message', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    await expect(page.locator('text=I\'m feeling overwhelmed')).toBeVisible({ timeout: 10000 })
    await page.locator('text=I\'m feeling overwhelmed').click()
    // Message should appear in chat
    await expect(page.locator("text=Hello Alex! I'm Liv")).toBeVisible({ timeout: 10000 })
  })

  test('keyboard Enter sends message', async ({ page }) => {
    await page.goto(`${BASE}/coach`)
    const input = page.locator('textarea[placeholder="Message Liv…"]')
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('Help me plan my week')
    await input.press('Enter')
    await expect(page.locator("text=Hello Alex! I'm Liv")).toBeVisible({ timeout: 10000 })
  })
})
