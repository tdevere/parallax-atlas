/**
 * Knowledge Tree Store — load, cache, and version trees from subject packs.
 *
 * Trees are loaded from the `knowledgeTree` section of a subject pack payload.
 * They can also be built dynamically from built-in eras via `buildTreeFromEras()`.
 */

import type { Era } from '../data/timeline-data'
import type { DifficultyTier, KnowledgeEdge, KnowledgeNode, KnowledgeTree } from './tree-types'
import { validateTree, type TreeValidationResult } from './tree-engine'

// ── In-memory cache ────────────────────────────────────────────────────

const treeCache = new Map<string, KnowledgeTree>()

export function getCachedTree(subject: string): KnowledgeTree | undefined {
  return treeCache.get(subject)
}

export function setCachedTree(subject: string, tree: KnowledgeTree): void {
  treeCache.set(subject, tree)
}

export function clearTreeCache(): void {
  treeCache.clear()
}

// ── Load tree from subject pack payload ────────────────────────────────

export interface TreeLoadResult {
  tree: KnowledgeTree | null
  validation: TreeValidationResult | null
  source: 'pack-embedded' | 'auto-generated' | 'cached'
}

/**
 * Attempt to load a knowledge tree from a subject pack payload.
 * Falls back to auto-generating a tree from the pack's eras.
 */
export function loadTreeForPack(
  packId: string,
  eras: Era[],
  embeddedTree?: KnowledgeTree,
): TreeLoadResult {
  // Check cache first
  const cached = getCachedTree(packId)
  if (cached) {
    return { tree: cached, validation: null, source: 'cached' }
  }

  // If the pack embeds a knowledge tree, validate and use it
  if (embeddedTree) {
    const validation = validateTree(embeddedTree)
    if (validation.valid) {
      setCachedTree(packId, embeddedTree)
      return { tree: embeddedTree, validation, source: 'pack-embedded' }
    }
    // Invalid tree — fall through to auto-generate
  }

  // Auto-generate from eras
  const generated = buildTreeFromEras(packId, eras)
  const validation = validateTree(generated)
  setCachedTree(packId, generated)
  return { tree: generated, validation, source: 'auto-generated' }
}

// ── Auto-generate a tree from eras ─────────────────────────────────────

/**
 * Build a basic knowledge tree from existing era data.
 *
 * This creates a linear prerequisite chain within each group (by chronological order)
 * and adds influence edges between groups where eras overlap in time.
 * It's a reasonable starting point that can be refined by experts or AI.
 */
export function buildTreeFromEras(subject: string, eras: Era[]): KnowledgeTree {
  const nodes: KnowledgeNode[] = eras.map((era) => ({
    id: era.id,
    title: era.content,
    group: era.group,
    difficulty: mapDifficulty(era.difficulty),
    evidenceCheckpoints: 4,
    estimatedMinutes: era.estimatedMinutes ?? 15,
    skillTags: era.skillTags ?? [],
    whyItMatters: era.description,
    learningObjectives: era.learningObjectives ?? [],
    prereqs: era.prerequisiteIds ?? [],
  }))

  const edges: KnowledgeEdge[] = []

  // Group eras by group and sort chronologically (largest start first)
  const groups = new Map<string, Era[]>()
  for (const era of eras) {
    const list = groups.get(era.group) ?? []
    list.push(era)
    groups.set(era.group, list)
  }

  for (const [, groupEras] of groups) {
    const sorted = [...groupEras].sort((a, b) => b.start - a.start)
    // Create prerequisite chain within group
    for (let i = 0; i < sorted.length - 1; i++) {
      edges.push({
        from: sorted[i].id,
        to: sorted[i + 1].id,
        kind: 'prerequisite',
        strength: 0.8,
        rationale: `${sorted[i].content} provides chronological context for ${sorted[i + 1].content}.`,
      })
    }
  }

  // Add explicit prerequisite edges from era data
  for (const era of eras) {
    for (const prereqId of era.prerequisiteIds ?? []) {
      const alreadyExists = edges.some(
        (e) => e.from === prereqId && e.to === era.id && e.kind === 'prerequisite',
      )
      if (!alreadyExists) {
        edges.push({
          from: prereqId,
          to: era.id,
          kind: 'prerequisite',
          strength: 1.0,
          rationale: `Explicit prerequisite from era data.`,
        })
      }
    }
  }

  // Add cross-group influence edges for overlapping time periods
  const allEras = [...eras].sort((a, b) => b.start - a.start)
  for (let i = 0; i < allEras.length; i++) {
    for (let j = i + 1; j < allEras.length; j++) {
      const a = allEras[i]
      const b = allEras[j]
      if (a.group === b.group) continue

      // Check temporal overlap
      const overlap = Math.min(a.start, b.start) - Math.max(a.end, b.end)
      if (overlap > 0) {
        edges.push({
          from: a.id,
          to: b.id,
          kind: 'influence',
          strength: 0.3,
          rationale: `Temporally overlapping eras across ${a.group} and ${b.group}.`,
        })
      }
    }
  }

  // Add connection edges from era data
  for (const era of eras) {
    for (const connection of era.connections ?? []) {
      const kindMap: Record<string, KnowledgeEdge['kind']> = {
        analogy: 'contrast',
        influence: 'influence',
        contrast: 'contrast',
        application: 'application',
      }
      edges.push({
        from: era.id,
        to: connection.targetEraId,
        kind: kindMap[connection.kind] ?? 'influence',
        strength: connection.strength ?? 0.5,
      })
    }
  }

  return {
    subject,
    version: '0.1.0',
    lastUpdated: new Date().toISOString(),
    source: 'ai-generated',
    nodes,
    edges,
    metadata: {
      description: `Auto-generated knowledge tree from ${eras.length} eras.`,
    },
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function mapDifficulty(level?: string): DifficultyTier {
  switch (level) {
    case 'intro': return 1
    case 'intermediate': return 3
    case 'advanced': return 5
    default: return 2
  }
}
