/**
 * Knowledge Tree module — shared, versioned concept graphs with personalized overlays.
 *
 * Public API:
 *   - Types: KnowledgeTree, KnowledgeNode, KnowledgeEdge, etc.
 *   - Engine: recommendNext, topologicalSort, pathToNode, computeAnalytics
 *   - Store: loadTreeForPack, buildTreeFromEras, getCachedTree
 *   - Hook: useKnowledgeTree (React integration)
 */

// Types
export type {
  DifficultyTier,
  EdgeKind,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeTree,
  LearningPath,
  MasteryState,
  PersonalizedOverlay,
  RecommendedNode,
  TreeAnalytics,
  UserNodeOverlay,
} from './tree-types'

export { masteryToProgress, progressToMastery } from './tree-types'

// Engine
export {
  buildOverlayFromProgress,
  computeAnalytics,
  generateFullPath,
  pathToNode,
  recommendNext,
  topologicalSort,
  validateTree,
} from './tree-engine'
export type { TreeValidationResult } from './tree-engine'

// Store
export {
  buildTreeFromEras,
  clearTreeCache,
  getCachedTree,
  loadTreeForPack,
  setCachedTree,
} from './tree-store'
export type { TreeLoadResult } from './tree-store'

// React hook
export { useKnowledgeTree } from './use-knowledge-tree'
export type { KnowledgeTreeState, UseKnowledgeTreeOptions } from './use-knowledge-tree'
