/** Lightweight day-streak tracker backed by localStorage */

const STREAK_STORAGE_KEY = 'parallax-atlas-streak'

interface StreakState {
  /** Current consecutive-day streak count */
  currentStreak: number
  /** ISO date string of last recorded visit day (YYYY-MM-DD) */
  lastVisitDay: string
  /** Longest streak ever achieved */
  longestStreak: number
}

const todayKey = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const daysBetween = (a: string, b: string): number => {
  const msPerDay = 86_400_000
  const dateA = new Date(a + 'T00:00:00')
  const dateB = new Date(b + 'T00:00:00')
  return Math.round(Math.abs(dateB.getTime() - dateA.getTime()) / msPerDay)
}

const loadState = (): StreakState => {
  try {
    const stored = window.localStorage.getItem(STREAK_STORAGE_KEY)
    if (!stored) return { currentStreak: 0, lastVisitDay: '', longestStreak: 0 }
    const parsed = JSON.parse(stored) as Partial<StreakState>
    return {
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
      lastVisitDay: typeof parsed.lastVisitDay === 'string' ? parsed.lastVisitDay : '',
      longestStreak: typeof parsed.longestStreak === 'number' ? parsed.longestStreak : 0,
    }
  } catch {
    return { currentStreak: 0, lastVisitDay: '', longestStreak: 0 }
  }
}

const saveState = (state: StreakState): void => {
  window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(state))
}

export interface StreakInfo {
  /** Current consecutive-day streak */
  currentStreak: number
  /** Longest streak ever */
  longestStreak: number
  /** Whether today's visit extends or starts a streak (i.e. first interaction today) */
  isNewDayVisit: boolean
  /** Message to show in the coach panel */
  message: string
}

/**
 * Record a visit for today and return the updated streak info.
 * Call this once on app load or on first meaningful interaction.
 */
export function recordVisit(): StreakInfo {
  const today = todayKey()
  const state = loadState()

  // Already visited today — no change
  if (state.lastVisitDay === today) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      isNewDayVisit: false,
      message: streakMessage(state.currentStreak),
    }
  }

  const gap = state.lastVisitDay ? daysBetween(state.lastVisitDay, today) : 0

  let newStreak: number
  if (gap === 1) {
    // Consecutive day — extend streak
    newStreak = state.currentStreak + 1
  } else if (gap === 0 || state.lastVisitDay === '') {
    // First ever visit
    newStreak = 1
  } else {
    // Gap > 1 day — streak broken, restart
    newStreak = 1
  }

  const newLongest = Math.max(state.longestStreak, newStreak)

  const newState: StreakState = {
    currentStreak: newStreak,
    lastVisitDay: today,
    longestStreak: newLongest,
  }
  saveState(newState)

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    isNewDayVisit: true,
    message: streakMessage(newStreak),
  }
}

/** Read current streak without recording a new visit */
export function peekStreak(): StreakInfo {
  const today = todayKey()
  const state = loadState()

  // If last visit was not today or yesterday, streak is broken
  const gap = state.lastVisitDay ? daysBetween(state.lastVisitDay, today) : 999
  const effectiveStreak = gap <= 1 ? state.currentStreak : 0

  return {
    currentStreak: effectiveStreak,
    longestStreak: state.longestStreak,
    isNewDayVisit: state.lastVisitDay !== today,
    message: streakMessage(effectiveStreak),
  }
}

function streakMessage(streak: number): string {
  if (streak >= 30) return `🔥 ${streak}-day streak! You're unstoppable.`
  if (streak >= 14) return `🔥 ${streak}-day streak — two weeks of consistency!`
  if (streak >= 7) return `🔥 ${streak}-day streak — a full week! Keep it alive.`
  if (streak >= 3) return `🔥 ${streak}-day streak — momentum is building.`
  if (streak === 2) return `🔥 2-day streak started — come back tomorrow to grow it.`
  if (streak === 1) return `Day 1 — the beginning of a new streak.`
  return `Start a streak today by completing one mission.`
}

/** Determine if a streak count represents a milestone worth celebrating (3, 7, 14, 30, 60, 100) */
export function isStreakMilestone(streak: number): boolean {
  return [3, 7, 14, 30, 60, 100].includes(streak)
}
