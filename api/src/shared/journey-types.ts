/**
 * Journey document types for the dynamic learning path generation engine.
 *
 * A Journey is a user-owned, AI-generated learning path stored in Cosmos DB.
 * It evolves through generate → refine → adapt lifecycle phases.
 */

export type JourneyAction = 'generate' | 'refine' | 'adapt'
export type DifficultyLevel = 'intro' | 'intermediate' | 'advanced'

// ── Era / pack structures (server-side mirror of client types) ──────

export interface JourneyEraConnection {
  targetEraId: string
  kind: 'analogy' | 'influence' | 'contrast' | 'application'
  strength?: number
}

export interface JourneySubTopic {
  id: string
  label: string
  description?: string
  start?: number
  end?: number
}

export interface JourneyGeoMarker {
  label: string
  latitude: number
  longitude: number
  description?: string
}

export interface JourneyEraPayload {
  taskType: string
  missionTitle: string
  prompt: string
  completionEvidenceHint: string
}

export interface JourneyEraSource {
  id: string
  title: string
  url: string
  format: string
  author?: string
  year?: number
  domain?: string
  snippet?: string
}

export interface JourneyEra {
  id: string
  content: string
  start: number
  end: number
  group: string
  description?: string
  difficulty?: DifficultyLevel
  learningObjectives?: string[]
  estimatedMinutes?: number
  skillTags?: string[]
  prerequisiteIds?: string[]
  connections?: JourneyEraConnection[]
  subtopics?: JourneySubTopic[]
  keyLocations?: JourneyGeoMarker[]
  payload?: JourneyEraPayload
  sources?: JourneyEraSource[]
  geoCenter?: { latitude: number; longitude: number; zoom?: number }
  region?: string
}

/** Server-side equivalent of SubjectPackPayload */
export interface JourneyPackPayload {
  id: string
  name: string
  description?: string
  context: {
    eras: JourneyEra[]
    progress: Record<string, number>
    selectedEraId?: string
    sidebarOpen?: boolean
    persistence?: 'local' | 'memory' | 'none'
  }
}

// ── Cosmos document ────────────────────────────────────────────────

export interface JourneyVersionSnapshot {
  version: number
  action: JourneyAction
  description: string
  timestamp: string
  packSnapshot: JourneyPackPayload
}

export interface JourneyDoc {
  /** Document ID: `journey:${userId}:${journeyId}` */
  id: string
  userId: string
  journeyId: string
  docType: 'journey'
  topic: string
  level: DifficultyLevel
  pack: JourneyPackPayload
  versions: JourneyVersionSnapshot[]
  createdAt: string
  updatedAt: string
  generatorModel?: string
}

// ── API request / response types ───────────────────────────────────

export interface GenerateJourneyRequest {
  topic: string
  level?: DifficultyLevel
  eraCount?: number
  priorKnowledge?: string
}

export interface GenerateJourneyResponse {
  journeyId: string
  pack: JourneyPackPayload
  generatorModel: string
  createdAt: string
}

export interface RefineJourneyRequest {
  instruction: string
}

export interface RefineJourneyResponse {
  version: number
  pack: JourneyPackPayload
  description: string
  updatedAt: string
}

export interface JourneyListItem {
  journeyId: string
  topic: string
  level: DifficultyLevel
  eraCount: number
  createdAt: string
  updatedAt: string
}
