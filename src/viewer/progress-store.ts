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
