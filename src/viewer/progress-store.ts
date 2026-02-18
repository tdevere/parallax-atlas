import { fetchProgress, saveProgress } from '../api/api-client'

export interface ProgressStore {
  load: () => Record<string, number> | null
  save: (progress: Record<string, number>) => void
}

export class LocalStorageProgressStore implements ProgressStore {
  private readonly key: string

  constructor(key: string) {
    this.key = key
  }

  load(): Record<string, number> | null {
    const saved = localStorage.getItem(this.key)
    if (!saved) return null

    try {
      return JSON.parse(saved) as Record<string, number>
    } catch {
      return null
    }
  }

  save(progress: Record<string, number>): void {
    localStorage.setItem(this.key, JSON.stringify(progress))
  }
}

export class MemoryProgressStore implements ProgressStore {
  private snapshot: Record<string, number> | null = null

  load(): Record<string, number> | null {
    return this.snapshot
  }

  save(progress: Record<string, number>): void {
    this.snapshot = { ...progress }
  }
}

export class NoopProgressStore implements ProgressStore {
  load(): Record<string, number> | null {
    return null
  }

  save(progress: Record<string, number>): void {
    void progress
    return
  }
}

/**
 * Remote-backed progress store with localStorage fallback.
 *
 * On load: tries API first, falls back to localStorage.
 * On save: writes to localStorage immediately (optimistic), then syncs to API in background.
 */
export class RemoteProgressStore implements ProgressStore {
  private readonly packId: string
  private readonly localKey: string
  private remoteSnapshot: Record<string, number> | null = null
  private syncPending = false

  constructor(packId: string, localKey: string) {
    this.packId = packId
    this.localKey = localKey
  }

  /** Synchronous load from localStorage (for initial render). */
  load(): Record<string, number> | null {
    if (this.remoteSnapshot) return this.remoteSnapshot

    const saved = localStorage.getItem(this.localKey)
    if (!saved) return null
    try {
      return JSON.parse(saved) as Record<string, number>
    } catch {
      return null
    }
  }

  /** Save to localStorage immediately, then queue remote sync. */
  save(progress: Record<string, number>): void {
    localStorage.setItem(this.localKey, JSON.stringify(progress))
    this.remoteSnapshot = progress
    this.syncToRemote(progress)
  }

  /** Async: hydrate from API (call once after mount). */
  async hydrate(): Promise<Record<string, number> | null> {
    const remote = await fetchProgress(this.packId)
    if (remote?.progress && Object.keys(remote.progress).length > 0) {
      this.remoteSnapshot = remote.progress
      localStorage.setItem(this.localKey, JSON.stringify(remote.progress))
      return remote.progress
    }
    return this.load()
  }

  private syncToRemote(progress: Record<string, number>): void {
    if (this.syncPending) return
    this.syncPending = true

    // Debounce: wait 1s after last save before syncing
    setTimeout(() => {
      this.syncPending = false
      void saveProgress(this.packId, progress)
    }, 1000)
  }
}
