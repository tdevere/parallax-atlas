import type { Era } from '../data/timeline-data'
import { formatYearsAgo } from '../data/timeline-data'

interface EraDetailModalProps {
  era: Era | null
  progress: number
  onClose: () => void
}

export function EraDetailModal({ era, progress, onClose }: EraDetailModalProps) {
  if (!era) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{era.content}</h2>
            <p className="text-sm text-slate-400">{era.group}</p>
          </div>
          <button className="rounded border border-slate-600 px-2 py-1 text-sm hover:bg-slate-800" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-200">{era.description ?? 'No additional details available.'}</p>
        <dl className="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Start</dt>
            <dd>{formatYearsAgo(era.start)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">End</dt>
            <dd>{formatYearsAgo(era.end)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Knowledge Level</dt>
            <dd>{progress}%</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
