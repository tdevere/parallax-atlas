import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth'
import { AzureMapPanel } from './components/AzureMapPanel'
import { FeedbackModal } from './components/FeedbackModal'
import { JourneyCreator } from './components/JourneyCreator'
import { LessonLauncher } from './components/LessonLauncher'
import type { MilestoneType } from './components/MilestoneCelebration'
import { MilestoneCelebration } from './components/MilestoneCelebration'
import { NotebookPanel } from './components/NotebookPanel'
import { ProgressSidebar } from './components/ProgressSidebar'
import { SourcePanel } from './components/SourcePanel'
import { Timeline } from './components/Timeline'
import type { Era } from './data/timeline-data'
import { SAMPLE_JOURNEY_ERAS, SAMPLE_JOURNEY_NAME, SAMPLE_JOURNEY_PROGRESS } from './data/sample-journey'
import { useKnowledgeTree } from './knowledge-tree'
import { buildLearnerProfile } from './lesson/learner-profile'
import type { LessonPlan } from './lesson/lesson-types'
import { saveLessonPlan } from './lesson/lesson-types'
import type { NotebookEntry } from './notebook/notebook-types'
import { NotebookStore, generateEntryId } from './notebook/notebook-store'
import type { Source } from './sources/source-types'
import { exportProgressImage } from './progress-image-export'
import { isStreakMilestone, recordVisit, type StreakInfo } from './streak-tracker'
import { resolveViewerContext } from './viewer/context'
import { LocalStorageProgressStore, MemoryProgressStore, NoopProgressStore, RemoteProgressStore, type ProgressStore } from './viewer/progress-store'
import type { GeoCenter, GeoEra, GhostLayerMode, MapSyncMode, RuntimeNotice, SubjectPackEntry, SubgraphSortMode, TimelineViewerConfig, ViewerMode, ZoomBand } from './viewer/types'
import { viewportSync } from './viewer/viewport-sync'

interface AppProps {
  config?: TimelineViewerConfig
  availablePacks?: SubjectPackEntry[]
  notices?: RuntimeNotice[]
  bingMapsApiKey?: string
  onSwitchContext?: (mode: ViewerMode, subjectPackId?: string) => void
}

interface ReturnTarget {
  eraId: string
  zoomBand: ZoomBand
  zoomLevel: number
}

const normalizeProgress = (activeEras: Era[], fallback: Record<string, number>, current?: Record<string, number> | null): Record<string, number> =>
  activeEras.reduce<Record<string, number>>((accumulator, era) => {
    accumulator[era.id] = current?.[era.id] ?? fallback[era.id] ?? 0
    return accumulator
  }, {})

const contextControlValue = (mode: ViewerMode | undefined, contextPackId?: string): string => {
  if (mode === 'no-context') return 'no-context'
  if (mode === 'provided-context' && contextPackId) return `provided-context:${contextPackId}`
  return 'default-context'
}

const CONTEXT_FLASH_STORAGE_KEY = 'knowledge-timeline-context-flash'
const MASTERY_INTERACTION_STORAGE_KEY = 'knowledge-timeline-mastery-interactions'
const MISSION_COMPLETION_STEP = 25

const momentumMessageForAverage = (averageProgress: number): string => {
  if (averageProgress >= 85) return 'Outstanding momentum. You are in mastery territory.'
  if (averageProgress >= 60) return 'Strong pace. Keep connecting ideas across eras.'
  if (averageProgress >= 35) return 'Great traction. Stay consistent for compounding gains.'
  if (averageProgress > 0) return 'You have started the journey. Keep building your streak.'
  return 'Pick one era and make a first move today.'
}

const missionActionForProgress = (value: number): string => {
  if (value >= 100) return 'Teach this era to someone else using three key points from memory.'
  if (value >= 75) return 'Do a closed-notes recall: write what happened and why it mattered.'
  if (value >= 50) return 'Connect this era to one earlier and one later era on the timeline.'
  if (value >= 25) return 'Summarize the core idea in 4 bullet points and one open question.'
  if (value > 0) return 'Review the description, then explain it out loud in under 60 seconds.'
  return 'Read the era description and capture one surprising insight.'
}

const zoomBandFromEraSpan = (era: Era): ZoomBand => {
  const span = Math.max(1, era.start - era.end)
  if (span <= 120) return 'micro'
  if (span <= 900) return 'modern'
  if (span <= 8000) return 'historical'
  if (span <= 5000000) return 'macro'
  return 'cosmic'
}

const packIcon = (id: string): string => {
  if (id.includes('ai') || id.includes('genesis')) return '🤖'
  if (id.includes('quantum') || id.includes('physics')) return '🔬'
  if (id.includes('history')) return '🌍'
  return '📚'
}

// ── Engagement level for progressive disclosure ───────────────────
type EngagementLevel = 'new' | 'exploring' | 'intermediate' | 'advanced'

const computeEngagementLevel = (
  started: number,
  mastered: number,
  hasFocused: boolean,
  streakDays: number,
): EngagementLevel => {
  // Advanced: 3+ mastered OR 60+ day streak
  if (mastered >= 3 || streakDays >= 60) return 'advanced'
  // Intermediate: any mastered era, OR 3+ started and has focused, OR 7+ day streak
  if (mastered >= 1 || (started >= 3 && hasFocused) || streakDays >= 7) return 'intermediate'
  // Exploring: started at least 1 era OR entered focus mode
  if (started >= 1 || hasFocused) return 'exploring'
  return 'new'
}

// ── Daily micro-goal generator ─────────────────────────────────
interface MicroGoal {
  label: string
  eraId: string
  eraName: string
  type: 'review-due' | 'continue' | 'start-new'
  minuteEstimate: number
}

const buildMicroGoals = (
  eras: Era[],
  progress: Record<string, number>,
  reviewDue: Record<string, boolean>,
  maxGoals: number = 3,
): MicroGoal[] => {
  const goals: MicroGoal[] = []

  // Priority 1: Review-due eras (spaced repetition)
  for (const era of eras) {
    if (goals.length >= maxGoals) break
    const p = progress[era.id] ?? 0
    if (p > 0 && reviewDue[era.id]) {
      goals.push({
        label: `Review ${era.content} — no interaction in 3+ days`,
        eraId: era.id,
        eraName: era.content,
        type: 'review-due',
        minuteEstimate: 5,
      })
    }
  }

  // Priority 2: Continue in-progress eras (lowest progress first)
  const inProgress = eras
    .filter((e) => (progress[e.id] ?? 0) > 0 && (progress[e.id] ?? 0) < 100 && !reviewDue[e.id])
    .sort((a, b) => (progress[a.id] ?? 0) - (progress[b.id] ?? 0))
  for (const era of inProgress) {
    if (goals.length >= maxGoals) break
    goals.push({
      label: `Continue ${era.content} — currently ${progress[era.id]}%`,
      eraId: era.id,
      eraName: era.content,
      type: 'continue',
      minuteEstimate: 10,
    })
  }

  // Priority 3: Start a new era
  const unstarted = eras.filter((e) => (progress[e.id] ?? 0) === 0)
  for (const era of unstarted) {
    if (goals.length >= maxGoals) break
    goals.push({
      label: `Start ${era.content} — brand new territory`,
      eraId: era.id,
      eraName: era.content,
      type: 'start-new',
      minuteEstimate: 10,
    })
  }

  return goals
}

function App({ config, availablePacks = [], notices = [], bingMapsApiKey, onSwitchContext }: AppProps) {
  const auth = useAuth()
  const resolvedContext = useMemo(() => resolveViewerContext(config), [config])
  const currentMode = config?.mode ?? 'default-context'
  const currentPackId = new URLSearchParams(window.location.search).get('subjectPack') ?? undefined

  // Spatial / map state
  const [showMap, setShowMap] = useState(false)

  const progressPackId = currentPackId ?? 'built-in'

  const progressStore = useMemo<ProgressStore>(() => {
    // When authenticated, use remote-backed store with localStorage fallback
    if (auth.isAuthenticated && resolvedContext.persistence === 'local') {
      return new RemoteProgressStore(progressPackId, resolvedContext.storageKey)
    }
    if (resolvedContext.persistence === 'local') return new LocalStorageProgressStore(resolvedContext.storageKey)
    if (resolvedContext.persistence === 'memory') return new MemoryProgressStore()
    return new NoopProgressStore()
  }, [resolvedContext.persistence, resolvedContext.storageKey, auth.isAuthenticated, progressPackId])

  const [progress, setProgress] = useState<Record<string, number>>(() =>
    normalizeProgress(resolvedContext.eras, resolvedContext.initialProgress, progressStore.load()),
  )

  // Hydrate progress from remote API when authenticated
  useEffect(() => {
    if (progressStore instanceof RemoteProgressStore) {
      void progressStore.hydrate().then((remoteProgress) => {
        if (remoteProgress) {
          setProgress(normalizeProgress(resolvedContext.eras, resolvedContext.initialProgress, remoteProgress))
        }
      })
    }
  }, [progressStore, resolvedContext.eras, resolvedContext.initialProgress])

  const [selectedEra, setSelectedEra] = useState<Era | null>(() => {
    if (!resolvedContext.initialSelectedEraId) return null
    return resolvedContext.eras.find((era) => era.id === resolvedContext.initialSelectedEraId) ?? null
  })
  const [lastFocusedEraId, setLastFocusedEraId] = useState<string | null>(resolvedContext.initialSelectedEraId)
  const [hasSeenFocusOnboarding, setHasSeenFocusOnboarding] = useState<boolean>(() => Boolean(resolvedContext.initialSelectedEraId))
  const [sidebarOpen, setSidebarOpen] = useState(resolvedContext.initialSidebarOpen)
  const [sidebarCollapsedDesktop, setSidebarCollapsedDesktop] = useState(false)
  const [coachCollapsed, setCoachCollapsed] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(false)
  const [showNotebook, setShowNotebook] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const civMapStorageKey = `parallax-atlas-civ-map:${progressPackId}`
  const [showCivMap, setShowCivMap] = useState(() => {
    const stored = window.localStorage.getItem(civMapStorageKey)
    if (stored !== null) return stored === 'true'
    // Default on when the active eras contain geographic data (teaser for first run)
    return resolvedContext.eras.some((era) => era.geoCenter != null)
  })
  const notebookStore = useMemo(() => new NotebookStore(), [])
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>(() => notebookStore.load())
  const [showLessonLauncher, setShowLessonLauncher] = useState(false)
  const [showJourneyCreator, setShowJourneyCreator] = useState(false)
  const [activeLesson, setActiveLesson] = useState<LessonPlan | null>(null)
  const [generatedEras, setGeneratedEras] = useState<Era[] | null>(null)
  const [isSampleJourney, setIsSampleJourney] = useState(false)

  /** Active eras — generated lesson eras take priority when a lesson is loaded */
  const activeEras = generatedEras ?? resolvedContext.eras
  const activePackId = activeLesson?.pack.id ?? currentPackId ?? 'built-in'

  // Knowledge tree engine — provides prerequisite-aware recommendations and analytics
  const { recommendations: treeRecommendations, topRecommendation: treeTopRec, analytics: treeAnalytics } = useKnowledgeTree({
    packId: activePackId,
    eras: activeEras,
    progress,
  })

  const initialMapCenter = useMemo<GeoCenter>(() => {
    const geoEras = activeEras.filter((e) => (e as GeoEra).geoCenter)
    if (geoEras.length === 0) return { latitude: 40, longitude: -95, zoom: 4 }
    const lats = geoEras.map((e) => (e as GeoEra).geoCenter!.latitude)
    const lngs = geoEras.map((e) => (e as GeoEra).geoCenter!.longitude)
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      zoom: 3,
    }
  }, [activeEras])
  const [mapCenter, setMapCenter] = useState<GeoCenter>(initialMapCenter)
  const [mapSyncMode, setMapSyncMode] = useState<MapSyncMode>('timeline-leads')
  const [visibleNotices, setVisibleNotices] = useState<RuntimeNotice[]>(notices)
  const [contextSwitchFlash, setContextSwitchFlash] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SubgraphSortMode>('chronological')
  const [ghostLayerMode, setGhostLayerMode] = useState<GhostLayerMode>('prerequisites')
  const [zoomBand, setZoomBand] = useState<ZoomBand>('cosmic')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [returnTarget, setReturnTarget] = useState<ReturnTarget | null>(null)
  const [lastInteractedAt, setLastInteractedAt] = useState<Record<string, string>>(() => {
    const stored = window.localStorage.getItem(MASTERY_INTERACTION_STORAGE_KEY)
    if (!stored) return {}

    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>
      return Object.entries(parsed).reduce<Record<string, string>>((accumulator, [key, value]) => {
        if (typeof value === 'string') accumulator[key] = value
        return accumulator
      }, {})
    } catch {
      return {}
    }
  })
  const [reviewDueByEra, setReviewDueByEra] = useState<Record<string, boolean>>({})

  // ── Milestone celebration state ──────────────────────────────
  const [activeMilestone, setActiveMilestone] = useState<MilestoneType | null>(null)
  const [milestoneEraName, setMilestoneEraName] = useState<string | undefined>()
  const [milestoneStreakDays, setMilestoneStreakDays] = useState<number | undefined>()
  const [milestoneKey, setMilestoneKey] = useState(0)
  const [streakInfo, setStreakInfo] = useState<StreakInfo>(() => recordVisit())

  const triggerMilestone = useCallback((type: MilestoneType, eraName?: string, streakDays?: number) => {
    setActiveMilestone(type)
    setMilestoneEraName(eraName)
    setMilestoneStreakDays(streakDays)
    setMilestoneKey((k) => k + 1)
  }, [])

  const dismissMilestone = useCallback(() => {
    setActiveMilestone(null)
    setMilestoneEraName(undefined)
    setMilestoneStreakDays(undefined)
  }, [])
  useEffect(() => {
    setVisibleNotices(notices)
  }, [notices])

  useEffect(() => {
    window.localStorage.setItem(civMapStorageKey, String(showCivMap))
  }, [showCivMap, civMapStorageKey])

  useEffect(() => {
    // Don't persist sample journey progress to storage
    if (isSampleJourney) return
    if (Object.keys(progress).length > 0) {
      progressStore.save(progress)
    }
  }, [progress, progressStore, isSampleJourney])

  // ── Auto-load sample journey for zero-progress users ─────────
  useEffect(() => {
    // Skip if user has already dismissed the sample, or has active lesson/eras
    const dismissed = window.localStorage.getItem('parallax-atlas-sample-dismissed')
    if (dismissed === 'true') return
    if (generatedEras || activeLesson) return

    // Check if user has any real progress on built-in eras (from storage)
    const storedProgress = progressStore.load()
    const hasRealProgress = resolvedContext.eras.some((era) => (storedProgress?.[era.id] ?? 0) > 0)
    if (hasRealProgress) return

    setGeneratedEras(SAMPLE_JOURNEY_ERAS)
    setProgress({ ...SAMPLE_JOURNEY_PROGRESS })
    setIsSampleJourney(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally mount-only
  }, [])

  useEffect(() => {
    window.localStorage.setItem(MASTERY_INTERACTION_STORAGE_KEY, JSON.stringify(lastInteractedAt))
  }, [lastInteractedAt])

  useEffect(() => {
    const now = Date.now()
    const nextReviewState = Object.entries(lastInteractedAt).reduce<Record<string, boolean>>((accumulator, [eraId, timestamp]) => {
      const ageMs = now - new Date(timestamp).getTime()
      accumulator[eraId] = ageMs > 3 * 24 * 60 * 60 * 1000
      return accumulator
    }, {})

    setReviewDueByEra(nextReviewState)
  }, [lastInteractedAt])

  useEffect(() => {
    const flash = window.sessionStorage.getItem(CONTEXT_FLASH_STORAGE_KEY)
    if (!flash) return

    setContextSwitchFlash(flash)
    window.sessionStorage.removeItem(CONTEXT_FLASH_STORAGE_KEY)

    const timeoutId = window.setTimeout(() => setContextSwitchFlash(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [])

  // Subscribe to viewport sync updates from map interactions
  useEffect(() => {
    const unsubscribe = viewportSync.subscribe((state) => {
      setMapCenter(state.mapCenter)
    })
    return unsubscribe
  }, [])

  // Sync map sync mode to controller
  useEffect(() => {
    viewportSync.setSyncMode(mapSyncMode)
  }, [mapSyncMode])

  const handleMissionComplete = (eraId: string) => {
    const currentValue = progress[eraId] ?? 0
    const nextValue = Math.min(100, currentValue + MISSION_COMPLETION_STEP)

    // Snapshot pre-change state for milestone detection
    const wasAnyStarted = activeEras.some((era) => (progress[era.id] ?? 0) > 0)
    const wasMastered = currentValue >= 100

    setProgress((current) => ({ ...current, [eraId]: nextValue }))

    setLastInteractedAt((current) => ({
      ...current,
      [eraId]: new Date().toISOString(),
    }))

    // Record streak visit on first meaningful interaction
    const updatedStreak = recordVisit()
    setStreakInfo(updatedStreak)

    // ── Milestone detection ────────────────────────────────────
    const era = activeEras.find((e) => e.id === eraId)

    // First era started (was 0%, now > 0%, and nothing was started before)
    if (!wasAnyStarted && currentValue === 0 && nextValue > 0) {
      triggerMilestone('first-started')
    }
    // Era just hit 100%
    else if (!wasMastered && nextValue >= 100 && era) {
      // Check if ALL eras are now mastered
      const allMasteredAfter = activeEras.every((e) =>
        e.id === eraId ? nextValue >= 100 : (progress[e.id] ?? 0) >= 100,
      )
      if (allMasteredAfter) {
        triggerMilestone('all-mastered')
      } else {
        triggerMilestone('era-mastered', era.content)
      }
    }
    // Streak milestone (only if no mastery milestone was already triggered)
    else if (updatedStreak.isNewDayVisit && isStreakMilestone(updatedStreak.currentStreak)) {
      triggerMilestone('streak-achieved', undefined, updatedStreak.currentStreak)
    }

    // Log mission completion to notebook
    if (era) {
      logNotebookEntry({
        eraId: era.id,
        eraContent: era.content,
        eraGroup: era.group,
        action: 'completed-mission',
        progressAtTime: nextValue,
      })
    }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'parallax-atlas-progress.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleExportImage = () => {
    exportProgressImage(activeEras, progress, activePackName, streakInfo.currentStreak)
  }

  const logNotebookEntry = useCallback(
    (entry: Omit<NotebookEntry, 'id' | 'timestamp'>) => {
      const full: NotebookEntry = { ...entry, id: generateEntryId(), timestamp: new Date().toISOString() }
      const updated = notebookStore.append(full)
      setNotebookEntries(updated)
    },
    [notebookStore],
  )

  const handleLogSource = useCallback(
    (source: Source) => {
      if (!selectedEra) return
      logNotebookEntry({
        eraId: selectedEra.id,
        eraContent: selectedEra.content,
        eraGroup: selectedEra.group,
        sourceId: source.id,
        sourceTitle: source.title,
        sourceUrl: source.url,
        sourceFormat: source.format,
        action: 'logged-source',
        progressAtTime: progress[selectedEra.id] ?? 0,
      })
    },
    [logNotebookEntry, progress, selectedEra],
  )

  const handleClearNotebook = useCallback(() => {
    notebookStore.clear()
    setNotebookEntries([])
  }, [notebookStore])

  /** Soft context switch — inject a generated lesson without page reload */
  const handleLessonReady = useCallback((lesson: LessonPlan) => {
    // Save lesson for resumability
    saveLessonPlan(lesson)

    const packEras = lesson.pack.context.eras ?? []
    const packProgress = lesson.pack.context.eras?.reduce<Record<string, number>>((acc, era) => {
      acc[era.id] = lesson.pack.context.progress?.[era.id] ?? 0
      return acc
    }, {}) ?? {}

    // Soft-swap: update eras, progress, selection, and clear focus state
    setGeneratedEras(packEras)
    setProgress(packProgress)
    setSelectedEra(null)
    setActiveLesson(lesson)
    setShowLessonLauncher(false)
    setShowSourcePanel(false)
    setReturnTarget(null)

    // Flash notice
    setContextSwitchFlash(`Loaded lesson: ${lesson.title} (${lesson.level})`)
    const timeoutId = window.setTimeout(() => setContextSwitchFlash(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [])

  /** Exit generated lesson and return to previous context */
  const handleExitLesson = useCallback(() => {
    setGeneratedEras(null)
    setActiveLesson(null)
    setIsSampleJourney(false)
    setSelectedEra(null)
    setProgress(normalizeProgress(resolvedContext.eras, resolvedContext.initialProgress, progressStore.load()))
    setContextSwitchFlash('Returned to previous context')
    const timeoutId = window.setTimeout(() => setContextSwitchFlash(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [progressStore, resolvedContext.eras, resolvedContext.initialProgress])

  /** Exit the sample journey and return to built-in eras */
  const handleExitSample = useCallback(() => {
    window.localStorage.setItem('parallax-atlas-sample-dismissed', 'true')
    setGeneratedEras(null)
    setIsSampleJourney(false)
    setSelectedEra(null)
    setProgress(normalizeProgress(resolvedContext.eras, resolvedContext.initialProgress, progressStore.load()))
    setContextSwitchFlash('Returned to built-in timeline')
    const timeoutId = window.setTimeout(() => setContextSwitchFlash(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [progressStore, resolvedContext.eras, resolvedContext.initialProgress])

  /** Soft context switch — load a server-generated journey pack */
  const handleJourneyReady = useCallback((pack: import('./viewer/types').SubjectPackPayload, meta: { journeyId: string; generatorModel: string }) => {
    const packEras = pack.context.eras ?? []
    const packProgress = packEras.reduce<Record<string, number>>((acc, era) => {
      acc[era.id] = pack.context.progress?.[era.id] ?? 0
      return acc
    }, {})

    setGeneratedEras(packEras)
    setProgress(packProgress)
    setSelectedEra(null)
    setActiveLesson(null)
    setIsSampleJourney(false)
    setShowJourneyCreator(false)
    setShowSourcePanel(false)
    setReturnTarget(null)

    setContextSwitchFlash(`Generated journey: ${pack.name} (${meta.generatorModel})`)
    const timeoutId = window.setTimeout(() => setContextSwitchFlash(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [])

  /** Build learner profile from current notebook + progress */
  const learnerProfile = useMemo(
    () => buildLearnerProfile(notebookEntries, progress),
    [notebookEntries, progress],
  )

  const handleAddInsight = useCallback(
    (entry: Omit<NotebookEntry, 'id' | 'timestamp'>) => {
      logNotebookEntry(entry)
    },
    [logNotebookEntry],
  )

  const groupEras = useMemo(() => {
    if (!selectedEra) return []
    return activeEras
      .filter((era) => era.group === selectedEra.group)
      .sort((left, right) => right.start - left.start)
  }, [activeEras, selectedEra])

  const focusIndex = useMemo(() => {
    if (!selectedEra) return -1
    return groupEras.findIndex((era) => era.id === selectedEra.id)
  }, [groupEras, selectedEra])

  const hasPreviousFocusedEra = focusIndex > 0
  const hasNextFocusedEra = focusIndex >= 0 && focusIndex < groupEras.length - 1

  const focusEdgeMessage = useMemo(() => {
    if (!selectedEra || focusIndex < 0) return ''
    if (!hasPreviousFocusedEra && !hasNextFocusedEra) return 'Only one era exists in this focused group.'
    if (!hasPreviousFocusedEra) return 'You are at the start of this focused group.'
    if (!hasNextFocusedEra) return 'You are at the end of this focused group.'
    return ''
  }, [focusIndex, hasNextFocusedEra, hasPreviousFocusedEra, selectedEra])

  const timelineEras = useMemo(() => {
    if (!selectedEra) return activeEras
    return groupEras
  }, [groupEras, activeEras, selectedEra])

  const selectedContextControl = contextControlValue(currentMode, currentPackId)
  const activePackName =
    currentMode === 'provided-context' && currentPackId ? availablePacks.find((pack) => pack.id === currentPackId)?.name ?? currentPackId : 'Built-in'
  const activeModeLabel =
    currentMode === 'default-context' ? 'Default' : currentMode === 'no-context' ? 'No Context' : 'Provided Context'

  const momentumStats = useMemo(() => {
    const values = activeEras.map((era) => progress[era.id] ?? 0)
    const total = values.length
    const started = values.filter((value) => value > 0).length
    const strong = values.filter((value) => value >= 50).length
    const mastered = values.filter((value) => value >= 100).length
    const average = total === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / total)

    return {
      average,
      mastered,
      message: momentumMessageForAverage(average),
      started,
      strong,
      total,
    }
  }, [progress, activeEras])

  const recommendedEra = useMemo(() => {
    // Use tree-powered recommendation if available
    if (treeTopRec) {
      const treeMatch = activeEras.find((era) => era.id === treeTopRec.nodeId)
      if (treeMatch) return treeMatch
    }

    // Fallback: simple lowest-progress sort
    const candidates = activeEras.filter((era) => (progress[era.id] ?? 0) < 100)
    if (candidates.length === 0) return null

    return [...candidates].sort((left, right) => {
      const leftProgress = progress[left.id] ?? 0
      const rightProgress = progress[right.id] ?? 0
      if (leftProgress !== rightProgress) return leftProgress - rightProgress
      return right.start - left.start
    })[0]
  }, [progress, activeEras, treeTopRec])

  const lastFocusedEra = useMemo(() => {
    if (!lastFocusedEraId) return null
    return activeEras.find((era) => era.id === lastFocusedEraId) ?? null
  }, [lastFocusedEraId, activeEras])

  const missionTargetEra = selectedEra ?? recommendedEra ?? activeEras[0] ?? null
  const missionTargetProgress = missionTargetEra ? progress[missionTargetEra.id] ?? 0 : 0
  const missionNextAction = missionActionForProgress(missionTargetProgress)
  const missionHeadline = selectedEra
    ? `You're currently focused on ${selectedEra.content}.`
    : missionTargetEra
      ? treeTopRec
        ? treeTopRec.reason
        : `Recommended now: ${missionTargetEra.content}.`
      : 'No eras available in this context.'

  const drillContextLabel = selectedEra ? `Drill t0: ${selectedEra.content}` : null

  const showWelcome = momentumStats.started === 0 && !selectedEra && !activeLesson && !isSampleJourney

  // ── Progressive disclosure: engagement level ──────────────────
  const engagementLevel = useMemo<EngagementLevel>(
    () => computeEngagementLevel(momentumStats.started, momentumStats.mastered, hasSeenFocusOnboarding, streakInfo.currentStreak),
    [momentumStats.started, momentumStats.mastered, hasSeenFocusOnboarding, streakInfo.currentStreak],
  )
  const showAdvancedControls = engagementLevel === 'intermediate' || engagementLevel === 'advanced' || currentMode === 'provided-context'

  // ── Daily micro-goals ────────────────────────────────────────
  const microGoals = useMemo(
    () => buildMicroGoals(activeEras, progress, reviewDueByEra),
    [activeEras, progress, reviewDueByEra],
  )
  const reviewDueCount = useMemo(
    () => Object.values(reviewDueByEra).filter(Boolean).length,
    [reviewDueByEra],
  )

  // ── Share/invite thresholds ──────────────────────────────────
  const showShareInvite = engagementLevel === 'intermediate' || engagementLevel === 'advanced'

  const queueContextSwitchFlash = (nextMode: ViewerMode, nextPackId?: string) => {
    const nextPackName =
      nextMode === 'provided-context' && nextPackId
        ? availablePacks.find((pack) => pack.id === nextPackId)?.name ?? nextPackId
        : 'Built-in'

    const nextModeLabel = nextMode === 'default-context' ? 'Default' : nextMode === 'no-context' ? 'No Context' : 'Provided Context'
    window.sessionStorage.setItem(CONTEXT_FLASH_STORAGE_KEY, `Switched to ${nextModeLabel} · ${nextPackName}`)
  }

  const handleContextChange = (value: string) => {
    if (value === 'default-context') {
      queueContextSwitchFlash('default-context')
      onSwitchContext?.('default-context')
      return
    }

    if (value === 'no-context') {
      queueContextSwitchFlash('no-context')
      onSwitchContext?.('no-context')
      return
    }

    const [mode, packId] = value.split(':')
    if (mode === 'provided-context' && packId) {
      queueContextSwitchFlash('provided-context', packId)
      onSwitchContext?.('provided-context', packId)
    }
  }

  const handleSelectEra = useCallback((era: Era) => {
    setSelectedEra(era)
    setLastFocusedEraId(era.id)
    setHasSeenFocusOnboarding(true)
    setZoomBand(zoomBandFromEraSpan(era))

    // Auto-log era exploration to notebook
    logNotebookEntry({
      eraId: era.id,
      eraContent: era.content,
      eraGroup: era.group,
      action: 'explored-era',
      progressAtTime: progress[era.id] ?? 0,
    })

    // Trigger map fly-to if era has geo data
    viewportSync.onEraSelected(era as GeoEra)
  }, [logNotebookEntry, progress])

  const handleJumpToContext = (targetEra: Era) => {
    if (selectedEra && selectedEra.id !== targetEra.id) {
      setReturnTarget({
        eraId: selectedEra.id,
        zoomBand,
        zoomLevel,
      })
    }

    handleSelectEra(targetEra)
  }

  const handleReturnToOrigin = () => {
    if (!returnTarget) return
    const originEra = activeEras.find((era) => era.id === returnTarget.eraId)
    if (!originEra) {
      setReturnTarget(null)
      return
    }

    handleSelectEra(originEra)
    setZoomBand(returnTarget.zoomBand)
    setZoomLevel(returnTarget.zoomLevel)
    setReturnTarget(null)
  }

  const handleExitFocus = () => {
    setSelectedEra(null)
  }

  const handleQuickStart = () => {
    const target = recommendedEra ?? activeEras[0]
    if (!target) return
    handleMissionComplete(target.id)
    handleSelectEra(target)
  }

  const handleNavigateFocusedEra = (direction: 'previous' | 'next') => {
    if (focusIndex < 0) return
    const targetIndex = direction === 'previous' ? focusIndex - 1 : focusIndex + 1
    const targetEra = groupEras[targetIndex]
    if (!targetEra) return
    setSelectedEra(targetEra)
    setLastFocusedEraId(targetEra.id)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800 px-4 py-2">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
          <h1 className="shrink-0 text-lg font-semibold tracking-tight">Parallax Atlas</h1>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5 text-xs">
            <span aria-label="Active context summary" className="hidden rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 sm:inline-flex">
              {activeLesson ? `📝 ${activeLesson.title}` : `${activeModeLabel} · ${activePackName}`}
            </span>
            {activeLesson && (
              <button
                className="rounded border border-rose-600/60 px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-950/30"
                onClick={handleExitLesson}
                type="button"
              >
                Exit Lesson
              </button>
            )}
            <button
              aria-label="Create a new AI-generated learning journey"
              className="rounded border border-emerald-500 bg-emerald-900/40 px-2.5 py-1 text-xs font-semibold text-emerald-100 shadow-sm shadow-emerald-900/30 transition hover:bg-emerald-800/50"
              onClick={() => setShowJourneyCreator(true)}
              type="button"
              data-testid="create-journey-btn"
            >
              ✨ Create Journey
            </button>
            <button
              aria-label="Start learning with your own API key"
              className="hidden rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-300 sm:inline-flex"
              onClick={() => setShowLessonLauncher(true)}
              type="button"
              title="Generate a lesson using your own OpenAI/Anthropic API key (advanced)"
            >
              🔑 Own Key
            </button>
            {availablePacks.length === 0 && <span className="hidden text-[11px] text-amber-300 md:inline">No subject packs available</span>}
            <select
              aria-label="Context selector"
              className="max-w-36 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-100 sm:max-w-52"
              id="context-selector"
              onChange={(event) => handleContextChange(event.target.value)}
              value={selectedContextControl}
            >
              <option value="default-context">Built-in default</option>
              <option value="no-context">No prior context</option>
              {availablePacks.map((pack) => (
                <option key={pack.id} value={`provided-context:${pack.id}`}>
                  {pack.name}
                </option>
              ))}
            </select>
            {bingMapsApiKey && (
              <button
                aria-label={showMap ? 'Hide spatial map' : 'Show spatial map'}
                className={`rounded border px-2 py-0.5 text-xs transition ${showMap ? 'border-blue-500 bg-blue-900/50 text-blue-200' : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-blue-500'}`}
                onClick={() => setShowMap((current) => !current)}
                type="button"
              >
                {showMap ? '🗺️ Hide Map' : '🗺️ Show Map'}
              </button>
            )}
            <button
              aria-label={showCivMap ? 'Hide civilization map' : 'Show civilization map'}
              className={`rounded border px-2 py-0.5 text-xs transition ${showCivMap ? 'border-amber-500 bg-amber-900/50 text-amber-200' : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-amber-500'}`}
              onClick={() => setShowCivMap((current) => !current)}
              type="button"
            >
              {showCivMap ? '🏛️ Hide Civ Map' : '🏛️ Civ Map'}
            </button>
            <button
              aria-label={showNotebook ? 'Hide notebook' : 'Show notebook'}
              className={`rounded border px-2 py-0.5 text-xs transition ${showNotebook ? 'border-amber-500 bg-amber-900/50 text-amber-200' : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-amber-500'}`}
              onClick={() => setShowNotebook((current) => !current)}
              type="button"
            >
              📓 Notebook{notebookEntries.length > 0 ? ` (${notebookEntries.length})` : ''}
            </button>
            <button
              aria-label="Send feedback"
              className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:border-violet-500 hover:text-violet-300 transition"
              onClick={() => setShowFeedback(true)}
              type="button"
            >
              💬 Feedback
            </button>
            <button className="rounded border border-slate-600 px-2 py-0.5 text-xs md:hidden" onClick={() => setSidebarOpen((current) => !current)} type="button">
              {sidebarOpen ? 'Hide Controls' : 'Show Controls'}
            </button>
            {auth.loading ? (
              <span className="text-[11px] text-slate-500">…</span>
            ) : auth.isAuthenticated ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="hidden text-[11px] text-slate-300 sm:inline" aria-label="Signed-in user">{auth.user?.displayName}</span>
                <button
                  aria-label="Sign out"
                  className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:border-rose-500 hover:text-rose-300"
                  onClick={auth.logOut}
                  type="button"
                >
                  Sign Out
                </button>
              </span>
            ) : (
              <button
                aria-label="Sign in with Microsoft"
                className="rounded border border-blue-600 bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-200 hover:bg-blue-800/40"
                onClick={auth.login}
                type="button"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>
      {/* ── Sample journey banner ──────────────────────────────── */}
      {isSampleJourney && (
        <div className="border-b border-emerald-800/50 bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-emerald-950/60 px-4 py-2.5" data-testid="sample-journey-banner">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-lg">🚀</span>
              <div>
                <p className="text-sm font-semibold text-emerald-100">
                  Exploring: <span className="text-white">{SAMPLE_JOURNEY_NAME}</span> <span className="text-emerald-400">(sample)</span>
                </p>
                <p className="text-xs text-emerald-300/80">Click any era to explore. This is what an AI-generated journey looks like.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Create your own AI-generated journey"
                className="rounded-lg border border-emerald-500 bg-emerald-800/50 px-4 py-1.5 text-sm font-semibold text-emerald-100 shadow-sm transition hover:bg-emerald-700/60 hover:text-white"
                data-testid="sample-create-own-btn"
                onClick={() => setShowJourneyCreator(true)}
                type="button"
              >
                ✨ Create Your Own
              </button>
              <button
                aria-label="Dismiss sample journey"
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                data-testid="sample-dismiss-btn"
                onClick={handleExitSample}
                type="button"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      <section aria-label="Today's mission" className="border-b border-cyan-900/40 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 px-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between py-2">
          <button
            aria-expanded={!coachCollapsed}
            aria-label={coachCollapsed ? 'Expand coach panel' : 'Minimize coach panel'}
            className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-300 hover:text-cyan-100 transition-colors"
            onClick={() => setCoachCollapsed((c) => !c)}
            type="button"
          >
            <span className={`inline-block transition-transform duration-200 ${coachCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
            Coach Mode{coachCollapsed && <span className="normal-case text-slate-400"> — {missionTargetEra?.content ?? 'No target'} · Avg {momentumStats.average}%</span>}
          </button>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-cyan-800/80 bg-cyan-950/50 px-3 py-1 text-cyan-100">Started {momentumStats.started}/{momentumStats.total}</span>
            <span className="rounded-full border border-emerald-800/80 bg-emerald-950/40 px-3 py-1 text-emerald-100">Strong {momentumStats.strong}</span>
            <span className="rounded-full border border-amber-700/80 bg-amber-950/35 px-3 py-1 text-amber-100">Mastered {momentumStats.mastered}</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-100">Avg {momentumStats.average}%</span>
            {streakInfo.currentStreak > 0 && (
              <span className="rounded-full border border-orange-700/80 bg-orange-950/35 px-3 py-1 text-orange-100">🔥 {streakInfo.currentStreak}d</span>
            )}
          </div>
        </div>
        {!coachCollapsed && (
          <div className="mx-auto grid w-full max-w-7xl gap-4 pb-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-xl font-semibold text-cyan-100">Today's Mission</h2>
              {showWelcome ? (
                <>
                  <p className="mt-1 text-lg font-medium text-slate-100">Welcome! Your journey through knowledge starts here.</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Pick one era and take your first step. Every expert started exactly where you are now.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <button
                      aria-label="Quick start with recommended era"
                      className="flex-1 rounded-lg border-2 border-emerald-500/60 bg-emerald-950/40 px-5 py-4 text-left transition hover:border-emerald-400 hover:bg-emerald-900/50"
                      onClick={handleQuickStart}
                      type="button"
                    >
                      <span className="text-lg font-semibold text-emerald-200">⚡ Quick Start</span>
                      <span className="mt-1 block text-sm text-slate-300">
                        Jump into <strong className="text-white">{missionTargetEra?.content ?? 'the first era'}</strong> and make your first mark
                      </span>
                    </button>
                    {availablePacks.slice(0, 3).map((pack) => (
                      <button
                        key={pack.id}
                        aria-label={`Switch to ${pack.name}`}
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-900/60 px-5 py-4 text-left transition hover:border-cyan-500 hover:bg-slate-800/60"
                        onClick={() => handleContextChange(`provided-context:${pack.id}`)}
                        type="button"
                      >
                        <span className="text-base font-semibold text-cyan-200">{packIcon(pack.id)} {pack.name}</span>
                        <span className="mt-1 block text-sm text-slate-400">Explore this subject</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
              <p className="mt-1 text-sm text-slate-100">{missionHeadline}</p>
              {missionTargetEra?.description && <p className="mt-2 text-sm text-slate-300">Why this matters: {missionTargetEra.description}</p>}
              <p aria-live="polite" className="mt-2 text-sm text-cyan-100">
                Next 10-minute action: {missionNextAction}
              </p>
              <p className="mt-1 text-xs text-slate-400">{momentumStats.message}</p>
              {streakInfo.currentStreak > 0 && (
                <p className="mt-1 text-xs text-orange-300/90">{streakInfo.message}</p>
              )}
              {treeAnalytics && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-indigo-800/70 bg-indigo-950/35 px-2 py-0.5 text-indigo-200">
                    Coverage {treeAnalytics.coveragePercent}%
                  </span>
                  <span className="rounded-full border border-amber-800/70 bg-amber-950/30 px-2 py-0.5 text-amber-200">
                    Mastery {treeAnalytics.masteryPercent}%
                  </span>
                  {treeAnalytics.acquiredSkills.length > 0 && (
                    <span className="rounded-full border border-emerald-800/70 bg-emerald-950/30 px-2 py-0.5 text-emerald-200">
                      Skills: {treeAnalytics.acquiredSkills.slice(0, 3).join(', ')}{treeAnalytics.acquiredSkills.length > 3 ? ` +${treeAnalytics.acquiredSkills.length - 3}` : ''}
                    </span>
                  )}
                </div>
              )}
              {treeRecommendations.length > 1 && !selectedEra && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                    {treeRecommendations.length} recommended next steps
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
                    {treeRecommendations.map((rec) => (
                      <li key={rec.nodeId} className="flex items-center gap-2">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${rec.unmetPrereqs.length === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <button
                          className="text-left hover:text-cyan-200"
                          onClick={() => {
                            const era = activeEras.find((e) => e.id === rec.nodeId)
                            if (era) handleSelectEra(era)
                          }}
                          type="button"
                        >
                          {rec.reason}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {missionTargetEra && missionTargetEra.id !== selectedEra?.id && (
                <button
                  aria-label={`Focus mission era ${missionTargetEra.content}`}
                  className="mt-3 rounded border border-cyan-600 bg-cyan-900/30 px-3 py-1.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-800/35"
                  onClick={() => handleSelectEra(missionTargetEra)}
                  type="button"
                >
                  Focus Recommended Era
                </button>
              )}
              {!selectedEra && lastFocusedEra && (
                <button
                  aria-label={`Resume focus on ${lastFocusedEra.content}`}
                  className="ml-2 mt-3 rounded border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                  onClick={() => handleSelectEra(lastFocusedEra)}
                  type="button"
                >
                  Resume Last Focus
                </button>
              )}
              {missionTargetEra && missionTargetEra.id === selectedEra?.id && (
                <span className="mt-3 inline-flex rounded border border-emerald-700 bg-emerald-950/35 px-3 py-1 text-sm text-emerald-200">Mission in Focus</span>
              )}
                </>
              )}
            </div>
            {/* Right column: Micro-goals + Study-partner invite */}
            <div className="space-y-4">
              {/* Daily Micro-Goals */}
              {microGoals.length > 0 && !showWelcome && (
                <div className="rounded-lg border border-cyan-800/50 bg-slate-900/60 p-3" aria-label="Daily micro-goals">
                  <h3 className="text-sm font-semibold text-cyan-200">
                    📋 Today&apos;s Micro-Goals
                    {reviewDueCount > 0 && (
                      <span className="ml-2 rounded-full bg-amber-700/50 px-2 py-0.5 text-[11px] text-amber-200">{reviewDueCount} review due</span>
                    )}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {microGoals.map((goal) => (
                      <li key={goal.eraId} className="group flex items-start gap-2">
                        <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                          goal.type === 'review-due' ? 'bg-amber-400' :
                          goal.type === 'continue' ? 'bg-cyan-400' :
                          'bg-slate-500'
                        }`} />
                        <button
                          className="flex-1 text-left text-xs text-slate-300 transition hover:text-cyan-200"
                          onClick={() => {
                            const era = activeEras.find((e) => e.id === goal.eraId)
                            if (era) handleSelectEra(era)
                          }}
                          type="button"
                        >
                          {goal.label}
                        </button>
                        <span className="shrink-0 text-[10px] text-slate-500">{goal.minuteEstimate}m</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-slate-500">
                    Total: ~{microGoals.reduce((sum, g) => sum + g.minuteEstimate, 0)} minutes · {microGoals.length} goal{microGoals.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {/* Study-partner invite / share */}
              {showShareInvite && !showWelcome && (
                <div className="rounded-lg border border-violet-800/50 bg-slate-900/60 p-3" aria-label="Share and invite">
                  <h3 className="text-sm font-semibold text-violet-200">🤝 Share Your Progress</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {momentumStats.mastered >= 1
                      ? `You've mastered ${momentumStats.mastered} era${momentumStats.mastered !== 1 ? 's' : ''}! Share your journey.`
                      : `${momentumStats.strong} eras at 50%+. Invite a study partner to learn together.`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      aria-label="Copy pack link to clipboard"
                      className="rounded border border-violet-600 bg-violet-900/30 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-800/40"
                      onClick={() => {
                        const url = new URL(window.location.href)
                        navigator.clipboard.writeText(url.toString()).then(() => {
                          setContextSwitchFlash('Link copied to clipboard!')
                          setTimeout(() => setContextSwitchFlash(null), 2500)
                        })
                      }}
                      type="button"
                    >
                      🔗 Copy Pack Link
                    </button>
                    <button
                      aria-label="Export progress as shareable image"
                      className="rounded border border-emerald-600 bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-800/40"
                      onClick={handleExportImage}
                      type="button"
                    >
                      📸 Share Snapshot
                    </button>
                  </div>
                </div>
              )}
              {/* Engagement level indicator for transparency */}
              {!showWelcome && (
                <p className="text-[10px] text-slate-600" aria-label="Engagement level">
                  Level: {engagementLevel}{showAdvancedControls ? ' · Advanced controls visible' : ''}
                </p>
              )}
            </div>
          </div>
        )}
      </section>
      {contextSwitchFlash && (
        <div className="px-4 pt-2">
          <div className="mx-auto max-w-6xl rounded border border-cyan-800/70 bg-cyan-950/35 px-3 py-2 text-sm text-cyan-100" role="status">
            {contextSwitchFlash}
          </div>
        </div>
      )}
      {visibleNotices.length > 0 && (
        <div className="px-4 pb-1 pt-3">
          <div className="mx-auto max-w-5xl space-y-2">
            {visibleNotices.map((notice, index) => {
              const noticeTone =
                notice.level === 'error'
                  ? {
                      badgeClassName: 'bg-rose-500/20 text-rose-200',
                      panelClassName: 'border-rose-800/80 bg-rose-950/40 text-rose-100',
                    }
                  : {
                      badgeClassName: 'bg-amber-500/20 text-amber-200',
                      panelClassName: 'border-amber-800/80 bg-amber-950/35 text-amber-100',
                    }

              return (
                <div
                  className={`flex items-start justify-between gap-3 rounded border px-3 py-2 text-sm shadow-sm ${noticeTone.panelClassName}`}
                  key={`${notice.level}-${notice.message}-${index}`}
                  role="alert"
                >
                  <p className="pr-2">
                    <span className={`mr-2 inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${noticeTone.badgeClassName}`}>
                      {notice.level === 'error' ? 'Error' : 'Warning'}
                    </span>
                    {notice.message}
                  </p>
                  <button
                    aria-label={`Dismiss ${notice.level} notice`}
                    className="rounded border border-current/35 px-2 py-0.5 text-xs hover:bg-black/20"
                    onClick={() => {
                      setVisibleNotices((current) => current.filter((_, currentIndex) => currentIndex !== index))
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {selectedEra ? (
            <>
              <span className="rounded bg-slate-900 px-2 py-0.5 text-slate-300">Breadcrumb: Full Timeline / {selectedEra.group} / {selectedEra.content}</span>
              <span className="text-slate-500">{focusIndex + 1}/{groupEras.length}</span>
              <button
                className={`rounded border border-slate-600 px-2 py-0.5 ${hasPreviousFocusedEra ? 'hover:bg-slate-800' : 'cursor-not-allowed opacity-50'}`}
                disabled={!hasPreviousFocusedEra}
                onClick={() => handleNavigateFocusedEra('previous')}
                type="button"
              >
                ◀ Prev
              </button>
              <button
                className={`rounded border border-slate-600 px-2 py-0.5 ${hasNextFocusedEra ? 'hover:bg-slate-800' : 'cursor-not-allowed opacity-50'}`}
                disabled={!hasNextFocusedEra}
                onClick={() => handleNavigateFocusedEra('next')}
                type="button"
              >
                Next ▶
              </button>
              <button className="rounded border border-cyan-700 px-2 py-0.5 text-cyan-300 hover:bg-slate-800" onClick={handleExitFocus} type="button">
                Back to Full Timeline
              </button>
              {selectedEra.sources && selectedEra.sources.length > 0 && (
                <button
                  aria-label={showSourcePanel ? 'Hide sources' : 'Show sources'}
                  className={`rounded border px-2 py-0.5 transition ${showSourcePanel ? 'border-amber-500 bg-amber-900/40 text-amber-200' : 'border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-200'}`}
                  onClick={() => setShowSourcePanel((current) => !current)}
                  type="button"
                >
                  📚 Sources ({selectedEra.sources.length})
                </button>
              )}
              {recommendedEra && selectedEra.id !== recommendedEra.id && (
                <button
                  aria-label={`Go to recommended era ${recommendedEra.content}`}
                  className="rounded border border-emerald-700 px-2 py-0.5 text-emerald-300 hover:bg-emerald-950/30"
                  onClick={() => handleSelectEra(recommendedEra)}
                  type="button"
                >
                  Go to Recommended Era
                </button>
              )}
              {focusEdgeMessage && <span className="text-slate-500">{focusEdgeMessage}</span>}
            </>
          ) : !hasSeenFocusOnboarding ? (
            <div className="flex items-center gap-3 text-cyan-200/80">
              <p>Tip: Select an era on the timeline to enter focus mode and navigate nearby eras.</p>
              <button
                className="shrink-0 rounded border border-cyan-700 px-2 py-0.5 text-cyan-200 hover:bg-cyan-900/30"
                onClick={() => setHasSeenFocusOnboarding(true)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <span className="text-slate-600">Click a timeline era to focus</span>
          )}
        </div>
        {/* Advanced controls — progressively disclosed based on engagement level */}
        <div className="hidden flex-wrap items-center gap-1.5 text-[11px] md:flex">
          {showAdvancedControls && (
            <>
              <select
                aria-label="Subgraph sort mode"
                className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-slate-100"
                onChange={(event) => setSortMode(event.target.value as SubgraphSortMode)}
                value={sortMode}
              >
                <option value="chronological">Chronological</option>
                <option value="prerequisite-order">Prereq Order</option>
              </select>
              <label className="inline-flex items-center gap-1 text-slate-300" htmlFor="ghost-layer-toggle">
                <input
                  checked={ghostLayerMode === 'prerequisites'}
                  id="ghost-layer-toggle"
                  onChange={(event) => setGhostLayerMode(event.target.checked ? 'prerequisites' : 'off')}
                  type="checkbox"
                />
                Ghost
              </label>
            </>
          )}
          <span aria-label="Zoom band status" className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">
            {zoomBand} · L{zoomLevel.toFixed(1)}
          </span>
          {drillContextLabel && (
            <span aria-label="Drill context chip" className="rounded-full border border-cyan-700/80 bg-cyan-950/35 px-2 py-0.5 text-cyan-100">
              {drillContextLabel}
            </span>
          )}
          {returnTarget && (
            <button
              aria-label={`Return to ${activeEras.find((era) => era.id === returnTarget.eraId)?.content ?? 'origin'}`}
              className="rounded-full border border-violet-500/90 bg-violet-900/35 px-2 py-0.5 font-semibold text-violet-100 hover:bg-violet-800/45"
              onClick={handleReturnToOrigin}
              type="button"
            >
              ↩ {activeEras.find((era) => era.id === returnTarget.eraId)?.content ?? 'Origin'}
            </button>
          )}
        </div>
      </div>
      {showSourcePanel && selectedEra && (
        <SourcePanel
          era={selectedEra}
          onClose={() => setShowSourcePanel(false)}
          onLogSource={handleLogSource}
          progress={progress[selectedEra.id] ?? 0}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <ProgressSidebar
          eras={timelineEras}
          isCollapsedDesktop={sidebarCollapsedDesktop}
          isOpen={sidebarOpen}
          onCompleteTask={handleMissionComplete}
          onCollapseDesktop={() => setSidebarCollapsedDesktop(true)}
          onExpandDesktop={() => setSidebarCollapsedDesktop(false)}
          onFocusEra={handleSelectEra}
          onExport={handleExport}
          onExportImage={handleExportImage}
          reviewDueByEra={reviewDueByEra}
          progress={progress}
          selectedEraId={selectedEra?.id}
          sortMode={sortMode}
        />
        <div className={`flex min-w-0 flex-1 ${showMap ? 'flex-col lg:flex-row' : ''}`}>
          <div className={showMap ? 'min-h-[40vh] flex-1 lg:min-h-0 lg:w-1/2' : 'flex-1'}>
            <Timeline
              allEras={activeEras}
              eras={timelineEras}
              focusEra={selectedEra}
              ghostLayerMode={ghostLayerMode}
              reviewDueByEra={reviewDueByEra}
              onCompleteTask={handleMissionComplete}
              onJumpToContext={handleJumpToContext}
              showCivMap={showCivMap}
              zoomBand={zoomBand}
              onZoomLevelChange={(nextZoomLevel: number, nextBand: ZoomBand) => {
                setZoomLevel(nextZoomLevel)
                setZoomBand(nextBand)
              }}
              onSelectEra={handleSelectEra}
              progress={progress}
            />
          </div>
          {showMap && bingMapsApiKey && (
            <div className="min-h-[40vh] flex-1 border-l border-slate-800 lg:min-h-0 lg:w-1/2">
              <AzureMapPanel
                apiKey={bingMapsApiKey}
                center={mapCenter}
                eras={activeEras as GeoEra[]}
                onEraSelect={(eraId) => {
                  const era = activeEras.find((e) => e.id === eraId)
                  if (era) handleSelectEra(era)
                }}
                onMapMove={(center) => viewportSync.onMapViewChange(center)}
                onSyncModeChange={setMapSyncMode}
                selectedEraId={selectedEra?.id}
                syncMode={mapSyncMode}
              />
            </div>
          )}
        </div>
      </div>
      {showNotebook && (
        <NotebookPanel
          availableEras={activeEras.map((e) => ({ id: e.id, content: e.content, group: e.group }))}
          currentEraId={selectedEra?.id}
          entries={notebookEntries}
          onAddInsight={handleAddInsight}
          onClear={handleClearNotebook}
          onClose={() => setShowNotebook(false)}
        />
      )}
      {showLessonLauncher && (
        <LessonLauncher
          learnerProfile={learnerProfile}
          onClose={() => setShowLessonLauncher(false)}
          onLessonReady={handleLessonReady}
        />
      )}
      {showJourneyCreator && (
        <JourneyCreator
          onClose={() => setShowJourneyCreator(false)}
          onJourneyReady={handleJourneyReady}
        />
      )}
      <FeedbackModal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        isAuthenticated={auth.isAuthenticated}
        appContext={`context=${selectedContextControl}${selectedEra ? ` era=${selectedEra.id}` : ''}`}
      />
      <MilestoneCelebration
        key={milestoneKey}
        milestone={activeMilestone}
        eraName={milestoneEraName}
        streakDays={milestoneStreakDays}
        onDismiss={dismissMilestone}
      />
    </div>
  )
}

export default App
