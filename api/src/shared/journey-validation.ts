/**
 * Validation helpers for journey pack payloads.
 *
 * Mirrors the client-side pack-loader.ts validation rules with enhancements
 * for subtopics and keyLocations.
 */

import type { JourneyEra, JourneyPackPayload } from './journey-types.js'

function isValidEra(value: unknown): value is JourneyEra {
  if (!value || typeof value !== 'object') return false
  const era = value as Record<string, unknown>
  return (
    typeof era.id === 'string' && era.id.length > 0 &&
    typeof era.content === 'string' && era.content.length > 0 &&
    typeof era.group === 'string' && era.group.length > 0 &&
    typeof era.start === 'number' && typeof era.end === 'number' &&
    Number.isFinite(era.start) && Number.isFinite(era.end) &&
    era.start >= era.end
  )
}

/**
 * Validate a JourneyPackPayload. Returns null if valid, or an error message.
 * Also auto-fixes missing progress entries.
 */
export function validateJourneyPack(payload: JourneyPackPayload): string | null {
  if (!payload.id || typeof payload.id !== 'string') return 'Missing pack id'
  if (!payload.name || typeof payload.name !== 'string') return 'Missing pack name'
  if (!payload.context) return 'Missing context'
  if (!Array.isArray(payload.context.eras) || payload.context.eras.length === 0) {
    return 'No eras generated'
  }

  for (const era of payload.context.eras) {
    if (!isValidEra(era)) {
      return `Invalid era: ${JSON.stringify(era).slice(0, 120)}`
    }
  }

  // Check for duplicate IDs
  const ids = new Set<string>()
  for (const era of payload.context.eras) {
    if (ids.has(era.id)) return `Duplicate era id: ${era.id}`
    ids.add(era.id)
  }

  // Validate prerequisiteIds reference existing eras
  for (const era of payload.context.eras) {
    if (era.prerequisiteIds) {
      for (const prereqId of era.prerequisiteIds) {
        if (!ids.has(prereqId)) {
          return `Era '${era.id}' references unknown prerequisite '${prereqId}'`
        }
      }
    }
  }

  // Validate connection targets
  for (const era of payload.context.eras) {
    if (era.connections) {
      for (const conn of era.connections) {
        if (!ids.has(conn.targetEraId)) {
          return `Era '${era.id}' has connection to unknown era '${conn.targetEraId}'`
        }
      }
    }
  }

  // Auto-fix: ensure progress covers all eras
  if (payload.context.progress) {
    for (const era of payload.context.eras) {
      if (typeof payload.context.progress[era.id] !== 'number') {
        payload.context.progress[era.id] = 0
      }
    }
  } else {
    payload.context.progress = payload.context.eras.reduce<Record<string, number>>((acc, era) => {
      acc[era.id] = 0
      return acc
    }, {})
  }

  // Ensure persistence is memory for generated packs
  payload.context.persistence = 'memory'

  return null
}
