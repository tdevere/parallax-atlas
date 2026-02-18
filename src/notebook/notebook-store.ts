import type { NotebookEntry } from './notebook-types'

const STORAGE_KEY = 'knowledge-timeline-notebook'

export class NotebookStore {
  load(): NotebookEntry[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed as NotebookEntry[]
    } catch {
      return []
    }
  }

  save(entries: NotebookEntry[]): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }

  append(entry: NotebookEntry): NotebookEntry[] {
    const entries = this.load()
    entries.push(entry)
    this.save(entries)
    return entries
  }

  clear(): void {
    window.localStorage.removeItem(STORAGE_KEY)
  }

  /** Return the learner's personal cross-era connection graph from insight/connection entries */
  getLearnerInsightGraph(): Map<string, Set<string>> {
    const entries = this.load()
    const graph = new Map<string, Set<string>>()

    for (const entry of entries) {
      if (entry.linkedEraIds && entry.linkedEraIds.length > 0) {
        if (!graph.has(entry.eraId)) graph.set(entry.eraId, new Set())
        for (const linkedId of entry.linkedEraIds) {
          graph.get(entry.eraId)!.add(linkedId)
        }
      }
    }

    return graph
  }

  /** Return all insight/question entries for reflection */
  getInsights(): NotebookEntry[] {
    return this.load().filter(
      (entry) => entry.action === 'insight' || entry.action === 'question' || entry.action === 'connection-made',
    )
  }
}

export function generateEntryId(): string {
  return `nb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function exportNotebookMarkdown(entries: NotebookEntry[]): string {
  const lines: string[] = [
    '# Parallax Atlas Learning Notebook',
    '',
    `Exported: ${new Date().toLocaleString()}`,
    '',
    `Total entries: ${entries.length}`,
    '',
    '---',
    '',
  ]

  const byEra = new Map<string, NotebookEntry[]>()
  for (const entry of entries) {
    const key = `${entry.eraGroup} — ${entry.eraContent}`
    if (!byEra.has(key)) byEra.set(key, [])
    byEra.get(key)!.push(entry)
  }

  for (const [eraLabel, eraEntries] of byEra) {
    lines.push(`## ${eraLabel}`)
    lines.push('')
    for (const entry of eraEntries) {
      const time = new Date(entry.timestamp).toLocaleString()
      const actionLabel = entry.action.replace(/-/g, ' ')
      let line = `- **${actionLabel}** at ${time}`
      if (entry.sourceTitle) {
        line += ` — [${entry.sourceTitle}](${entry.sourceUrl})`
      }
      if (entry.note) {
        line += ` — _"${entry.note}"_`
      }
      if (entry.progressAtTime !== undefined) {
        line += ` (progress: ${entry.progressAtTime}%)`
      }
      lines.push(line)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function exportNotebookJSON(entries: NotebookEntry[]): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)
}
