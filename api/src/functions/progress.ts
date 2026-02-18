/**
 * GET /api/progress/{packId}  — load user progress for a subject pack
 * PUT /api/progress/{packId}  — save user progress for a subject pack
 */

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getContainer, parseClientPrincipal, type UserProgressDoc } from '../shared/cosmos.js'

async function getProgress(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return { status: 401, body: 'Unauthorized' }

  const packId = request.params.packId
  if (!packId) return { status: 400, body: 'Missing packId' }

  const container = getContainer()
  const docId = `progress:${principal.userId}:${packId}`

  try {
    const { resource } = await container.item(docId, principal.userId).read<UserProgressDoc>()
    if (!resource) {
      return { status: 200, jsonBody: { progress: {} } }
    }
    return { status: 200, jsonBody: { progress: resource.progress, updatedAt: resource.updatedAt } }
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 404) {
      return { status: 200, jsonBody: { progress: {} } }
    }
    throw err
  }
}

async function putProgress(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return { status: 401, body: 'Unauthorized' }

  const packId = request.params.packId
  if (!packId) return { status: 400, body: 'Missing packId' }

  const body = await request.json() as { progress?: Record<string, number> }
  if (!body.progress || typeof body.progress !== 'object') {
    return { status: 400, body: 'Invalid progress payload' }
  }

  const container = getContainer()
  const docId = `progress:${principal.userId}:${packId}`

  const doc: UserProgressDoc = {
    id: docId,
    userId: principal.userId,
    packId,
    docType: 'progress',
    progress: body.progress,
    updatedAt: new Date().toISOString(),
  }

  await container.items.upsert(doc)
  return { status: 200, jsonBody: { ok: true, updatedAt: doc.updatedAt } }
}

app.http('getProgress', {
  methods: ['GET'],
  route: 'progress/{packId}',
  authLevel: 'anonymous',
  handler: getProgress,
})

app.http('putProgress', {
  methods: ['PUT'],
  route: 'progress/{packId}',
  authLevel: 'anonymous',
  handler: putProgress,
})
