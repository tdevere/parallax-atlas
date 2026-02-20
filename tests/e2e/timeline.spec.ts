import { expect, test } from '@playwright/test'

test('selecting a timeline era enters focus mode and can return to full timeline', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /parallax atlas/i })).toBeVisible()
  await expect(page.getByText('Tip: Select an era on the timeline to enter focus mode and navigate nearby eras.')).toBeVisible()

  const timelineItem = page.getByTestId('timeline-canvas').locator('.vis-item-content', { hasText: 'Big Bang' }).first()
  await expect(timelineItem).toBeVisible()
  await timelineItem.click({ force: true })

  const backToFullTimelineButton = page.getByRole('button', { name: 'Back to Full Timeline' })
  if ((await backToFullTimelineButton.count()) === 0) {
    await timelineItem.click({ force: true })
  }

  await expect(backToFullTimelineButton).toBeVisible()
  await expect(page.getByText(/Breadcrumb: Full Timeline \/ /)).toBeVisible()
  await expect(page.getByText('Tip: Select an era on the timeline to enter focus mode and navigate nearby eras.')).toHaveCount(0)
  await expect(page.locator('aside li[aria-current="true"]')).toHaveCount(1)

  await backToFullTimelineButton.click()
  await expect(backToFullTimelineButton).toHaveCount(0)
})

test('persists progress and exports JSON', async ({ page }) => {
  await page.goto('/')

  const bigBangCard = page.locator('aside li', { hasText: 'Big Bang' })
  const completeTaskButton = page.getByRole('button', { name: 'Complete task for Big Bang' })

  await expect(bigBangCard).toBeVisible()
  await expect(bigBangCard.getByText('0%')).toBeVisible()

  await completeTaskButton.click()

  await expect(bigBangCard.getByText('25%')).toBeVisible()

  await page.reload()
  await expect(page.locator('aside li', { hasText: 'Big Bang' }).getByText('25%')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('parallax-atlas-progress.json')
})

test('today mission panel guides progress and can focus recommended era', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: "Today's Mission" })).toBeVisible()
  await expect(page.getByText('Started 0/19')).toBeVisible()
  const focusMissionButton = page.getByRole('button', { name: 'Focus Recommended Era' })
  if ((await focusMissionButton.count()) > 0) {
    await focusMissionButton.click()
    await expect(page.getByRole('button', { name: 'Back to Full Timeline' })).toBeVisible()
    await expect(page.getByText('Mission in Focus')).toBeVisible()
  }

  await page.getByRole('button', { name: 'Complete task for Big Bang' }).click()

  await expect(page.getByText('Started 1/19')).toBeVisible()
  await expect(page.locator('aside li', { hasText: 'Big Bang' }).getByText('25%')).toBeVisible()
})

test('mobile toggle shows and hides controls sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const showControls = page.getByRole('button', { name: 'Show Controls' })
  const sidebarHeading = page.getByRole('heading', { name: 'Knowledge Progress' })

  await expect(showControls).toBeVisible()
  await expect(sidebarHeading).not.toBeVisible()

  await showControls.click()
  await expect(page.getByRole('button', { name: 'Hide Controls' })).toBeVisible()
  await expect(sidebarHeading).toBeVisible()

  await page.getByRole('button', { name: 'Hide Controls' }).click()
  await expect(page.getByRole('button', { name: 'Show Controls' })).toBeVisible()
  await expect(sidebarHeading).not.toBeVisible()
})

test('desktop toggle collapses and expands sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/')

  const sidebarHeading = page.getByRole('heading', { name: 'Knowledge Progress' })

  await expect(sidebarHeading).toBeVisible()
  await expect(page.getByLabel('Collapse Sidebar')).toBeVisible()

  await page.getByLabel('Collapse Sidebar').click()
  await expect(page.getByLabel('Expand Sidebar')).toBeVisible()
  await expect(sidebarHeading).not.toBeVisible()

  await page.getByLabel('Expand Sidebar').click()
  await expect(page.getByLabel('Collapse Sidebar')).toBeVisible()
  await expect(sidebarHeading).toBeVisible()
})

test('sidebar focus button can drill into a specific era', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Focus Big Bang' }).click()

  await expect(page.getByRole('button', { name: 'Back to Full Timeline' })).toBeVisible()
  await expect(page.getByText('Breadcrumb: Full Timeline / Cosmology / Big Bang')).toBeVisible()
})

test('focus mode can continue to global recommended era', async ({ page }) => {
  await page.goto('/')

  const timelineItem = page.getByTestId('timeline-canvas').locator('.vis-item-content', { hasText: 'Age of Dinosaurs' }).first()
  await expect(timelineItem).toBeVisible()
  await timelineItem.click({ force: true })

  await expect(page.getByRole('button', { name: 'Go to Recommended Era' })).toBeVisible()
  await page.getByRole('button', { name: 'Go to Recommended Era' }).click()

  await expect(page.getByText('Breadcrumb: Full Timeline / Cosmology / Big Bang')).toBeVisible()
})

test('falls back safely when progress localStorage is malformed', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('knowledge-timeline-progress', '{malformed-json')
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /parallax atlas/i })).toBeVisible()
  await expect(page.locator('aside li', { hasText: 'Big Bang' }).getByText('0%')).toBeVisible()

  const isStorageRecoverable = await page.evaluate(() => {
    const saved = window.localStorage.getItem('knowledge-timeline-progress')
    if (!saved) return false
    try {
      JSON.parse(saved)
      return true
    } catch {
      return false
    }
  })

  expect(isStorageRecoverable).toBeTruthy()
})

test('no-context mode ignores prior persisted progress', async ({ page }) => {
  await page.addInitScript(() => {
    const seeded = {
      'big-bang': 88,
      'first-stars': 42,
    }
    window.localStorage.setItem('knowledge-timeline-progress', JSON.stringify(seeded))
  })

  await page.goto('/?viewerMode=no-context')

  await expect(page.locator('aside li', { hasText: 'Big Bang' }).getByText('0%')).toBeVisible()

  const storedValue = await page.evaluate(() => window.localStorage.getItem('knowledge-timeline-progress'))
  expect(storedValue).toContain('"big-bang":88')
})

test('loads provided subject pack from query', async ({ page }) => {
  await page.goto('/?viewerMode=provided-context&subjectPack=world-history-survey')

  await expect(page.locator('aside li', { hasText: 'Neolithic Revolution' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Agrarian Civilizations' })).toBeVisible()
  await expect(page.locator('aside li', { hasText: 'Big Bang' })).toHaveCount(0)
})

test('invalid subject pack query falls back with warning notice', async ({ page }) => {
  await page.goto('/?viewerMode=provided-context&subjectPack=missing-pack')

  const warningNotice = page.getByRole('alert').filter({ hasText: "Subject pack 'missing-pack' was not found" })
  await expect(warningNotice).toContainText('Warning')
  await expect(page.locator('aside li', { hasText: 'Big Bang' })).toBeVisible()
  await expect(page.locator('aside li', { hasText: 'Neolithic Revolution' })).toHaveCount(0)
})

test('runtime warning notice can be dismissed', async ({ page }) => {
  await page.goto('/?viewerMode=provided-context&subjectPack=missing-pack')

  const warningNotice = page.getByRole('alert').filter({ hasText: "Subject pack 'missing-pack' was not found" })
  await expect(warningNotice).toBeVisible()

  await page.getByRole('button', { name: 'Dismiss warning notice' }).click()
  await expect(warningNotice).toHaveCount(0)
})

test('invalid subject pack payload falls back with warning notice', async ({ page }) => {
  await page.route('**/subject-packs/world-history-survey.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'world-history-survey',
        name: 'World History Survey',
        context: {
          persistence: 'memory',
          eras: [
            {
              id: 'bad-era',
              content: 'Bad Era',
              start: 100,
              end: 200,
              group: 'Invalid',
            },
          ],
        },
      }),
    })
  })

  await page.goto('/?viewerMode=provided-context&subjectPack=world-history-survey')

  await expect(page.getByRole('alert')).toContainText("Subject pack 'World History Survey' is invalid")
  await expect(page.locator('aside li', { hasText: 'Big Bang' })).toBeVisible()
  await expect(page.locator('aside li', { hasText: 'Bad Era' })).toHaveCount(0)
})

test('context selector swaps from default to provided pack', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('aside li', { hasText: 'Big Bang' })).toBeVisible()

  await page.getByLabel('Context selector').selectOption('provided-context:world-history-survey')

  await expect(page).toHaveURL(/viewerMode=provided-context/)
  await expect(page).toHaveURL(/subjectPack=world-history-survey/)
  await expect(page.locator('aside li', { hasText: 'Neolithic Revolution' })).toBeVisible()
})

test('context selector can switch to quantum physics pack', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Context selector').selectOption('provided-context:quantum-physics-survey')

  await expect(page).toHaveURL(/subjectPack=quantum-physics-survey/)
  await expect(page.locator('aside li', { hasText: 'Planck Quantization' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Foundations' })).toBeVisible()
})

test('context selector journey updates active mode/pack summary across modes', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/')

  const summary = page.getByLabel('Active context summary')
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('Default · Built-in')

  await page.getByLabel('Context selector').selectOption('no-context')
  await expect(page).toHaveURL(/viewerMode=no-context/)
  await expect(page.getByRole('status')).toContainText('Switched to No Context · Built-in')
  await expect(page.getByLabel('Active context summary')).toContainText('No Context · Built-in')
  await expect(page.locator('aside li', { hasText: 'Big Bang' }).getByText('0%')).toBeVisible()

  await page.getByLabel('Context selector').selectOption('provided-context:quantum-physics-survey')
  await expect(page).toHaveURL(/viewerMode=provided-context/)
  await expect(page).toHaveURL(/subjectPack=quantum-physics-survey/)
  await expect(page.getByRole('status')).toContainText('Switched to Provided Context · Quantum Physics Survey')
  await expect(page.getByLabel('Active context summary')).toContainText('Provided Context · Quantum Physics Survey')
  await expect(page.locator('aside li', { hasText: 'Planck Quantization' })).toBeVisible()
})

test('bootstraps caller-provided injected context from window config', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as Window & { __TIMELINE_VIEWER_CONFIG__?: unknown }).__TIMELINE_VIEWER_CONFIG__ = {
      mode: 'provided-context',
      providedContext: {
        persistence: 'memory',
        selectedEraId: 'custom-era-2',
        eras: [
          {
            id: 'custom-era-1',
            content: 'Custom Era One',
            start: 900,
            end: 800,
            group: 'Custom Domain',
            description: 'First custom era for injected context testing.',
          },
          {
            id: 'custom-era-2',
            content: 'Custom Era Two',
            start: 700,
            end: 600,
            group: 'Custom Domain',
            description: 'Second custom era for injected context testing.',
          },
        ],
        progress: {
          'custom-era-1': 35,
          'custom-era-2': 65,
        },
      },
    }
  })

  await page.goto('/')

  await expect(page.locator('aside li', { hasText: 'Custom Era One' }).getByText('35%')).toBeVisible()
  await expect(page.locator('aside li', { hasText: 'Custom Era Two' }).getByText('65%')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to Full Timeline' })).toBeVisible()
  await expect(page.getByText('Breadcrumb: Full Timeline / Custom Domain / Custom Era Two')).toBeVisible()
  await expect(page.locator('aside li', { hasText: 'Big Bang' })).toHaveCount(0)
})

test('provided-context mode without subjectPack falls back with warning', async ({ page }) => {
  await page.goto('/?viewerMode=provided-context')

  await expect(page.getByRole('alert')).toContainText("requires a 'subjectPack' query value")
  await expect(page.locator('aside li', { hasText: 'Big Bang' })).toBeVisible()
})

test('empty subject-pack manifest warns and keeps built-in options', async ({ page }) => {
  await page.route('**/subject-packs/index.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ packs: [] }),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('alert')).toContainText('No subject packs are currently available')
  await expect(page.getByText('No subject packs available')).toBeVisible()
  await expect(page.getByLabel('Context selector').locator('option')).toHaveCount(2)
})

test('invalid manifest JSON warns and keeps built-in options', async ({ page }) => {
  await page.route('**/subject-packs/index.json', async (route) => {
    await route.fulfill({
      body: '{not-json',
      contentType: 'application/json',
    })
  })

  await page.goto('/')

  await expect(page.getByRole('alert')).toContainText('Subject-pack manifest is not valid JSON')
  await expect(page.getByText('No subject packs available')).toBeVisible()
  await expect(page.getByLabel('Context selector').locator('option')).toHaveCount(2)
})

test('malformed manifest entries are ignored while valid pack remains available', async ({ page }) => {
  await page.route('**/subject-packs/index.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        packs: [
          {
            id: 'world-history-survey',
            name: 'World History Survey',
            file: 'world-history-survey.json',
          },
          {
            id: 'broken-pack',
            name: 'Broken Pack',
          },
        ],
      }),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('alert')).toContainText('1 invalid subject-pack entry was ignored')
  await expect(page.getByLabel('Context selector').locator('option')).toHaveCount(3)
  await page.getByLabel('Context selector').selectOption('provided-context:world-history-survey')
  await expect(page).toHaveURL(/subjectPack=world-history-survey/)
  await expect(page.locator('aside li', { hasText: 'Neolithic Revolution' })).toBeVisible()
})

test('AI Genesis pack supports recursive drill-down, prerequisite sorting, and ghost jump-to-context', async ({ page }) => {
  await page.goto('/?viewerMode=provided-context&subjectPack=ai-genesis-history')

  await expect(page.locator('aside li', { hasText: 'Large Language Models' })).toBeVisible()

  await page.getByLabel('Subgraph sort mode').selectOption('prerequisite-order')
  const orderedLabels = await page.locator('aside li div > span.text-sm').allTextContents()
  expect(orderedLabels.indexOf('The Turing Machine')).toBeGreaterThanOrEqual(0)
  expect(orderedLabels.indexOf('The Perceptron')).toBeGreaterThanOrEqual(0)
  expect(orderedLabels.indexOf('The Turing Machine')).toBeLessThan(orderedLabels.indexOf('The Perceptron'))

  await page.getByRole('button', { name: 'Focus The 1950s' }).click()
  await expect(page.getByText('Breadcrumb: Full Timeline / AI Timeline / The 1950s')).toBeVisible()
  await expect(page.getByLabel('Drill context chip')).toContainText('Drill t0: The 1950s')
  await expect(page.getByLabel('Mission task workspace')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Complete micro task for The 1950s' })).toBeVisible()
  await page.getByRole('button', { name: 'Complete micro task for The 1950s' }).click()
  await expect(page.locator('aside li', { hasText: 'The 1950s' }).getByText('25%')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Drill into The Dartmouth Workshop' })).toBeVisible()
  await expect(page.locator('aside li', { hasText: '20th Century Foundations' })).toBeVisible()

  const calendarYearTick = page
    .getByTestId('timeline-canvas')
    .locator('.vis-time-axis .vis-text')
    .filter({ hasText: /^\d{3,4}$/ })
    .first()
  await expect(calendarYearTick).toBeVisible()

  await page.getByRole('button', { name: 'Focus Internet Era' }).click()
  await expect(page.getByLabel('Zoom band status')).toContainText('micro')

  const ghostFormalLogic = page.getByTestId('timeline-canvas').locator('.ghost-prerequisite-item .vis-item-content', { hasText: 'Formal Logic' }).first()
  await expect(ghostFormalLogic).toBeVisible()

  const formalLogicBreadcrumb = page.getByText('Breadcrumb: Full Timeline / Computation Track / Formal Logic')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await ghostFormalLogic.click({ force: true })
    if ((await formalLogicBreadcrumb.count()) > 0) break
    await page.waitForTimeout(150)
  }

  await expect(formalLogicBreadcrumb).toBeVisible()
  await expect(page.getByLabel('Drill context chip')).toContainText('Drill t0: Formal Logic')
  await expect(page.getByLabel('Zoom band status')).toContainText('historical')
})

test('ghost jump can return to origin focus and zoom context', async ({ page }) => {
  await page.goto('/?viewerMode=provided-context&subjectPack=ai-genesis-history')

  await page.getByRole('button', { name: 'Focus Internet Era' }).click()
  await expect(page.getByText('Breadcrumb: Full Timeline / AI Timeline / Internet Era')).toBeVisible()

  await page.waitForTimeout(350)
  const originZoomStatus = (await page.getByLabel('Zoom band status').innerText()).trim()

  const ghostFormalLogic = page.getByTestId('timeline-canvas').locator('.ghost-prerequisite-item .vis-item-content', { hasText: 'Formal Logic' }).first()
  await expect(ghostFormalLogic).toBeVisible()

  const returnChip = page.getByRole('button', { name: /Return to / })
  const formalLogicBreadcrumb = page.getByText('Breadcrumb: Full Timeline / Computation Track / Formal Logic')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await ghostFormalLogic.click({ force: true })
    if ((await formalLogicBreadcrumb.count()) > 0) break
    await page.waitForTimeout(150)
  }

  await expect(formalLogicBreadcrumb).toBeVisible()
  await expect(returnChip).toBeVisible()
  await expect(returnChip).toHaveText('↩ Internet Era')
  await expect(page.getByLabel('Drill context chip')).toContainText('Drill t0: Formal Logic')

  await returnChip.click()
  await expect(page.getByText('Breadcrumb: Full Timeline / AI Timeline / Internet Era')).toBeVisible()
  await expect(page.getByLabel('Drill context chip')).toContainText('Drill t0: Internet Era')
  await expect(page.getByLabel('Zoom band status')).toHaveText(originZoomStatus)
})

test('first task completion triggers milestone celebration', async ({ page }) => {
  await page.goto('/')

  // Ensure no celebration is visible initially
  await expect(page.getByText('Journey Begun!')).toHaveCount(0)

  // Complete the first task — should trigger 'first-started' milestone
  await page.getByRole('button', { name: 'Complete task for Big Bang' }).click()

  // Celebration overlay should appear
  await expect(page.getByText('Journey Begun!')).toBeVisible()
  await expect(page.getByText(/first step/)).toBeVisible()

  // Should auto-dismiss or be clickable to dismiss
  await page.getByText('Journey Begun!').click()
  await expect(page.getByText('Journey Begun!')).toHaveCount(0)
})

test('streak badge appears in coach panel on visit', async ({ page }) => {
  // Seed a streak so the badge shows immediately
  await page.addInitScript(() => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    window.localStorage.setItem('parallax-atlas-streak', JSON.stringify({
      currentStreak: 3,
      longestStreak: 5,
      lastVisitDate: yesterday,
      startDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    }))
  })

  await page.goto('/')

  // recordVisit() will bump streak to 4 since last visit was yesterday
  // The streak badge should be visible in the stats bar
  const streakBadge = page.locator('text=/🔥 \\d+d/')
  await expect(streakBadge).toBeVisible()
})

test('share button triggers progress image download', async ({ page }) => {
  await page.goto('/')

  const shareButton = page.getByRole('button', { name: '📷 Share' })
  await expect(shareButton).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await shareButton.click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^parallax-atlas-progress-\d+\.png$/)
})

test('civ map auto-enables as teaser on first run with geographic eras', async ({ page }) => {
  // Clear any stored civ map preference so auto-detection kicks in
  await page.addInitScript(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('parallax-atlas-civ-map')) window.localStorage.removeItem(key)
    }
  })

  // Built-in eras have geoCenter fields, so map should auto-enable
  await page.goto('/')

  // The civ map toggle should show as active (amber styling = on)
  const civMapButton = page.getByLabel('Hide civilization map')
  await expect(civMapButton).toBeVisible()

  // The SVG map should be rendered in the timeline area
  await expect(page.locator('svg[aria-label="Civilization progress map"]')).toBeVisible()
})

test('civ map does not auto-enable for packs without geographic data', async ({ page }) => {
  // Clear stored preference
  await page.addInitScript(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('parallax-atlas-civ-map')) window.localStorage.removeItem(key)
    }
  })

  // Intercept quantum physics pack to strip all geoCenter fields
  await page.route('**/subject-packs/quantum-physics-survey.json', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    for (const era of body.context.eras) {
      delete era.geoCenter
    }
    await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json' })
  })

  await page.goto('/?viewerMode=provided-context&subjectPack=quantum-physics-survey')

  // The civ map toggle should show as inactive
  const civMapButton = page.getByLabel('Show civilization map')
  await expect(civMapButton).toBeVisible()

  // The SVG map should NOT be rendered
  await expect(page.locator('svg[aria-label="Civilization progress map"]')).toHaveCount(0)
})

// ── Tier 3: Progressive disclosure ──────────────────────────────────
test('advanced controls are hidden for new users and revealed after engagement', async ({ page }) => {
  // Clear all progress so user starts fresh
  await page.addInitScript(() => {
    window.localStorage.clear()
  })

  await page.goto('/')

  // New user: sort mode select and ghost toggle should NOT be in the DOM
  await expect(page.getByLabel('Subgraph sort mode')).toHaveCount(0)
  await expect(page.locator('#ghost-layer-toggle')).toHaveCount(0)

  // Engagement level indicator is hidden on welcome screen (showWelcome=true)
  await expect(page.locator('[aria-label="Engagement level"]')).toHaveCount(0)
})

test('advanced controls become visible when engagement threshold is met', async ({ page }) => {
  // Pre-seed localStorage so user appears as intermediate (1 mastered era → intermediate)
  await page.addInitScript(() => {
    const progress = {
      'big-bang': 100,
      'first-stars': 50,
      'reionization': 50,
      'first-life': 25,
    }
    window.localStorage.setItem('knowledge-timeline-progress', JSON.stringify(progress))
  })

  await page.goto('/')

  // With 1 mastered era, engagement should be intermediate or higher
  const engagementLabel = page.locator('[aria-label="Engagement level"]')
  await expect(engagementLabel).toBeVisible()
  const text = await engagementLabel.textContent()
  expect(text).toMatch(/intermediate|advanced/)

  // Sort mode dropdown should now be visible
  await expect(page.getByLabel('Subgraph sort mode')).toBeVisible()
})

// ── Tier 3: Daily micro-goals ───────────────────────────────────────
test('daily micro-goals appear for users with in-progress eras', async ({ page }) => {
  // Pre-seed some progress using correct storage key
  await page.addInitScript(() => {
    const progress = {
      'big-bang': 25,
      'solar-system': 0,
      'first-life': 75,
    }
    window.localStorage.setItem('knowledge-timeline-progress', JSON.stringify(progress))
  })

  await page.goto('/')

  // Micro-goals section should be visible in coach panel
  const goalsSection = page.locator('[aria-label="Daily micro-goals"]')
  await expect(goalsSection).toBeVisible()

  // Should show at least one goal (continue Big Bang or continue First Life)
  const goalButtons = await goalsSection.locator('button').count()
  expect(goalButtons).toBeGreaterThanOrEqual(1)

  // Should show a time estimate
  await expect(goalsSection.getByText(/minutes/)).toBeVisible()
})

test('micro-goals are not shown on welcome screen', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })

  await page.goto('/')

  // Welcome state: micro-goals should be hidden
  await expect(page.locator('[aria-label="Daily micro-goals"]')).toHaveCount(0)
})

// ── Tier 3: Study-partner invite / share ────────────────────────────
test('share invite section appears after reaching mastery threshold', async ({ page }) => {
  // Pre-seed a mastered era (mastered=1 → intermediate → showShareInvite=true)
  await page.addInitScript(() => {
    const progress = {
      'big-bang': 100,
      'first-stars': 50,
      'first-life': 50,
    }
    window.localStorage.setItem('knowledge-timeline-progress', JSON.stringify(progress))
  })

  await page.goto('/')

  // Share section should be visible
  const shareSection = page.locator('[aria-label="Share and invite"]')
  await expect(shareSection).toBeVisible()

  // Should mention mastery achievement
  await expect(shareSection.getByText(/mastered/i)).toBeVisible()

  // Copy link and snapshot buttons should be present
  await expect(shareSection.getByLabel('Copy pack link to clipboard')).toBeVisible()
  await expect(shareSection.getByLabel('Export progress as shareable image')).toBeVisible()
})

test('share invite section is hidden for new users', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })

  await page.goto('/')

  // Share section should NOT be present for new users
  await expect(page.locator('[aria-label="Share and invite"]')).toHaveCount(0)
})
