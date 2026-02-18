/**
 * Knowledge Tree type system — shared, versioned concept graph per subject domain.
 *
 * A KnowledgeTree is a directed graph where:
 *   - Nodes represent learnable concepts/eras/milestones
 *   - Edges represent relationships (prerequisites, influences, contrasts)
 *   - The tree is shared across all users of a subject pack
 *   - Personalized overlays adapt the tree per user without modifying the core
 */

/** Difficulty tier for a knowledge node */
export type DifficultyTier = 1 | 2 | 3 | 4 | 5

/** Relationship type between knowledge nodes */
export type EdgeKind =
  | 'prerequisite'    // Must understand A before B
  | 'corequisite'     // Best understood alongside
  | 'influence'       // A historically influenced B
  | 'contrast'        // Understanding A clarifies B by opposition
  | 'application'     // A applies concepts from B
  | 'deepening'       // B goes deeper into the same topic as A

/** Mastery state bucket (derived from numeric progress 0-100) */
export type MasteryState = 'unstarted' | 'exploring' | 'developing' | 'strong' | 'mastered'

// ── Core tree structures (shared, versioned, per subject pack) ─────────

export interface KnowledgeNode {
  /** Must match the era ID in the subject pack */
  id: string
  title: string
  /** Group/track this node belongs to */
  group: string
  /** 1 = introductory, 5 = advanced research-level */
  difficulty: DifficultyTier
  /** Number of evidence checkpoints to reach mastery */
  evidenceCheckpoints: number
  /** Estimated minutes to achieve mastery */
  estimatedMinutes?: number
  /** Skill tags for cross-domain linking */
  skillTags?: string[]
  /** Short rationale for why this concept matters */
  whyItMatters?: string
  /** Learning objectives — observable outcomes */
  learningObjectives?: string[]
  /** Suggested prerequisite node IDs (convenience alias for edges) */
  prereqs?: string[]
}

export interface KnowledgeEdge {
  from: string
  to: string
  kind: EdgeKind
  /** 0.0–1.0 how strongly the relationship holds */
  strength: number
  /** Optional explanation of the relationship */
  rationale?: string
}

export interface KnowledgeTree {
  /** Subject domain identifier (matches pack ID) */
  subject: string
  /** Semver-style version string */
  version: string
  /** ISO date of last update */
  lastUpdated: string
  /** How the tree was generated */
  source: 'ai-generated' | 'expert-curated' | 'hybrid' | 'community'
  /** All concept nodes */
  nodes: KnowledgeNode[]
  /** All edges between nodes */
  edges: KnowledgeEdge[]
  /** Optional metadata */
  metadata?: {
    author?: string
    description?: string
    /** Tags for discovery/filtering */
    tags?: string[]
  }
}

// ── Personalized overlay (per-user, ephemeral) ─────────────────────────

export interface UserNodeOverlay {
  nodeId: string
  /** 0–100 progress */
  progress: number
  masteryState: MasteryState
  /** Number of completed evidence checkpoints */
  completedCheckpoints: number
  /** Nodes the user has explicitly skipped */
  skipped: boolean
  /** ISO timestamp of last interaction */
  lastInteraction?: string
  /** User notes/annotations for this node */
  notes?: string
}

export interface PersonalizedOverlay {
  userId?: string
  treeSubject: string
  treeVersion: string
  nodeOverlays: Record<string, UserNodeOverlay>
  /** User's preferred learning style */
  learningStyle?: 'visual' | 'reading' | 'kinesthetic' | 'auditory'
  /** Custom path ordering if user deviates from default */
  customPathOrder?: string[]
  /** ISO timestamp */
  lastUpdated: string
}

// ── Engine output types ────────────────────────────────────────────────

export interface RecommendedNode {
  nodeId: string
  /** Why this node is recommended next */
  reason: string
  /** 0–1 score for priority ranking */
  score: number
  /** Estimated learning gain if completed */
  learningGain: number
  /** IDs of prerequisite nodes not yet mastered */
  unmetPrereqs: string[]
}

export interface LearningPath {
  /** Ordered list of node IDs forming the path */
  nodeIds: string[]
  /** Total estimated minutes */
  totalMinutes: number
  /** Average difficulty across the path */
  averageDifficulty: number
  /** Descriptive label */
  label: string
}

export interface TreeAnalytics {
  /** Fraction of nodes started (progress > 0) */
  coveragePercent: number
  /** Fraction of nodes mastered (progress = 100) */
  masteryPercent: number
  /** Nodes with highest learning-gain potential */
  topRecommendations: RecommendedNode[]
  /** Groups ranked by completion */
  groupProgress: Record<string, { started: number; mastered: number; total: number }>
  /** Skill tags the user has touched */
  acquiredSkills: string[]
  /** Skill tags not yet started */
  remainingSkills: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────

export function progressToMastery(progress: number): MasteryState {
  if (progress >= 100) return 'mastered'
  if (progress >= 75) return 'strong'
  if (progress >= 50) return 'developing'
  if (progress > 0) return 'exploring'
  return 'unstarted'
}

export function masteryToProgress(state: MasteryState): number {
  switch (state) {
    case 'mastered': return 100
    case 'strong': return 75
    case 'developing': return 50
    case 'exploring': return 25
    case 'unstarted': return 0
  }
}
