/**
 * useKnowledgeTree — React hook that wires the knowledge tree engine
 * into component state.
 *
 * Provides: recommendations, analytics, learning paths, and tree metadata.
 * Consumes: eras, progress, and optional embedded tree data.
 */

import { useCallback, useMemo } from 'react'
import type { Era } from '../data/timeline-data'
import {
  computeAnalytics,
  generateFullPath,
  pathToNode,
  recommendNext,
} from './tree-engine'
import { loadTreeForPack } from './tree-store'
import type {
  KnowledgeTree,
  LearningPath,
  RecommendedNode,
  TreeAnalytics,
} from './tree-types'

export interface UseKnowledgeTreeOptions {
  /** Subject/pack identifier */
  packId: string
  /** Active eras from the current context */
  eras: Era[]
  /** Current user progress keyed by era ID */
  progress: Record<string, number>
  /** Embedded tree from the subject pack payload (if any) */
  embeddedTree?: KnowledgeTree
  /** Maximum recommendations to return */
  recommendationCount?: number
  /** Preferred groups for recommendation scoring */
  preferredGroups?: string[]
}

export interface KnowledgeTreeState {
  /** The resolved knowledge tree (from pack or auto-generated) */
  tree: KnowledgeTree | null
  /** How the tree was sourced */
  treeSource: 'pack-embedded' | 'auto-generated' | 'cached' | null
  /** Top recommended next nodes */
  recommendations: RecommendedNode[]
  /** The single best recommended node */
  topRecommendation: RecommendedNode | null
  /** Full learning path through remaining nodes */
  fullPath: LearningPath | null
  /** Comprehensive analytics */
  analytics: TreeAnalytics | null
  /** Get the optimal path to a specific target node */
  getPathTo: (targetNodeId: string) => LearningPath | null
}

/**
 * React hook providing knowledge tree state and recommendations.
 *
 * The tree is loaded (or auto-generated) once per pack + eras combination,
 * then recommendations and analytics are recomputed whenever progress changes.
 */
export function useKnowledgeTree(options: UseKnowledgeTreeOptions): KnowledgeTreeState {
  const {
    packId,
    eras,
    progress,
    embeddedTree,
    recommendationCount = 3,
    preferredGroups,
  } = options

  // Load or generate tree (memoized on packId + eras identity)
  const { tree, treeSource } = useMemo(() => {
    if (eras.length === 0) return { tree: null, treeSource: null as KnowledgeTreeState['treeSource'] }

    const result = loadTreeForPack(packId, eras, embeddedTree)
    return {
      tree: result.tree,
      treeSource: result.source,
    }
  }, [packId, eras, embeddedTree])

  // Compute recommendations (reacts to progress changes)
  const recommendations = useMemo(() => {
    if (!tree) return []
    return recommendNext(tree, progress, {
      count: recommendationCount,
      preferredGroups,
    })
  }, [tree, progress, recommendationCount, preferredGroups])

  const topRecommendation = recommendations.length > 0 ? recommendations[0] : null

  // Compute full learning path
  const fullPath = useMemo(() => {
    if (!tree) return null
    return generateFullPath(tree, progress)
  }, [tree, progress])

  // Compute analytics
  const analytics = useMemo(() => {
    if (!tree) return null
    return computeAnalytics(tree, progress)
  }, [tree, progress])

  // Path-to-node helper (stable reference)
  const getPathTo = useCallback(
    (targetNodeId: string): LearningPath | null => {
      if (!tree) return null
      return pathToNode(tree, targetNodeId, progress)
    },
    [tree, progress],
  )

  return {
    tree,
    treeSource,
    recommendations,
    topRecommendation,
    fullPath,
    analytics,
    getPathTo,
  }
}
