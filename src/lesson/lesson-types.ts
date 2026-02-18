import type { DifficultyLevel, EraPayloadType } from '../data/timeline-data'
import type { SubjectPackPayload } from '../viewer/types'

// ── Learner profile (mined from notebook + progress) ─────────────────────────

export interface LearnerProfile {
  /** Subject areas the learner has explored, with visit counts */
  topicsExplored: Record<string, number>
  /** Source format preferences ranked by interaction frequency */
  formatPreferences: string[]
  /** Average progress across all known eras */
  averageProgress: number
  /** Era IDs where progress is stalled (<25% after multiple visits) */
  knowledgeGaps: string[]
  /** Era IDs where mastery is ≥75% */
  strengths: string[]
  /** Cross-era connections the learner has made (insight journal links) */
  personalConnections: Array<{ fromEraId: string; toEraId: string }>
  /** Total time-span of learning activity */
  learningDaysActive: number
  /** Preferred difficulty based on completion velocity */
  inferredLevel: DifficultyLevel
}

// ── Lesson step ──────────────────────────────────────────────────────────────

export interface LessonStep {
  /** Which era this step maps to (by era ID) */
  eraId: string
  /** Step order within the lesson (1-based) */
  order: number
  /** Step-specific learning prompt (overrides era.payload.prompt when present) */
  prompt?: string
  /** What the learner should be able to do after this step */
  objective: string
  /** Task type for this step */
  taskType: EraPayloadType
  /** Estimated minutes for this step */
  estimatedMinutes: number
  /** Gate: minimum progress % required before the learner should advance */
  gateProgress: number
}

// ── Lesson plan ──────────────────────────────────────────────────────────────

export interface LessonPlan {
  id: string
  /** Human-readable lesson title */
  title: string
  /** Subject area (what the student typed) */
  subject: string
  /** Target difficulty level */
  level: DifficultyLevel
  /** Free-text description of what this lesson covers */
  description: string
  /** Total estimated minutes for the full lesson */
  totalEstimatedMinutes: number
  /** Ordered learning steps */
  steps: LessonStep[]
  /** The generated pack payload (eras + progress + connections) */
  pack: SubjectPackPayload
  /** ISO timestamp of generation */
  generatedAt: string
  /** Model identifier if AI-generated */
  generatorModel?: string
  /** Learner profile snapshot at generation time */
  learnerSnapshot?: LearnerProfile
}

// ── Generator request/response ───────────────────────────────────────────────

export interface LessonGeneratorRequest {
  subject: string
  level: DifficultyLevel
  /** Number of eras/steps to generate (default: 8) */
  eraCount?: number
  /** Optional existing progress to consider */
  existingProgress?: Record<string, number>
  /** Optional learner profile for personalization */
  learnerProfile?: LearnerProfile
  /** Optional additional context from the learner */
  priorKnowledge?: string
}

export interface LessonGeneratorResult {
  success: boolean
  lesson?: LessonPlan
  error?: string
}

// ── API configuration ────────────────────────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic'

export interface LessonGeneratorConfig {
  provider: LLMProvider
  apiKey: string
  model?: string
}

// ── Persistence ──────────────────────────────────────────────────────────────

const LESSON_STORAGE_PREFIX = 'knowledge-timeline-lesson-'
const LESSONS_INDEX_KEY = 'knowledge-timeline-lessons-index'

export interface SavedLessonReference {
  id: string
  title: string
  subject: string
  level: DifficultyLevel
  generatedAt: string
  stepCount: number
}

export function saveLessonPlan(lesson: LessonPlan): void {
  window.localStorage.setItem(`${LESSON_STORAGE_PREFIX}${lesson.id}`, JSON.stringify(lesson))
  const index = loadLessonIndex()
  const existing = index.findIndex((ref) => ref.id === lesson.id)
  const ref: SavedLessonReference = {
    id: lesson.id,
    title: lesson.title,
    subject: lesson.subject,
    level: lesson.level,
    generatedAt: lesson.generatedAt,
    stepCount: lesson.steps.length,
  }
  if (existing >= 0) {
    index[existing] = ref
  } else {
    index.push(ref)
  }
  window.localStorage.setItem(LESSONS_INDEX_KEY, JSON.stringify(index))
}

export function loadLessonPlan(id: string): LessonPlan | null {
  try {
    const raw = window.localStorage.getItem(`${LESSON_STORAGE_PREFIX}${id}`)
    if (!raw) return null
    return JSON.parse(raw) as LessonPlan
  } catch {
    return null
  }
}

export function loadLessonIndex(): SavedLessonReference[] {
  try {
    const raw = window.localStorage.getItem(LESSONS_INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SavedLessonReference[]
  } catch {
    return []
  }
}

export function deleteLessonPlan(id: string): void {
  window.localStorage.removeItem(`${LESSON_STORAGE_PREFIX}${id}`)
  const index = loadLessonIndex().filter((ref) => ref.id !== id)
  window.localStorage.setItem(LESSONS_INDEX_KEY, JSON.stringify(index))
}
