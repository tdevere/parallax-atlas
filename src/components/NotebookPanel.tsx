import { useState } from 'react'
import type { NotebookAction, NotebookEntry } from '../notebook/notebook-types'
import { exportNotebookJSON, exportNotebookMarkdown } from '../notebook/notebook-store'
import { FORMAT_ICON } from '../sources/source-types'

interface NotebookPanelProps {
  entries: NotebookEntry[]
  onClear: () => void
  onClose: () => void
  onAddInsight?: (entry: Omit<NotebookEntry, 'id' | 'timestamp'>) => void
  /** Available eras for the cross-era linker */
  availableEras?: Array<{ id: string; content: string; group: string }>
  /** Currently focused era (pre-selects the insight's era) */
  currentEraId?: string
}

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  'viewed-source': { label: 'Viewed Source', icon: '👁️' },
  'logged-source': { label: 'Logged Source', icon: '📓' },
  'explored-era': { label: 'Explored Era', icon: '🔍' },
  'completed-mission': { label: 'Completed Mission', icon: '🏆' },
  insight: { label: 'Insight', icon: '💡' },
  question: { label: 'Question', icon: '❓' },
  'connection-made': { label: 'Connection Made', icon: '🔗' },
}

type FilterMode = 'all' | 'insights' | 'missions' | 'sources'

function SessionSummary({ entries }: { entries: NotebookEntry[] }) {
  const uniqueEras = new Set(entries.map((e) => e.eraId)).size
  const uniqueSources = new Set(entries.filter((e) => e.sourceId).map((e) => e.sourceId)).size
  const uniqueGroups = new Set(entries.map((e) => e.eraGroup)).size
  const missions = entries.filter((e) => e.action === 'completed-mission').length

  const eraFrequency = entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.eraContent] = (accumulator[entry.eraContent] ?? 0) + 1
    return accumulator
  }, {})
  const topEra = Object.entries(eraFrequency).sort(([, a], [, b]) => b - a)[0]

  return (
    <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Session Insights</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-slate-700 bg-slate-900 p-2">
          <span className="block text-lg font-bold text-cyan-300">{uniqueEras}</span>
          <span className="text-slate-400">Eras explored</span>
        </div>
        <div className="rounded border border-slate-700 bg-slate-900 p-2">
          <span className="block text-lg font-bold text-blue-300">{uniqueSources}</span>
          <span className="text-slate-400">Sources reviewed</span>
        </div>
        <div className="rounded border border-slate-700 bg-slate-900 p-2">
          <span className="block text-lg font-bold text-emerald-300">{missions}</span>
          <span className="text-slate-400">Missions completed</span>
        </div>
        <div className="rounded border border-slate-700 bg-slate-900 p-2">
          <span className="block text-lg font-bold text-amber-300">{uniqueGroups}</span>
          <span className="text-slate-400">Tracks touched</span>
        </div>
      </div>
      {topEra && (
        <p className="mt-2 text-[11px] text-slate-400">
          Most active: <span className="font-medium text-slate-200">{topEra[0]}</span> ({topEra[1]} interactions)
        </p>
      )}
    </div>
  )
}

export function NotebookPanel({ entries, onClear, onClose, onAddInsight, availableEras = [], currentEraId }: NotebookPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [showInsightForm, setShowInsightForm] = useState(false)
  const [insightType, setInsightType] = useState<'insight' | 'question' | 'connection-made'>('insight')
  const [insightNote, setInsightNote] = useState('')
  const [insightEraId, setInsightEraId] = useState(currentEraId ?? '')
  const [linkedEraIds, setLinkedEraIds] = useState<string[]>([])

  const filteredEntries = entries.filter((entry) => {
    if (filter === 'insights') return entry.action === 'insight' || entry.action === 'question' || entry.action === 'connection-made'
    if (filter === 'missions') return entry.action === 'completed-mission'
    if (filter === 'sources') return entry.action === 'logged-source' || entry.action === 'viewed-source'
    return true
  })

  const sortedEntries = [...filteredEntries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const handleExportMarkdown = () => {
    const md = exportNotebookMarkdown(entries)
    const blob = new Blob([md], { type: 'text/markdown' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'parallax-atlas-notebook.md'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleExportJSON = () => {
    const json = exportNotebookJSON(entries)
    const blob = new Blob([json], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'parallax-atlas-notebook.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    onClear()
    setConfirmClear(false)
  }

  const handleSubmitInsight = () => {
    if (!insightNote.trim() || !insightEraId || !onAddInsight) return
    const era = availableEras.find((e) => e.id === insightEraId)
    if (!era) return

    onAddInsight({
      eraId: era.id,
      eraContent: era.content,
      eraGroup: era.group,
      action: insightType as NotebookAction,
      note: insightNote.trim(),
      linkedEraIds: linkedEraIds.length > 0 ? linkedEraIds : undefined,
    })

    setInsightNote('')
    setLinkedEraIds([])
    setShowInsightForm(false)
  }

  const toggleLinkedEra = (eraId: string) => {
    setLinkedEraIds((prev) =>
      prev.includes(eraId) ? prev.filter((id) => id !== eraId) : [...prev, eraId],
    )
  }

  const insightCount = entries.filter((e) => e.action === 'insight' || e.action === 'question' || e.action === 'connection-made').length

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">📓 Learning Notebook</h2>
          <p className="text-xs text-slate-400">{entries.length} entries</p>
        </div>
        <button className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-4 py-2">
        <button
          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
          onClick={handleExportMarkdown}
          type="button"
        >
          Export .md
        </button>
        <button
          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
          onClick={handleExportJSON}
          type="button"
        >
          Export .json
        </button>
        {onAddInsight && (
          <button
            className={`rounded border px-2 py-0.5 text-[11px] transition ${
              showInsightForm ? 'border-amber-500 bg-amber-900/40 text-amber-200' : 'border-slate-600 text-slate-300 hover:border-amber-500'
            }`}
            onClick={() => setShowInsightForm((current) => !current)}
            type="button"
          >
            💡 Capture Insight {insightCount > 0 ? `(${insightCount})` : ''}
          </button>
        )}
        <button
          className={`ml-auto rounded border px-2 py-0.5 text-[11px] transition ${
            confirmClear ? 'border-rose-600 bg-rose-950/40 text-rose-200' : 'border-slate-600 text-slate-400 hover:text-rose-300'
          }`}
          onClick={handleClear}
          type="button"
        >
          {confirmClear ? 'Confirm Clear All?' : 'Clear'}
        </button>
      </div>

      {/* Insight capture form */}
      {showInsightForm && onAddInsight && (
        <div className="border-b border-amber-800/40 bg-amber-950/20 px-4 py-3">
          <div className="mb-2 flex gap-1.5">
            {(['insight', 'question', 'connection-made'] as const).map((type) => (
              <button
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                  insightType === type ? 'border-amber-500 bg-amber-900/40 text-amber-200' : 'border-slate-700 text-slate-400 hover:text-amber-300'
                }`}
                key={type}
                onClick={() => setInsightType(type)}
                type="button"
              >
                {ACTION_LABELS[type].icon} {ACTION_LABELS[type].label}
              </button>
            ))}
          </div>
          <textarea
            className="mb-2 w-full rounded border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500"
            onChange={(e) => setInsightNote(e.target.value)}
            placeholder={
              insightType === 'insight' ? 'What did you just realize?'
                : insightType === 'question' ? 'What do you want to investigate?'
                  : 'How does this connect to something else?'
            }
            rows={2}
            value={insightNote}
          />
          {availableEras.length > 0 && (
            <div className="mb-2">
              <label className="mb-1 block text-[10px] text-slate-400" htmlFor="insight-era-select">About which era?</label>
              <select
                className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                id="insight-era-select"
                onChange={(e) => setInsightEraId(e.target.value)}
                value={insightEraId}
              >
                <option value="">Select era...</option>
                {availableEras.map((era) => (
                  <option key={era.id} value={era.id}>{era.content} ({era.group})</option>
                ))}
              </select>
            </div>
          )}
          {insightType === 'connection-made' && availableEras.length > 0 && (
            <div className="mb-2">
              <label className="mb-1 block text-[10px] text-slate-400">This connects to:</label>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {availableEras.filter((e) => e.id !== insightEraId).map((era) => (
                  <button
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                      linkedEraIds.includes(era.id) ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-cyan-600'
                    }`}
                    key={era.id}
                    onClick={() => toggleLinkedEra(era.id)}
                    type="button"
                  >
                    {era.content}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            className={`w-full rounded border py-1.5 text-xs font-medium transition ${
              insightNote.trim() && insightEraId
                ? 'border-amber-600 bg-amber-900/30 text-amber-100 hover:bg-amber-800/40'
                : 'cursor-not-allowed border-slate-700 text-slate-500'
            }`}
            disabled={!insightNote.trim() || !insightEraId}
            onClick={handleSubmitInsight}
            type="button"
          >
            {ACTION_LABELS[insightType].icon} Save {ACTION_LABELS[insightType].label}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-slate-800/60 px-4 py-1.5">
        {([
          ['all', 'All', entries.length],
          ['insights', '💡 Insights', insightCount],
          ['missions', '🏆 Missions', entries.filter((e) => e.action === 'completed-mission').length],
          ['sources', '📚 Sources', entries.filter((e) => e.action === 'logged-source' || e.action === 'viewed-source').length],
        ] as Array<[FilterMode, string, number]>).map(([mode, label, count]) => (
          <button
            className={`rounded-full px-2.5 py-0.5 text-[11px] transition ${
              filter === mode ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
            key={mode}
            onClick={() => setFilter(mode)}
            type="button"
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {entries.length > 0 && <SessionSummary entries={entries} />}

      <div className="flex-1 overflow-y-auto">
        {sortedEntries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
            <span className="text-3xl">📓</span>
            <p className="text-sm">Your learning notebook is empty.</p>
            <p className="text-xs">Click "📓 Log" on any source or complete missions to build your history.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {sortedEntries.map((entry) => {
              const actionMeta = ACTION_LABELS[entry.action] ?? { label: entry.action, icon: '📝' }
              return (
                <li className="px-4 py-2.5 hover:bg-slate-900/50" key={entry.id}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-sm">{entry.sourceFormat ? FORMAT_ICON[entry.sourceFormat] : actionMeta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200">
                        <span className="font-medium">{actionMeta.label}</span>
                        <span className="text-slate-500"> · </span>
                        <span className="text-slate-300">{entry.eraContent}</span>
                      </p>
                      {entry.sourceTitle && (
                        <a
                          className="block truncate text-xs text-blue-300 hover:text-blue-200 hover:underline"
                          href={entry.sourceUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {entry.sourceTitle}
                        </a>
                      )}
                      {entry.note && <p className="mt-0.5 text-xs italic text-slate-400">&ldquo;{entry.note}&rdquo;</p>}
                      {entry.linkedEraIds && entry.linkedEraIds.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-[10px] text-slate-500">🔗</span>
                          {entry.linkedEraIds.map((linkedId) => (
                            <span className="rounded-full border border-cyan-800/60 bg-cyan-950/30 px-1.5 py-px text-[10px] text-cyan-300" key={linkedId}>
                              {availableEras.find((e) => e.id === linkedId)?.content ?? linkedId}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.tags.map((tag) => (
                            <span className="rounded bg-slate-800 px-1.5 py-px text-[10px] text-slate-400" key={tag}>#{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        <span className="rounded bg-slate-800 px-1 py-px">{entry.eraGroup}</span>
                        {entry.progressAtTime !== undefined && <span>{entry.progressAtTime}%</span>}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
