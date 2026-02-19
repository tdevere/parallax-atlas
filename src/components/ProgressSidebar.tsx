import type { Era } from '../data/timeline-data'
import { badgeClassForProgress, milestoneLabelForProgress } from '../data/timeline-data'
import type { SubgraphSortMode } from '../viewer/types'

interface ProgressSidebarProps {
  eras: Era[]
  progress: Record<string, number>
  reviewDueByEra: Record<string, boolean>
  selectedEraId?: string
  sortMode?: SubgraphSortMode
  onCompleteTask: (id: string) => void
  onFocusEra?: (era: Era) => void
  onExport: () => void
  onExportImage?: () => void
  isOpen: boolean
  isCollapsedDesktop: boolean
  onCollapseDesktop: () => void
  onExpandDesktop: () => void
}

export function ProgressSidebar({
  eras,
  progress,
  reviewDueByEra,
  selectedEraId,
  sortMode = 'chronological',
  onCompleteTask,
  onFocusEra,
  onExport,
  onExportImage,
  isOpen,
  isCollapsedDesktop,
  onCollapseDesktop,
  onExpandDesktop,
}: ProgressSidebarProps) {
  const getPrerequisiteIds = (era: Era): string[] => {
    const maybeIds = era.prerequisiteIds
    if (!Array.isArray(maybeIds)) return []
    return maybeIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
  }

  const orderedEras = (() => {
    if (sortMode !== 'prerequisite-order') return eras

    const lookup = new Map(eras.map((era) => [era.id, era]))
    const indegree = new Map(eras.map((era) => [era.id, 0]))
    const outbound = new Map<string, string[]>()

    eras.forEach((era) => {
      getPrerequisiteIds(era).forEach((prerequisiteId) => {
        if (!lookup.has(prerequisiteId)) return
        indegree.set(era.id, (indegree.get(era.id) ?? 0) + 1)
        const current = outbound.get(prerequisiteId) ?? []
        outbound.set(prerequisiteId, [...current, era.id])
      })
    })

    const queue = eras
      .filter((era) => (indegree.get(era.id) ?? 0) === 0)
      .sort((left, right) => right.start - left.start)

    const result: Era[] = []

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      result.push(current)

      const neighbors = outbound.get(current.id) ?? []
      neighbors.forEach((neighborId) => {
        const remaining = (indegree.get(neighborId) ?? 0) - 1
        indegree.set(neighborId, remaining)
        if (remaining === 0) {
          const neighbor = lookup.get(neighborId)
          if (!neighbor) return
          queue.push(neighbor)
          queue.sort((left, right) => right.start - left.start)
        }
      })
    }

    if (result.length < eras.length) {
      const seen = new Set(result.map((era) => era.id))
      const remaining = eras.filter((era) => !seen.has(era.id)).sort((left, right) => right.start - left.start)
      return [...result, ...remaining]
    }

    return result
  })()

  const grouped = Object.entries(
    orderedEras.reduce<Record<string, Era[]>>((accumulator, era) => {
      accumulator[era.group] = [...(accumulator[era.group] ?? []), era]
      return accumulator
    }, {}),
  )

  return (
    <aside
      className={`${isOpen ? 'block' : 'hidden'} relative h-[calc(100vh-64px)] overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 transition-all duration-200 md:block ${isCollapsedDesktop ? 'md:w-0 md:overflow-visible md:border-r-0 md:p-0' : 'md:w-80'}`}
    >
      {isCollapsedDesktop && (
        <button
          aria-label="Expand Sidebar"
          className="hidden md:flex absolute left-0 top-6 z-20 -translate-x-1/2 items-center gap-1 rounded-full border border-cyan-700/70 bg-slate-900/95 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-lg shadow-cyan-950/40 hover:bg-slate-800"
          onClick={onExpandDesktop}
          type="button"
        >
          <span aria-hidden="true">→</span>
          <span>Expand</span>
        </button>
      )}
      <div className={`${isCollapsedDesktop ? 'md:hidden' : 'block'}`}>
        <button
          aria-label="Collapse Sidebar"
          className="hidden md:flex absolute right-0 top-6 z-20 translate-x-1/2 items-center gap-1 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs font-semibold text-slate-200 shadow-lg hover:bg-slate-800"
          onClick={onCollapseDesktop}
          type="button"
        >
          <span aria-hidden="true">←</span>
          <span>Collapse</span>
        </button>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Knowledge Progress</h2>
          <div className="flex gap-1.5">
            {onExportImage && (
              <button className="rounded border border-cyan-600 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-900/30" onClick={onExportImage} type="button">
                📷 Share
              </button>
            )}
            <button className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800" onClick={onExport} type="button">
              Export JSON
            </button>
          </div>
        </div>
        <div className="space-y-5">
        {grouped.map(([group, groupEras]) => (
          <section key={group}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{group}</h3>
            <ul className="space-y-3">
              {groupEras.map((era) => {
                const value = progress[era.id] ?? 0
                const isSelected = selectedEraId === era.id
                const badgeClassName = badgeClassForProgress(value)
                const milestoneLabel = milestoneLabelForProgress(value)
                const reviewDue = reviewDueByEra[era.id] ?? false
                const completedCheckpoints = Math.round(value / 25)
                return (
                  <li
                    aria-current={isSelected ? 'true' : undefined}
                    className={`rounded border p-3 transition-colors duration-200 ${isSelected ? 'border-cyan-500/80 bg-cyan-900/25' : 'border-slate-800 bg-slate-900/70'} ${reviewDue ? 'ring-1 ring-amber-600/70' : ''}`}
                    key={era.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm">{era.content}</span>
                      <div className="flex items-center gap-2">
                        {onFocusEra && (
                          <button
                            aria-label={`Focus ${era.content}`}
                            className="rounded border border-cyan-700/80 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-900/30"
                            onClick={() => onFocusEra(era)}
                            type="button"
                          >
                            Focus
                          </button>
                        )}
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badgeClassName}`}>
                          {value}%
                        </span>
                      </div>
                    </div>
                    {era.description && <p className="mb-2 text-xs text-slate-500">{era.description}</p>}
                    {reviewDue && <p className="mb-2 text-xs text-amber-300">Review due: no interaction in 3+ days.</p>}
                    <p aria-live="polite" className="mb-2 text-xs text-slate-400">
                      {milestoneLabel}
                    </p>
                    <progress aria-label={`${era.content} mastery progress`} className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-cyan-400" max={100} value={value} />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[11px] text-slate-500">Evidence checkpoints: {completedCheckpoints}/4</p>
                      <button
                        aria-label={`Complete task for ${era.content}`}
                        className="rounded border border-emerald-700/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/30"
                        onClick={() => onCompleteTask(era.id)}
                        type="button"
                      >
                        Complete Task
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        </div>
      </div>
    </aside>
  )
}
