import { useCallback, useEffect, useState } from 'react'

export type MilestoneType =
  | 'first-started'    // First era > 0%
  | 'era-mastered'     // Any era hits 100%
  | 'all-mastered'     // All eras hit 100%
  | 'streak-achieved'  // Multi-day streak milestone

interface MilestoneCelebrationProps {
  milestone: MilestoneType | null
  eraName?: string
  streakDays?: number
  onDismiss: () => void
}

const MILESTONE_CONFIG: Record<MilestoneType, { emoji: string; title: string; subtitle: string; accentClass: string }> = {
  'first-started': {
    emoji: '🌱',
    title: 'Journey Begun!',
    subtitle: "You've taken your first step. Every expert was once a beginner.",
    accentClass: 'from-emerald-500/20 to-transparent border-emerald-500/40',
  },
  'era-mastered': {
    emoji: '⭐',
    title: 'Era Mastered!',
    subtitle: '',  // filled dynamically with era name
    accentClass: 'from-amber-500/20 to-transparent border-amber-500/40',
  },
  'all-mastered': {
    emoji: '🏆',
    title: 'Complete Mastery!',
    subtitle: "You've mastered every era in this pack. Incredible commitment.",
    accentClass: 'from-yellow-400/25 to-transparent border-yellow-400/50',
  },
  'streak-achieved': {
    emoji: '🔥',
    title: 'Streak Milestone!',
    subtitle: '',  // filled dynamically with streak count
    accentClass: 'from-orange-500/20 to-transparent border-orange-500/40',
  },
}

const AUTO_DISMISS_MS = 4000

/**
 * Celebration overlay for learning milestones.
 * Parent should pass a unique `key` (e.g. incrementing counter) when triggering
 * a new milestone so React remounts this component and resets animation state.
 */
export function MilestoneCelebration({ milestone, eraName, streakDays, onDismiss }: MilestoneCelebrationProps) {
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    window.setTimeout(onDismiss, 400)
  }, [onDismiss])

  // Auto-dismiss timer — no synchronous setState; dismiss runs via setTimeout
  useEffect(() => {
    if (!milestone) return undefined
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [milestone, dismiss])

  if (!milestone) return null

  const config = MILESTONE_CONFIG[milestone]
  const subtitle = milestone === 'era-mastered' && eraName
    ? `You've fully mastered ${eraName}. Time to teach it to someone.`
    : milestone === 'streak-achieved' && streakDays
      ? `${streakDays}-day learning streak! Consistency compounds.`
      : config.subtitle

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-20 transition-opacity duration-400 ${exiting ? 'opacity-0' : 'opacity-100'}`}
      role="status"
    >
      {/* Particle burst — pure CSS */}
      <div className="milestone-particles absolute inset-0 overflow-hidden" />

      {/* Card */}
      <div
        className={`pointer-events-auto relative mx-4 max-w-sm rounded-xl border bg-gradient-to-b ${config.accentClass} bg-slate-900/95 px-6 py-5 shadow-2xl backdrop-blur-sm milestone-card-enter ${exiting ? 'milestone-card-exit' : ''}`}
        onClick={dismiss}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') dismiss()
        }}
      >
        <div className="mb-2 text-center text-4xl milestone-emoji-bounce">{config.emoji}</div>
        <h3 className="text-center text-xl font-bold text-white">{config.title}</h3>
        <p className="mt-1 text-center text-sm text-slate-300">{subtitle}</p>
        <p className="mt-3 text-center text-xs text-slate-500">Click to dismiss</p>
      </div>
    </div>
  )
}
