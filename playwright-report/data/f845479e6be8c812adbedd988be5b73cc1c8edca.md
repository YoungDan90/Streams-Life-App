# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-onboarding.spec.ts >> Onboarding — Multi-step wizard >> step 5 — big why requires 10+ characters
- Location: tests/02-onboarding.spec.ts:94:7

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator:  locator('button:has-text("Continue")')
Expected: disabled
Received: enabled
Timeout:  10000ms

Call log:
  - Expect "toBeDisabled" with timeout 10000ms
  - waiting for locator('button:has-text("Continue")')
    14 × locator resolved to <button class="w-full bg-gold text-navy font-semibold py-4 rounded-xl text-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Continue →</button>
       - unexpected value "enabled"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - paragraph [ref=e5]: Step 5 of 7
    - generic [ref=e7]:
      - heading "Your big why" [level=2] [ref=e8]
      - paragraph [ref=e9]: What does living a full life mean to you?
      - textbox "For me, a full life means…" [active] [ref=e10]: To build a life
      - paragraph [ref=e11]: This is private and helps Liv give you more personal coaching.
      - button "Continue →" [ref=e12] [cursor=pointer]
    - button "← Back" [ref=e14] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e20] [cursor=pointer]:
    - img [ref=e21]
  - alert [ref=e24]
```

# Test source

```ts
  11  |   test.beforeEach(async ({ page }) => {
  12  |     await mockAuth(page)
  13  | 
  14  |     // Override profile to not be onboarding complete so middleware allows /onboarding
  15  |     await page.route('**/rest/v1/profiles**', async route => {
  16  |       if (route.request().method() === 'GET') {
  17  |         await route.fulfill({
  18  |           status: 200,
  19  |           contentType: 'application/json',
  20  |           body: JSON.stringify([{
  21  |             id: 'test-user-id-123',
  22  |             onboarding_complete: false,
  23  |             first_name: null,
  24  |             appearance_mode: 'light',
  25  |           }]),
  26  |         })
  27  |       } else {
  28  |         await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  29  |       }
  30  |     })
  31  |   })
  32  | 
  33  |   test('step 1 — welcome screen shows correctly', async ({ page }) => {
  34  |     await page.goto(`${BASE}/onboarding`)
  35  |     await expect(page.locator('h1')).toContainText('Streams Life')
  36  |     await expect(page.locator('text=Get Started')).toBeVisible()
  37  |   })
  38  | 
  39  |   test('step 2 — name input requires at least one character', async ({ page }) => {
  40  |     await page.goto(`${BASE}/onboarding`)
  41  |     // Click Get Started → step 2
  42  |     await page.locator('text=Get Started').click()
  43  |     await expect(page.locator('text=What\'s your name')).toBeVisible()
  44  | 
  45  |     // Continue button should be disabled without a name
  46  |     const continueBtn = page.locator('button:has-text("Continue")')
  47  |     await expect(continueBtn).toBeDisabled()
  48  | 
  49  |     // Enter name — button should enable
  50  |     await page.locator('input[type="text"]').fill('Alex')
  51  |     await expect(continueBtn).toBeEnabled()
  52  |   })
  53  | 
  54  |   test('step 3 — life areas require at least 3 selections', async ({ page }) => {
  55  |     await page.goto(`${BASE}/onboarding`)
  56  |     await page.locator('text=Get Started').click()
  57  |     await page.locator('input[type="text"]').fill('Alex')
  58  |     await page.locator('button:has-text("Continue")').click()
  59  | 
  60  |     await expect(page.locator('text=Your life areas')).toBeVisible()
  61  | 
  62  |     // Continue should be disabled with fewer than 3 areas
  63  |     const continueBtn = page.locator('button:has-text("Continue")')
  64  |     await expect(continueBtn).toBeDisabled()
  65  | 
  66  |     // Select 2 areas — still disabled
  67  |     await page.locator('button:has-text("Health & Fitness")').click()
  68  |     await page.locator('button:has-text("Career & Business")').click()
  69  |     await expect(continueBtn).toBeDisabled()
  70  | 
  71  |     // Select 3rd — now enabled
  72  |     await page.locator('button:has-text("Personal Growth")').click()
  73  |     await expect(continueBtn).toBeEnabled()
  74  |   })
  75  | 
  76  |   test('step 4 — goals step shows selected areas', async ({ page }) => {
  77  |     await page.goto(`${BASE}/onboarding`)
  78  |     // Navigate through steps quickly
  79  |     await page.locator('text=Get Started').click()
  80  |     await page.locator('input[type="text"]').fill('Alex')
  81  |     await page.locator('button:has-text("Continue")').click()
  82  | 
  83  |     await page.locator('button:has-text("Health & Fitness")').click()
  84  |     await page.locator('button:has-text("Career & Business")').click()
  85  |     await page.locator('button:has-text("Personal Growth")').click()
  86  |     await page.locator('button:has-text("Continue")').click()
  87  | 
  88  |     // Step 4 — goals
  89  |     await expect(page.locator('text=Set your goals')).toBeVisible()
  90  |     // Should show the 3 selected areas as labels
  91  |     await expect(page.locator('text=HEALTH & FITNESS')).toBeVisible()
  92  |   })
  93  | 
  94  |   test('step 5 — big why requires 10+ characters', async ({ page }) => {
  95  |     await page.goto(`${BASE}/onboarding`)
  96  |     await page.locator('text=Get Started').click()
  97  |     await page.locator('input[type="text"]').fill('Alex')
  98  |     await page.locator('button:has-text("Continue")').click()
  99  |     await page.locator('button:has-text("Health & Fitness")').click()
  100 |     await page.locator('button:has-text("Career & Business")').click()
  101 |     await page.locator('button:has-text("Personal Growth")').click()
  102 |     await page.locator('button:has-text("Continue")').click()
  103 |     await page.locator('button:has-text("Continue")').click() // skip goals
  104 | 
  105 |     // Step 5 — big why
  106 |     await expect(page.locator('text=Your big why')).toBeVisible()
  107 |     const continueBtn = page.locator('button:has-text("Continue")')
  108 |     await expect(continueBtn).toBeDisabled()
  109 | 
  110 |     await page.locator('textarea').fill('To build a life')
> 111 |     await expect(continueBtn).toBeDisabled() // still less than 10
      |                               ^ Error: expect(locator).toBeDisabled() failed
  112 | 
  113 |     await page.locator('textarea').fill('To build a life I am proud of')
  114 |     await expect(continueBtn).toBeEnabled()
  115 |   })
  116 | 
  117 |   test('back button works on step 2', async ({ page }) => {
  118 |     await page.goto(`${BASE}/onboarding`)
  119 |     await page.locator('text=Get Started').click()
  120 |     await expect(page.locator('text=What\'s your name')).toBeVisible()
  121 | 
  122 |     await page.locator('text=← Back').click()
  123 |     await expect(page.locator('text=Get Started')).toBeVisible()
  124 |   })
  125 | 
  126 |   test('progress bar is visible after step 1', async ({ page }) => {
  127 |     await page.goto(`${BASE}/onboarding`)
  128 |     await page.locator('text=Get Started').click()
  129 |     // Progress bar should be visible after step 1
  130 |     const progressBar = page.locator('.bg-gold.rounded-full')
  131 |     await expect(progressBar.first()).toBeVisible()
  132 |   })
  133 | })
  134 | 
```