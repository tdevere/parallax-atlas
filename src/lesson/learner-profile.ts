import type { DifficultyLevel } from '../data/timeline-data'
import type { NotebookEntry } from '../notebook/notebook-types'
import type { LearnerProfile } from './lesson-types'

/**
 * Mine a LearnerProfile from notebook activity log and current progress.
 * This is the system's understanding of the learner — fed into the generator
 * for personalized lesson creation.
 */
export function buildLearnerProfile(
  entries: NotebookEntry[],
  progress: Record<string, number>,
): LearnerProfile {
  // Topic exploration frequency
  const topicsExplored: Record<string, number> = {}
  for (const entry of entries) {
    topicsExplored[entry.eraGroup] = (topicsExplored[entry.eraGroup] ?? 0) + 1
  }

  // Source format preferences
  const formatCounts: Record<string, number> = {}
  for (const entry of entries) {
    if (entry.sourceFormat) {
      formatCounts[entry.sourceFormat] = (formatCounts[entry.sourceFormat] ?? 0) + 1
    }
  }
  const formatPreferences = Object.entries(formatCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([format]) => format)

  // Progress analysis
  const progressValues = Object.values(progress)
  const averageProgress =
    progressValues.length > 0
      ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
      : 0

  // Knowledge gaps: eras visited multiple times but still low progress
  const eraVisitCounts: Record<string, number> = {}
  for (const entry of entries) {
    eraVisitCounts[entry.eraId] = (eraVisitCounts[entry.eraId] ?? 0) + 1
  }
  const knowledgeGaps = Object.entries(progress)
    .filter(([eraId, value]) => value < 25 && (eraVisitCounts[eraId] ?? 0) >= 2)
    .map(([eraId]) => eraId)

  // Strengths: eras with high mastery
  const strengths = Object.entries(progress)
    .filter(([, value]) => value >= 75)
    .map(([eraId]) => eraId)

  // Personal connections from linked notebook entries
  const personalConnections: Array<{ fromEraId: string; toEraId: string }> = []
  for (const entry of entries) {
    if (entry.linkedEraIds) {
      for (const linkedId of entry.linkedEraIds) {
        personalConnections.push({ fromEraId: entry.eraId, toEraId: linkedId })
      }
    }
  }

  // Learning days active
  const uniqueDays = new Set(
    entries.map((entry) => new Date(entry.timestamp).toDateString()),
  ).size

  // Infer difficulty level from completion velocity
  const inferredLevel = inferDifficulty(entries, averageProgress)

  return {
    topicsExplored,
    formatPreferences,
    averageProgress,
    knowledgeGaps,
    strengths,
    personalConnections,
    learningDaysActive: uniqueDays,
    inferredLevel,
  }
}

function inferDifficulty(entries: NotebookEntry[], averageProgress: number): DifficultyLevel {
  const missions = entries.filter((e) => e.action === 'completed-mission')
  const missionRate = entries.length > 0 ? missions.length / entries.length : 0

  // Fast completers with high average → advanced
  if (averageProgress >= 60 && missionRate >= 0.3) return 'advanced'
  // Moderate progress → intermediate
  if (averageProgress >= 25 || missions.length >= 3) return 'intermediate'
  // New or slow → intro
  return 'intro'
}
