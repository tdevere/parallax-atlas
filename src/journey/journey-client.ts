/**
 * Client-side wrapper for the Journey Generation API.
 *
 * These functions call the server-side Azure Function endpoints.
 * In local dev (without SWA), calls go to /api/* and will 404 unless
 * the Azure Functions backend is running locally.
 */

import type { SubjectPackPayload } from '../viewer/types'

// ── Types (mirrors server response shapes) ─────────────────────────

export interface GenerateJourneyRequest {
  topic: string
  level?: 'intro' | 'intermediate' | 'advanced'
  eraCount?: number
  priorKnowledge?: string
}

export interface GenerateJourneyResponse {
  journeyId: string
  pack: SubjectPackPayload
  generatorModel: string
  createdAt: string
}

export interface JourneyListItem {
  journeyId: string
  topic: string
  level: string
  eraCount: number
  createdAt: string
  updatedAt: string
}

export interface RefineJourneyRequest {
  instruction: string
}

export interface RefineJourneyResponse {
  version: number
  pack: SubjectPackPayload
  description: string
  updatedAt: string
}

// ── API calls ──────────────────────────────────────────────────────

const API_BASE = '/api'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    let errorMessage: string
    try {
      const body = (await response.json()) as { error?: string }
      errorMessage = body.error ?? `API error ${response.status}`
    } catch {
      errorMessage = `API error ${response.status}: ${await response.text().catch(() => 'Unknown error')}`
    }
    throw new Error(errorMessage)
  }

  return (await response.json()) as T
}

/**
 * Generate a new learning journey from a topic.
 * Works for both authenticated users (persisted) and guests (ephemeral).
 */
export async function createJourney(
  request: GenerateJourneyRequest,
): Promise<GenerateJourneyResponse> {
  return apiFetch<GenerateJourneyResponse>('/journey', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/** Load a saved journey by ID (requires authentication). */
export async function loadJourney(
  journeyId: string,
): Promise<GenerateJourneyResponse> {
  return apiFetch<GenerateJourneyResponse>(`/journey/${encodeURIComponent(journeyId)}`)
}

/** List all journeys for the current user (requires authentication). */
export async function listJourneys(): Promise<{ journeys: JourneyListItem[] }> {
  return apiFetch<{ journeys: JourneyListItem[] }>('/journeys')
}

/** Refine an existing journey with natural language instructions (requires authentication). */
export async function refineJourney(
  journeyId: string,
  request: RefineJourneyRequest,
): Promise<RefineJourneyResponse> {
  return apiFetch<RefineJourneyResponse>(`/journey/${encodeURIComponent(journeyId)}/refine`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
