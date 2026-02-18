/**
 * Knowledge Tree Engine — graph traversal, recommendation, and path generation.
 *
 * Pure functions that operate on a KnowledgeTree + user progress to produce
 * personalized recommendations, optimal learning paths, and analytics.
 */

import type {
  DifficultyTier,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeTree,
  LearningPath,
  RecommendedNode,
  TreeAnalytics,
  UserNodeOverlay,
} from './tree-types'
import { progressToMastery } from './tree-types'

// ── Graph primitives ───────────────────────────────────────────────────

/** Build an adjacency list from edges */
function buildAdjacency(tree: KnowledgeTree): {
  children: Map<string, KnowledgeEdge[]>
  parents: Map<string, KnowledgeEdge[]>
  nodeMap: Map<string, KnowledgeNode>
} {
  const children = new Map<string, KnowledgeEdge[]>()
  const parents = new Map<string, KnowledgeEdge[]>()
  const nodeMap = new Map<string, KnowledgeNode>()

  for (const node of tree.nodes) {
    nodeMap.set(node.id, node)
    children.set(node.id, [])
    parents.set(node.id, [])
  }

  for (const edge of tree.edges) {
    children.get(edge.from)?.push(edge)
    parents.get(edge.to)?.push(edge)
  }

  return { children, parents, nodeMap }
}

/** Topological sort (Kahn's algorithm). Returns ordered node IDs. */
export function topologicalSort(tree: KnowledgeTree): string[] {
  const { children, nodeMap } = buildAdjacency(tree)
  const inDegree = new Map<string, number>()

  for (const node of tree.nodes) {
    inDegree.set(node.id, 0)
  }
  for (const edge of tree.edges) {
    if (edge.kind === 'prerequisite') {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  // Sort initial queue by difficulty for stable ordering
  queue.sort((a, b) => {
    const nodeA = nodeMap.get(a)
    const nodeB = nodeMap.get(b)
    return (nodeA?.difficulty ?? 1) - (nodeB?.difficulty ?? 1)
  })

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)

    for (const edge of children.get(current) ?? []) {
      if (edge.kind !== 'prerequisite') continue
      const newDeg = (inDegree.get(edge.to) ?? 1) - 1
      inDegree.set(edge.to, newDeg)
      if (newDeg === 0) {
        queue.push(edge.to)
        // Re-sort queue for stable ordering
        queue.sort((a, b) => {
          const nodeA = nodeMap.get(a)
          const nodeB = nodeMap.get(b)
          return (nodeA?.difficulty ?? 1) - (nodeB?.difficulty ?? 1)
        })
      }
    }
  }

  return sorted
}

// ── Recommendation engine ──────────────────────────────────────────────

/**
 * Get prerequisite node IDs that aren't yet mastered (progress < 75).
 */
function getUnmetPrereqs(
  nodeId: string,
  progress: Record<string, number>,
  parents: Map<string, KnowledgeEdge[]>,
): string[] {
  const prereqEdges = (parents.get(nodeId) ?? []).filter((e) => e.kind === 'prerequisite')
  return prereqEdges
    .filter((e) => (progress[e.from] ?? 0) < 75)
    .map((e) => e.from)
}

/**
 * Calculate a learning-gain score for a node.
 * Higher scores mean "this node will unlock the most future learning."
 */
function learningGainScore(
  nodeId: string,
  children: Map<string, KnowledgeEdge[]>,
  progress: Record<string, number>,
): number {
  const outEdges = (children.get(nodeId) ?? []).filter((e) => e.kind === 'prerequisite')
  // Count how many downstream nodes are blocked by this one
  let blockedCount = 0
  for (const edge of outEdges) {
    if ((progress[edge.to] ?? 0) < 25) {
      blockedCount += edge.strength
    }
  }
  return blockedCount
}

/**
 * Recommend next nodes to study based on:
 * 1. Prerequisites met (ready to learn)
 * 2. Learning gain (unlocks the most downstream concepts)
 * 3. Difficulty alignment (prefer nodes near user's current level)
 * 4. Low current progress (prioritize unstarted/early nodes)
 */
export function recommendNext(
  tree: KnowledgeTree,
  progress: Record<string, number>,
  options: {
    count?: number
    maxDifficulty?: DifficultyTier
    preferredGroups?: string[]
    skipNodeIds?: string[]
  } = {},
): RecommendedNode[] {
  const { count = 3, maxDifficulty = 5, preferredGroups, skipNodeIds = [] } = options
  const { children, parents, nodeMap } = buildAdjacency(tree)
  const skipSet = new Set(skipNodeIds)

  const candidates: RecommendedNode[] = []

  for (const node of tree.nodes) {
    const currentProgress = progress[node.id] ?? 0
    if (currentProgress >= 100) continue // Already mastered
    if (skipSet.has(node.id)) continue
    if (node.difficulty > maxDifficulty) continue

    const unmetPrereqs = getUnmetPrereqs(node.id, progress, parents)
    const prereqsMet = unmetPrereqs.length === 0
    const gain = learningGainScore(node.id, children, progress)

    // Score components
    let score = 0

    // Strong boost if all prereqs met (ready to learn)
    if (prereqsMet) score += 0.5

    // Learning gain: higher = more downstream impact (0-0.3)
    score += Math.min(gain * 0.1, 0.3)

    // Prefer lower difficulty nodes that are accessible (0-0.1)
    score += (5 - node.difficulty) * 0.02

    // Prefer nodes with some progress over completely unstarted (momentum)
    if (currentProgress > 0 && currentProgress < 100) score += 0.1

    // Group preference bonus
    if (preferredGroups?.includes(node.group)) score += 0.05

    // Penalty for unmet prereqs
    score -= unmetPrereqs.length * 0.15

    const reason = prereqsMet
      ? currentProgress > 0
        ? `Continue ${nodeMap.get(node.id)?.title ?? node.id} — you're ${currentProgress}% through.`
        : gain > 0
          ? `Start ${nodeMap.get(node.id)?.title ?? node.id} — unlocks ${gain.toFixed(0)} downstream concepts.`
          : `Begin ${nodeMap.get(node.id)?.title ?? node.id} — all prerequisites met.`
      : `${nodeMap.get(node.id)?.title ?? node.id} has ${unmetPrereqs.length} prerequisite(s) remaining.`

    candidates.push({
      nodeId: node.id,
      reason,
      score,
      learningGain: gain,
      unmetPrereqs,
    })
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, count)
}

// ── Path generation ────────────────────────────────────────────────────

/**
 * Generate the optimal learning path from current progress to a target node.
 * Uses prerequisite edges to build the shortest dependency chain, skipping mastered nodes.
 */
export function pathToNode(
  tree: KnowledgeTree,
  targetNodeId: string,
  progress: Record<string, number>,
): LearningPath | null {
  const { parents, nodeMap } = buildAdjacency(tree)

  if (!nodeMap.has(targetNodeId)) return null

  // BFS backward from target, collecting unmastered prereqs
  const visited = new Set<string>()
  const queue = [targetNodeId]
  const required: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const currentProgress = progress[current] ?? 0
    if (currentProgress >= 100 && current !== targetNodeId) continue // Already mastered, skip

    required.push(current)

    for (const edge of parents.get(current) ?? []) {
      if (edge.kind !== 'prerequisite') continue
      if ((progress[edge.from] ?? 0) < 100) {
        queue.push(edge.from)
      }
    }
  }

  // Order by topological sort
  const topoOrder = topologicalSort(tree)
  const orderMap = new Map(topoOrder.map((id, idx) => [id, idx]))
  const orderedPath = required.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0))

  const totalMinutes = orderedPath.reduce((sum, id) => {
    const node = nodeMap.get(id)
    return sum + (node?.estimatedMinutes ?? 15)
  }, 0)

  const avgDifficulty = orderedPath.reduce((sum, id) => {
    const node = nodeMap.get(id)
    return sum + (node?.difficulty ?? 1)
  }, 0) / Math.max(orderedPath.length, 1)

  const targetNode = nodeMap.get(targetNodeId)

  return {
    nodeIds: orderedPath,
    totalMinutes,
    averageDifficulty: Math.round(avgDifficulty * 10) / 10,
    label: `Path to ${targetNode?.title ?? targetNodeId}`,
  }
}

/**
 * Generate a full learning path through the entire tree, respecting prerequisites
 * and skipping mastered nodes.
 */
export function generateFullPath(
  tree: KnowledgeTree,
  progress: Record<string, number>,
): LearningPath {
  const { nodeMap } = buildAdjacency(tree)
  const topoOrder = topologicalSort(tree)

  // Filter to only unmastered nodes
  const remaining = topoOrder.filter((id) => (progress[id] ?? 0) < 100)

  const totalMinutes = remaining.reduce((sum, id) => {
    const node = nodeMap.get(id)
    return sum + (node?.estimatedMinutes ?? 15)
  }, 0)

  const avgDifficulty = remaining.reduce((sum, id) => {
    const node = nodeMap.get(id)
    return sum + (node?.difficulty ?? 1)
  }, 0) / Math.max(remaining.length, 1)

  return {
    nodeIds: remaining,
    totalMinutes,
    averageDifficulty: Math.round(avgDifficulty * 10) / 10,
    label: `Full ${tree.subject} path (${remaining.length} remaining)`,
  }
}

// ── Analytics ──────────────────────────────────────────────────────────

/**
 * Compute comprehensive analytics for a user's progress on a tree.
 */
export function computeAnalytics(
  tree: KnowledgeTree,
  progress: Record<string, number>,
): TreeAnalytics {
  const total = tree.nodes.length
  let started = 0
  let mastered = 0
  const allSkills = new Set<string>()
  const acquiredSkills = new Set<string>()
  const groupStats: Record<string, { started: number; mastered: number; total: number }> = {}

  for (const node of tree.nodes) {
    const p = progress[node.id] ?? 0
    const state = progressToMastery(p)

    if (p > 0) started++
    if (state === 'mastered') mastered++

    // Track skills
    for (const skill of node.skillTags ?? []) {
      allSkills.add(skill)
      if (p >= 50) acquiredSkills.add(skill)
    }

    // Group stats
    if (!groupStats[node.group]) {
      groupStats[node.group] = { started: 0, mastered: 0, total: 0 }
    }
    groupStats[node.group].total++
    if (p > 0) groupStats[node.group].started++
    if (state === 'mastered') groupStats[node.group].mastered++
  }

  const recommendations = recommendNext(tree, progress, { count: 5 })

  const remainingSkills: string[] = []
  for (const skill of allSkills) {
    if (!acquiredSkills.has(skill)) remainingSkills.push(skill)
  }

  return {
    coveragePercent: total > 0 ? Math.round((started / total) * 100) : 0,
    masteryPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
    topRecommendations: recommendations,
    groupProgress: groupStats,
    acquiredSkills: [...acquiredSkills],
    remainingSkills,
  }
}

// ── Tree validation ────────────────────────────────────────────────────

export interface TreeValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate a knowledge tree for structural integrity.
 */
export function validateTree(tree: KnowledgeTree): TreeValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const nodeIds = new Set(tree.nodes.map((n) => n.id))

  // Check for duplicate node IDs
  if (nodeIds.size !== tree.nodes.length) {
    errors.push('Duplicate node IDs detected.')
  }

  // Check edges reference valid nodes
  for (const edge of tree.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references unknown source node: ${edge.from}`)
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references unknown target node: ${edge.to}`)
    }
  }

  // Check for cycles in prerequisite edges (would make topological sort impossible)
  const prereqEdges = tree.edges.filter((e) => e.kind === 'prerequisite')
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function hasCycle(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)

    const outgoing = prereqEdges.filter((e) => e.from === nodeId)
    for (const edge of outgoing) {
      if (hasCycle(edge.to)) return true
    }

    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  for (const node of tree.nodes) {
    if (hasCycle(node.id)) {
      errors.push(`Cycle detected in prerequisite graph involving: ${node.id}`)
      break
    }
  }

  // Warnings for orphan nodes (no edges at all)
  for (const node of tree.nodes) {
    const hasEdge = tree.edges.some((e) => e.from === node.id || e.to === node.id)
    if (!hasEdge) {
      warnings.push(`Node "${node.id}" has no edges — consider connecting it.`)
    }
  }

  // Check version format
  if (!/^\d+\.\d+/.test(tree.version)) {
    warnings.push(`Version "${tree.version}" doesn't follow semver pattern.`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ── Overlay helpers ────────────────────────────────────────────────────

/**
 * Build a user overlay from a knowledge tree and current progress.
 */
export function buildOverlayFromProgress(
  tree: KnowledgeTree,
  progress: Record<string, number>,
): Record<string, UserNodeOverlay> {
  const overlays: Record<string, UserNodeOverlay> = {}

  for (const node of tree.nodes) {
    const p = progress[node.id] ?? 0
    const checkpointsTotal = node.evidenceCheckpoints
    const completedCheckpoints = Math.round((p / 100) * checkpointsTotal)

    overlays[node.id] = {
      nodeId: node.id,
      progress: p,
      masteryState: progressToMastery(p),
      completedCheckpoints,
      skipped: false,
    }
  }

  return overlays
}
