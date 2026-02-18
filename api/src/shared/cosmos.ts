/**
 * Cosmos DB client shared across all Azure Functions.
 */

import { CosmosClient, type Container } from '@azure/cosmos'

let _client: CosmosClient | null = null
let _container: Container | null = null

const DATABASE_NAME = 'parallax-data'
const CONTAINER_NAME = 'user-data'

function getConnectionString(): string {
  const connStr = process.env.COSMOS_CONNECTION_STRING
  if (!connStr) throw new Error('COSMOS_CONNECTION_STRING not set')
  return connStr
}

export function getContainer(): Container {
  if (_container) return _container

  _client = new CosmosClient(getConnectionString())
  _container = _client.database(DATABASE_NAME).container(CONTAINER_NAME)
  return _container
}

// ── Document types ─────────────────────────────────────────────────────

export interface UserProgressDoc {
  id: string // `progress:${userId}:${packId}`
  userId: string
  packId: string
  docType: 'progress'
  progress: Record<string, number>
  updatedAt: string
}

export interface UserNotebookDoc {
  id: string // `notebook:${userId}`
  userId: string
  docType: 'notebook'
  entries: NotebookEntryDoc[]
  updatedAt: string
}

export interface NotebookEntryDoc {
  id: string
  timestamp: string
  eraId: string
  eraContent: string
  eraGroup: string
  sourceId?: string
  sourceTitle?: string
  sourceUrl?: string
  sourceFormat?: string
  action: string
  note?: string
  progressAtTime?: number
  linkedEraIds?: string[]
  tags?: string[]
}

// ── Auth helper ────────────────────────────────────────────────────────

export interface ClientPrincipal {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
}

export function parseClientPrincipal(header: string | null): ClientPrincipal | null {
  if (!header) return null
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8')
    return JSON.parse(decoded) as ClientPrincipal
  } catch {
    return null
  }
}
