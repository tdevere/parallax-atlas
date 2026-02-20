/**
 * Journey generation endpoints:
 *
 *   POST /api/journey         — generate a new learning journey from a topic
 *   GET  /api/journey/{id}    — load a saved journey
 *   GET  /api/journeys        — list user's journeys
 *   POST /api/journey/{id}/refine — refine an existing journey (stub for Phase 3)
 */

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getContainer, parseClientPrincipal } from '../shared/cosmos.js'
import { callLLM, extractJSON, resolveLLMConfig } from '../shared/journey-llm.js'
import {
  buildGenerateSystemPrompt,
  buildGenerateUserPrompt,
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
} from '../shared/journey-prompts.js'
import type {
  GenerateJourneyRequest,
  GenerateJourneyResponse,
  JourneyDoc,
  JourneyListItem,
  JourneyPackPayload,
  RefineJourneyRequest,
  RefineJourneyResponse,
} from '../shared/journey-types.js'
import { validateJourneyPack } from '../shared/journey-validation.js'

// ── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${timestamp}-${random}`
}

function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function errorResponse(status: number, message: string): HttpResponseInit {
  return jsonResponse(status, { error: message })
}

// ── POST /api/journey ──────────────────────────────────────────────

async function generateJourney(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  // 1. Resolve LLM config
  const llmConfig = resolveLLMConfig()
  if (!llmConfig) {
    return errorResponse(503, 'Journey generation is not configured. No LLM API key available.')
  }

  // 2. Parse request body
  let body: GenerateJourneyRequest
  try {
    body = (await request.json()) as GenerateJourneyRequest
  } catch {
    return errorResponse(400, 'Invalid JSON request body')
  }

  if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length === 0) {
    return errorResponse(400, 'Missing required field: topic')
  }

  const topic = body.topic.trim().slice(0, 200) // Cap topic length
  const level = body.level ?? 'intro'
  const eraCount = Math.min(Math.max(body.eraCount ?? 8, 3), 20) // Clamp 3-20

  if (!['intro', 'intermediate', 'advanced'].includes(level)) {
    return errorResponse(400, 'Invalid level. Must be: intro, intermediate, or advanced')
  }

  // 3. Build prompts and call LLM
  const systemPrompt = buildGenerateSystemPrompt()
  const userPrompt = buildGenerateUserPrompt({
    topic,
    level,
    eraCount,
    priorKnowledge: body.priorKnowledge?.slice(0, 500),
  })

  context.log(`Generating journey for topic="${topic}" level=${level} eras=${eraCount}`)

  let rawResponse: string
  try {
    rawResponse = await callLLM(llmConfig, systemPrompt, userPrompt)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    context.error(`LLM call failed: ${message}`)
    return errorResponse(502, `LLM call failed: ${message}`)
  }

  // 4. Parse and validate the generated pack
  const jsonString = extractJSON(rawResponse)
  let pack: JourneyPackPayload

  try {
    pack = JSON.parse(jsonString) as JourneyPackPayload
  } catch {
    context.error(`Failed to parse LLM response as JSON. Start: ${rawResponse.slice(0, 200)}`)
    return errorResponse(502, 'LLM returned invalid JSON. Please try again.')
  }

  const validationError = validateJourneyPack(pack)
  if (validationError) {
    context.error(`Pack validation failed: ${validationError}`)
    return errorResponse(502, `Generated pack is invalid: ${validationError}. Please try again.`)
  }

  // 5. Build response
  const journeyId = generateId()
  const now = new Date().toISOString()

  const response: GenerateJourneyResponse = {
    journeyId,
    pack,
    generatorModel: llmConfig.model,
    createdAt: now,
  }

  // 6. If authenticated, persist to Cosmos
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (principal) {
    const doc: JourneyDoc = {
      id: `journey:${principal.userId}:${journeyId}`,
      userId: principal.userId,
      journeyId,
      docType: 'journey',
      topic,
      level,
      pack,
      versions: [
        {
          version: 1,
          action: 'generate',
          description: `Generated ${level}-level journey for "${topic}" with ${pack.context.eras.length} eras`,
          timestamp: now,
          packSnapshot: pack,
        },
      ],
      createdAt: now,
      updatedAt: now,
      generatorModel: llmConfig.model,
    }

    try {
      const container = getContainer()
      await container.items.upsert(doc)
      context.log(`Persisted journey ${journeyId} for user ${principal.userId}`)
    } catch (err) {
      // Non-fatal: return the pack even if persistence fails
      context.warn(`Failed to persist journey: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return jsonResponse(200, response)
}

// ── GET /api/journey/{journeyId} ───────────────────────────────────

async function getJourney(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return errorResponse(401, 'Authentication required to load saved journeys')

  const journeyId = request.params.journeyId
  if (!journeyId) return errorResponse(400, 'Missing journeyId')

  const container = getContainer()
  const docId = `journey:${principal.userId}:${journeyId}`

  try {
    const { resource } = await container.item(docId, principal.userId).read<JourneyDoc>()
    if (!resource) return errorResponse(404, 'Journey not found')

    return jsonResponse(200, {
      journeyId: resource.journeyId,
      topic: resource.topic,
      level: resource.level,
      pack: resource.pack,
      versions: resource.versions.length,
      generatorModel: resource.generatorModel,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    })
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 404) {
      return errorResponse(404, 'Journey not found')
    }
    throw err
  }
}

// ── GET /api/journeys ──────────────────────────────────────────────

async function listJourneys(
  request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return errorResponse(401, 'Authentication required to list journeys')

  const container = getContainer()
  const query = {
    query: "SELECT c.journeyId, c.topic, c.level, c.createdAt, c.updatedAt FROM c WHERE c.userId = @userId AND c.docType = 'journey' ORDER BY c.updatedAt DESC",
    parameters: [{ name: '@userId', value: principal.userId }],
  }

  const { resources } = await container.items.query<JourneyDoc>(query).fetchAll()

  const items: JourneyListItem[] = resources.map((doc) => ({
    journeyId: doc.journeyId,
    topic: doc.topic,
    level: doc.level,
    eraCount: doc.pack?.context?.eras?.length ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }))

  return jsonResponse(200, { journeys: items })
}

// ── POST /api/journey/{journeyId}/refine ───────────────────────────

async function refineJourney(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return errorResponse(401, 'Authentication required to refine journeys')

  const journeyId = request.params.journeyId
  if (!journeyId) return errorResponse(400, 'Missing journeyId')

  const llmConfig = resolveLLMConfig()
  if (!llmConfig) return errorResponse(503, 'Journey refinement is not configured. No LLM API key available.')

  let body: RefineJourneyRequest
  try {
    body = (await request.json()) as RefineJourneyRequest
  } catch {
    return errorResponse(400, 'Invalid JSON request body')
  }

  if (!body.instruction || typeof body.instruction !== 'string' || body.instruction.trim().length === 0) {
    return errorResponse(400, 'Missing required field: instruction')
  }

  const instruction = body.instruction.trim().slice(0, 1000)

  // Load existing journey
  const container = getContainer()
  const docId = `journey:${principal.userId}:${journeyId}`

  let doc: JourneyDoc
  try {
    const { resource } = await container.item(docId, principal.userId).read<JourneyDoc>()
    if (!resource) return errorResponse(404, 'Journey not found')
    doc = resource
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 404) {
      return errorResponse(404, 'Journey not found')
    }
    throw err
  }

  // Call LLM with refine prompt
  const systemPrompt = buildRefineSystemPrompt()
  const userPrompt = buildRefineUserPrompt(doc.pack, { instruction })

  context.log(`Refining journey ${journeyId}: "${instruction.slice(0, 80)}"`)

  let rawResponse: string
  try {
    rawResponse = await callLLM(llmConfig, systemPrompt, userPrompt)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    context.error(`LLM refine call failed: ${message}`)
    return errorResponse(502, `LLM call failed: ${message}`)
  }

  const jsonString = extractJSON(rawResponse)
  let refinedPack: JourneyPackPayload

  try {
    refinedPack = JSON.parse(jsonString) as JourneyPackPayload
  } catch {
    return errorResponse(502, 'LLM returned invalid JSON during refinement. Please try again.')
  }

  const validationError = validateJourneyPack(refinedPack)
  if (validationError) {
    return errorResponse(502, `Refined pack is invalid: ${validationError}. Please try again.`)
  }

  // Preserve progress from current pack where era IDs match
  const currentProgress = doc.pack.context.progress ?? {}
  for (const eraId of Object.keys(refinedPack.context.progress)) {
    if (currentProgress[eraId] !== undefined) {
      refinedPack.context.progress[eraId] = currentProgress[eraId]
    }
  }

  // Update Cosmos document
  const now = new Date().toISOString()
  const nextVersion = doc.versions.length + 1

  doc.pack = refinedPack
  doc.versions.push({
    version: nextVersion,
    action: 'refine',
    description: instruction,
    timestamp: now,
    packSnapshot: refinedPack,
  })
  doc.updatedAt = now

  await container.items.upsert(doc)

  const response: RefineJourneyResponse = {
    version: nextVersion,
    pack: refinedPack,
    description: instruction,
    updatedAt: now,
  }

  return jsonResponse(200, response)
}

// ── Register routes ────────────────────────────────────────────────

app.http('generateJourney', {
  methods: ['POST'],
  route: 'journey',
  authLevel: 'anonymous',
  handler: generateJourney,
})

app.http('getJourney', {
  methods: ['GET'],
  route: 'journey/{journeyId}',
  authLevel: 'anonymous',
  handler: getJourney,
})

app.http('listJourneys', {
  methods: ['GET'],
  route: 'journeys',
  authLevel: 'anonymous',
  handler: listJourneys,
})

app.http('refineJourney', {
  methods: ['POST'],
  route: 'journey/{journeyId}/refine',
  authLevel: 'anonymous',
  handler: refineJourney,
})
