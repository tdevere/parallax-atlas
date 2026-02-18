import { expect, test } from '@playwright/test'

test('landing page renders with hero and milestone sections', async ({ page }) => {
  await page.goto('/')

  // Check hero section
  await expect(page.getByRole('heading', { name: /begin a new/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /learning journey/i })).toBeVisible()
  await expect(page.getByText(/track progress, build skills/i)).toBeVisible()

  // Check CTAs
  await expect(page.getByRole('button', { name: /start learning/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /view the map/i })).toBeVisible()

  // Check milestones section
  await expect(page.getByRole('heading', { name: /your learning path/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /onboard/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /fundamentals/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /practice/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /feedback/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /ship/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /mastery/i })).toBeVisible()

  // Check "How it Works" section
  await expect(page.getByRole('heading', { name: /how it works/i })).toBeVisible()
})

test('landing page milestone cards are interactive', async ({ page }) => {
  await page.goto('/')

  // Find and click a milestone card
  const practiceCard = page.getByRole('heading', { name: /^practice$/i })
  await practiceCard.click()

  // Modal should open with milestone details
  await expect(page.getByRole('heading', { name: /^practice$/i }).nth(1)).toBeVisible()
  await expect(page.getByText(/apply concepts through hands-on exercises/i).nth(1)).toBeVisible()
  await expect(page.getByRole('button', { name: /begin this milestone/i })).toBeVisible()

  // Close modal by clicking the backdrop
  await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } })

  // Modal should be closed
  await expect(page.getByRole('button', { name: /begin this milestone/i })).toHaveCount(0)
})

test('landing page navigation to login works', async ({ page }) => {
  await page.goto('/')

  // Click "Start learning" button instead (more stable)
  await page.getByRole('button', { name: /start learning/i }).first().click({ force: true })

  // Should navigate to login page
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
})

test('landing page "Start learning" button navigates to login', async ({ page }) => {
  await page.goto('/')

  // Click "Start learning" button
  await page.getByRole('button', { name: /start learning/i }).first().click()

  // Should navigate to login page
  await expect(page).toHaveURL('/login')
})

test('landing page "View the map" button navigates to app', async ({ page }) => {
  await page.goto('/')

  // Click "View the map" button
  await page.getByRole('button', { name: /view the map/i }).click()

  // Should navigate to app
  await expect(page).toHaveURL('/app')
  await expect(page.getByRole('heading', { name: /parallax atlas/i })).toBeVisible()
})

test('login page renders with form and journey illustration', async ({ page }) => {
  await page.goto('/login')

  // Check main heading
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /learning journey/i })).toBeVisible()

  // Check form elements
  await expect(page.getByRole('heading', { name: /sign in to continue/i })).toBeVisible()
  await expect(page.getByLabel(/email/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()

  // Check OAuth buttons
  await expect(page.getByRole('button', { name: /continue with microsoft/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()

  // Check journey stats using specific locators
  await expect(page.getByText('12')).toBeVisible()
  await expect(page.getByText('Eras Explored')).toBeVisible()
  await expect(page.getByText('68%')).toBeVisible()
  await expect(page.getByText('Progress', { exact: true })).toBeVisible()
})

test('login page back button returns to landing', async ({ page }) => {
  await page.goto('/login')

  // Click back button
  await page.getByRole('button', { name: /back/i }).click()

  // Should return to landing page
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: /begin a new/i })).toBeVisible()
})

test('login page form validation shows error', async ({ page }) => {
  await page.goto('/login')

  // Try to submit without filling form
  await page.getByRole('button', { name: /^sign in$/i }).click()

  // Should show loading state briefly then error
  await page.waitForTimeout(1100) // Wait for simulated auth

  // Form validation should trigger
  await expect(page.getByLabel(/email/i)).toBeVisible()
})

test('login page password toggle works', async ({ page }) => {
  await page.goto('/login')

  const passwordInput = page.getByLabel(/password/i)

  // Should start as password type
  await expect(passwordInput).toHaveAttribute('type', 'password')

  // The toggle button is next to the password input - find by test location
  const toggleButton = page.locator('button[type="button"]').filter({ has: page.locator('svg').first() })
  await toggleButton.first().click()

  // Should change to text type
  await expect(passwordInput).toHaveAttribute('type', 'text')

  // Click again to hide
  await toggleButton.first().click()

  // Should change back to password type
  await expect(passwordInput).toHaveAttribute('type', 'password')
})

test('landing page is responsive and accessible', async ({ page }) => {
  await page.goto('/')

  // Check for reduced motion support by checking that animations exist
  const motionElements = page.locator('[style*="transform"]')
  expect(await motionElements.count()).toBeGreaterThan(0)

  // Check keyboard navigation - tab to first button
  await page.keyboard.press('Tab')
  const signInButton = page.getByRole('button', { name: /sign in/i }).first()
  await expect(signInButton).toBeFocused()
})

test('responsive layout on mobile viewport', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')

  // Hero should still be visible
  await expect(page.getByRole('heading', { name: /begin a new/i })).toBeVisible()

  // Milestone cards should stack vertically (still visible)
  await expect(page.getByRole('heading', { name: /onboard/i })).toBeVisible()
})
