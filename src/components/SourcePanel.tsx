import { useState } from 'react'
import type { Era } from '../data/timeline-data'
import { groupHue } from '../data/timeline-data'
import type { Source, SourceFormat } from '../sources/source-types'
import { FORMAT_ICON, FORMAT_LABEL } from '../sources/source-types'

interface SourcePanelProps {
  era: Era
  progress: number
  onLogSource: (source: Source) => void
  onClose: () => void
}

export function SourcePanel({ era, progress, onLogSource, onClose }: SourcePanelProps) {
  const sources: Source[] = era.sources ?? []
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())
  const hue = groupHue(era.group)

  const handleLog = (source: Source) => {
    onLogSource(source)
    setLoggedIds((prev) => new Set(prev).add(source.id))
  }

  const byFormat = sources.reduce<Partial<Record<SourceFormat, Source[]>>>((accumulator, source) => {
    if (!accumulator[source.format]) accumulator[source.format] = []
    accumulator[source.format]!.push(source)
    return accumulator
  }, {})

  const orderedFormats: SourceFormat[] = ['paper', 'lecture', 'book', 'video', 'overview', 'report', 'dataset']
  const presentFormats = orderedFormats.filter((format) => byFormat[format])

  return (
    <div className="border-b border-slate-700 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span>📚</span>
              <span>Sources for {era.content}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{ background: hue.base, color: hue.accent, border: `1px solid ${hue.fill}` }}
              >
                {era.group}
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {sources.length} source{sources.length !== 1 ? 's' : ''} · Progress: {progress}%
            </p>
          </div>
          <button
            className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {sources.length === 0 ? (
          <p className="pb-2 text-sm text-slate-500">No curated sources available for this era yet.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5 text-[10px] text-slate-400">
              {presentFormats.map((format) => (
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5" key={format}>
                  {FORMAT_ICON[format]} {FORMAT_LABEL[format]} ({byFormat[format]!.length})
                </span>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((source) => (
                <div
                  className="group relative flex flex-col gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 p-3 transition hover:border-slate-500"
                  key={source.id}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg" title={FORMAT_LABEL[source.format]}>
                      {FORMAT_ICON[source.format]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        className="text-sm font-medium leading-snug text-blue-300 hover:text-blue-200 hover:underline"
                        href={source.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {source.title}
                      </a>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                        {source.author && <span>{source.author}</span>}
                        {source.year && <span>({source.year})</span>}
                        {source.domain && <span className="rounded bg-slate-800 px-1 py-px">{source.domain}</span>}
                      </div>
                    </div>
                  </div>
                  {source.snippet && <p className="text-xs leading-relaxed text-slate-400">{source.snippet}</p>}
                  <div className="mt-auto flex gap-1.5 pt-1">
                    <a
                      className="rounded border border-blue-700/60 bg-blue-950/30 px-2 py-0.5 text-[11px] text-blue-200 hover:bg-blue-900/40"
                      href={source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open ↗
                    </a>
                    <button
                      className={`rounded border px-2 py-0.5 text-[11px] transition ${
                        loggedIds.has(source.id)
                          ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                          : 'border-slate-600 text-slate-300 hover:border-amber-600 hover:bg-amber-950/30 hover:text-amber-200'
                      }`}
                      disabled={loggedIds.has(source.id)}
                      onClick={() => handleLog(source)}
                      type="button"
                    >
                      {loggedIds.has(source.id) ? '✓ Logged' : '📓 Log'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
