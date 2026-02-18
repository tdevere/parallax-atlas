/**
 * GET  /api/notebook       — load user notebook entries
 * POST /api/notebook       — append a notebook entry
 * DELETE /api/notebook     — clear all notebook entries
 */

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getContainer, parseClientPrincipal, type NotebookEntryDoc, type UserNotebookDoc } from '../shared/cosmos.js'

async function getNotebook(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return { status: 401, body: 'Unauthorized' }

  const container = getContainer()
  const docId = `notebook:${principal.userId}`

  try {
    const { resource } = await container.item(docId, principal.userId).read<UserNotebookDoc>()
    if (!resource) {
      return { status: 200, jsonBody: { entries: [] } }
    }
    return { status: 200, jsonBody: { entries: resource.entries, updatedAt: resource.updatedAt } }
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 404) {
      return { status: 200, jsonBody: { entries: [] } }
    }
    throw err
  }
}

async function postNotebook(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return { status: 401, body: 'Unauthorized' }

  const body = await request.json() as { entry?: NotebookEntryDoc }
  if (!body.entry || !body.entry.id || !body.entry.eraId) {
    return { status: 400, body: 'Invalid notebook entry' }
  }

  const container = getContainer()
  const docId = `notebook:${principal.userId}`

  let existing: UserNotebookDoc | undefined
  try {
    const { resource } = await container.item(docId, principal.userId).read<UserNotebookDoc>()
    existing = resource
  } catch (err: unknown) {
    if ((err as { code?: number }).code !== 404) throw err
  }

  const entries = existing?.entries ?? []
  entries.push(body.entry)

  const doc: UserNotebookDoc = {
    id: docId,
    userId: principal.userId,
    docType: 'notebook',
    entries,
    updatedAt: new Date().toISOString(),
  }

  await container.items.upsert(doc)
  return { status: 200, jsonBody: { ok: true, entryCount: entries.length, updatedAt: doc.updatedAt } }
}

async function deleteNotebook(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request.headers.get('x-ms-client-principal'))
  if (!principal) return { status: 401, body: 'Unauthorized' }

  const container = getContainer()
  const docId = `notebook:${principal.userId}`

  try {
    await container.item(docId, principal.userId).delete()
  } catch (err: unknown) {
    if ((err as { code?: number }).code !== 404) throw err
  }

  return { status: 200, jsonBody: { ok: true } }
}

app.http('getNotebook', {
  methods: ['GET'],
  route: 'notebook',
  authLevel: 'anonymous',
  handler: getNotebook,
})

app.http('postNotebook', {
  methods: ['POST'],
  route: 'notebook',
  authLevel: 'anonymous',
  handler: postNotebook,
})

app.http('deleteNotebook', {
  methods: ['DELETE'],
  route: 'notebook',
  authLevel: 'anonymous',
  handler: deleteNotebook,
})
