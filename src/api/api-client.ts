/**
 * API client — typed wrapper for the /api/* Azure Functions endpoints.
 *
 * All methods return null on network/auth failure so callers can fall back
 * gracefully to localStorage.
 */

// ── Progress ───────────────────────────────────────────────────────────

export interface ProgressApiResponse {
  progress: Record<string, number>
  updatedAt?: string
}

export async function fetchProgress(packId: string): Promise<ProgressApiResponse | null> {
  try {
    const res = await fetch(`/api/progress/${encodeURIComponent(packId)}`)
    if (!res.ok) return null
    return (await res.json()) as ProgressApiResponse
  } catch {
    return null
  }
}

export async function saveProgress(packId: string, progress: Record<string, number>): Promise<boolean> {
  try {
    const res = await fetch(`/api/progress/${encodeURIComponent(packId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Notebook ───────────────────────────────────────────────────────────

export interface NotebookEntry {
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

export interface NotebookApiResponse {
  entries: NotebookEntry[]
  updatedAt?: string
}

export async function fetchNotebook(): Promise<NotebookApiResponse | null> {
  try {
    const res = await fetch('/api/notebook')
    if (!res.ok) return null
    return (await res.json()) as NotebookApiResponse
  } catch {
    return null
  }
}

export async function appendNotebookEntry(entry: NotebookEntry): Promise<boolean> {
  try {
    const res = await fetch('/api/notebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function clearNotebookRemote(): Promise<boolean> {
  try {
    const res = await fetch('/api/notebook', { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}
