import { DataSet } from 'vis-data'
import { Timeline as VisTimeline } from 'vis-timeline'
import 'vis-timeline/styles/vis-timeline-graph2d.css'
import { useEffect, useMemo, useRef } from 'react'
import type { Era } from '../data/timeline-data'
import { formatYearsAgo, groupHue } from '../data/timeline-data'
import type { GhostLayerMode, ZoomBand } from '../viewer/types'

interface TimelineProps {
  eras: Era[]
  allEras?: Era[]
  progress: Record<string, number>
  reviewDueByEra?: Record<string, boolean>
  focusEra?: Era | null
  zoomBand?: ZoomBand
  ghostLayerMode?: GhostLayerMode
  onSelectEra?: (era: Era) => void
  onCompleteTask?: (eraId: string) => void
  onJumpToContext?: (era: Era) => void
  onZoomLevelChange?: (zoomLevel: number, zoomBand: ZoomBand) => void
}

const LOG_UNIT_MS = 365 * 24 * 60 * 60 * 1000
const TIMELINE_ANIMATION = {
  duration: 260,
  easingFunction: 'easeInOutQuad',
} as const

const NESTED_ROW_MAX_HEIGHT_CLASS = 'max-h-56'

const yearsAgoToDate = (yearsAgo: number): Date => new Date(-Math.log10(Math.max(yearsAgo, 0) + 1) * LOG_UNIT_MS)

const toDate = (value: Date | number | string): Date => (value instanceof Date ? value : new Date(value))

const dateToYearsAgo = (date: Date | number | string): number => Math.pow(10, -toDate(date).getTime() / LOG_UNIT_MS) - 1

const getParentId = (era: Era): string | null => {
  const maybeParentId = era.parentId
  return typeof maybeParentId === 'string' && maybeParentId.length > 0 ? maybeParentId : null
}

const getPrerequisiteIds = (era: Era | null | undefined): string[] => {
  if (!era) return []
  const maybePrerequisites = era.prerequisiteIds
  if (!Array.isArray(maybePrerequisites)) return []
  return maybePrerequisites.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

const deriveZoomLevel = (spanYears: number): number => {
  const maxYears = 1e9
  const minYears = 100
  const clampedSpan = Math.min(maxYears, Math.max(minYears, spanYears))
  const ratio = (Math.log10(maxYears) - Math.log10(clampedSpan)) / (Math.log10(maxYears) - Math.log10(minYears))
  return Number((1 + ratio * 9).toFixed(2))
}

const zoomBandFromLevel = (zoomLevel: number): ZoomBand => {
  if (zoomLevel < 3) return 'cosmic'
  if (zoomLevel < 5.5) return 'macro'
  if (zoomLevel < 8.7) return 'historical'
  if (zoomLevel < 9) return 'modern'
  return 'micro'
}

type TickScale = 'year' | 'month' | 'day'

interface TickSettings {
  scale: TickScale
  step: number
}

const countVisibleEras = (eras: Era[], yearsStart: number, yearsEnd: number): number =>
  eras.filter((era) => era.end <= yearsStart && era.start >= yearsEnd).length

const pickTickSettings = (zoomBand: ZoomBand, spanYears: number, density: number): TickSettings => {
  if (zoomBand === 'micro') {
    if (density >= 0.2 || spanYears <= 3) return { scale: 'day', step: 7 }
    if (density >= 0.08 || spanYears <= 25) return { scale: 'month', step: 1 }
    return { scale: 'year', step: 1 }
  }

  if (zoomBand === 'modern') {
    if (density >= 0.08 || spanYears <= 40) return { scale: 'month', step: 1 }
    return { scale: 'year', step: 1 }
  }

  if (zoomBand === 'historical') {
    if (density >= 0.03 || spanYears <= 150) return { scale: 'year', step: 1 }
    return { scale: 'year', step: 5 }
  }

  if (zoomBand === 'macro') {
    return { scale: 'year', step: 25 }
  }

  return { scale: 'year', step: 250 }
}

const focusPaddingForBand = (eraSpan: number, band: ZoomBand): number => {
  if (band === 'micro') return Math.max(eraSpan * 0.12, 0.5)
  if (band === 'modern') return Math.max(eraSpan * 0.2, 1)
  if (band === 'historical') return Math.max(eraSpan * 0.45, 6)
  if (band === 'macro') return Math.max(eraSpan * 0.6, 25)
  return Math.max(eraSpan * 0.75, 50)
}

export function Timeline({
  eras,
  allEras,
  progress,
  reviewDueByEra = {},
  focusEra,
  zoomBand = 'cosmic',
  ghostLayerMode = 'off',
  onSelectEra,
  onCompleteTask,
  onJumpToContext,
  onZoomLevelChange,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<VisTimeline | null>(null)
  const eraLookupRef = useRef<Map<string, Era>>(new Map())
  const focusedPrerequisiteIdsRef = useRef<Set<string>>(new Set())
  const focusEraIdRef = useRef<string | null>(null)
  const onSelectEraRef = useRef<typeof onSelectEra | undefined>(onSelectEra)
  const onJumpToContextRef = useRef<typeof onJumpToContext | undefined>(onJumpToContext)
  const onZoomLevelChangeRef = useRef<typeof onZoomLevelChange | undefined>(onZoomLevelChange)
  const focusEraRef = useRef<Era | null>(focusEra ?? null)
  const timelineErasRef = useRef<Era[]>(eras)
  const tickSettingsRef = useRef<TickSettings>({ scale: 'year', step: 1 })

  const sourceEras = useMemo(() => (allEras && allEras.length > 0 ? allEras : eras), [allEras, eras])

  const eraLookup = useMemo(() => new Map(sourceEras.map((era) => [era.id, era])), [sourceEras])

  const focusedPrerequisiteIds = useMemo(
    () => (ghostLayerMode === 'prerequisites' ? new Set(getPrerequisiteIds(focusEra)) : new Set<string>()),
    [focusEra, ghostLayerMode],
  )

  useEffect(() => {
    eraLookupRef.current = eraLookup
  }, [eraLookup])

  useEffect(() => {
    focusedPrerequisiteIdsRef.current = focusedPrerequisiteIds
    focusEraIdRef.current = focusEra?.id ?? null
    focusEraRef.current = focusEra ?? null
  }, [focusEra, focusEra?.id, focusedPrerequisiteIds])

  useEffect(() => {
    onSelectEraRef.current = onSelectEra
    onJumpToContextRef.current = onJumpToContext
    onZoomLevelChangeRef.current = onZoomLevelChange
  }, [onJumpToContext, onSelectEra, onZoomLevelChange])

  const timelineEras = useMemo(() => {
    if (focusedPrerequisiteIds.size === 0) return eras
    const merged = new Map(eras.map((era) => [era.id, era]))
    focusedPrerequisiteIds.forEach((prerequisiteId) => {
      const match = eraLookup.get(prerequisiteId)
      if (match) merged.set(match.id, match)
    })
    return [...merged.values()]
  }, [eraLookup, eras, focusedPrerequisiteIds])

  const groups = useMemo(
    () => {
      const uniqueGroups = [...new Set(sourceEras.map((era) => era.group))]
      return new DataSet(
        uniqueGroups.map((group) => ({
          id: group,
          content: group,
          className: focusEra && group !== focusEra.group ? 'focus-collapsed-group' : 'focus-active-group',
        })),
      )
    },
    [focusEra, sourceEras],
  )

  const items = useMemo(
    () =>
      new DataSet(
        timelineEras.map((era) => {
          const value = progress[era.id] ?? 0
          const isGhostPrerequisite = focusedPrerequisiteIds.has(era.id) && focusEra?.id !== era.id
          const staleMastery = reviewDueByEra[era.id] ?? false
          const hue = groupHue(era.group)
          const pct = Math.min(100, Math.max(0, value))

          const gradient = pct > 0
            ? `background:linear-gradient(to right,${hue.fill} ${pct}%,${hue.base} ${pct}%);`
            : `background-color:${hue.base};`

          const style = isGhostPrerequisite
            ? `${gradient}opacity:0.38;border-style:dashed;cursor:pointer;border-left:3px solid ${hue.accent};`
            : staleMastery
              ? `${gradient}opacity:0.55;filter:grayscale(0.85);border-left:3px solid ${hue.accent};`
              : `${gradient}border-left:3px solid ${hue.accent};`

          const title = `<strong>${era.content}</strong><span class="vis-tooltip-group">${era.group}</span>${era.description ? `<p class="vis-tooltip-desc">${era.description}</p>` : ''}<span class="vis-tooltip-progress" style="color:${hue.accent}">Progress: ${value}%</span>`

          return {
            id: era.id,
            content: era.content,
            start: yearsAgoToDate(era.start),
            end: yearsAgoToDate(era.end),
            group: era.group,
            className: isGhostPrerequisite ? 'ghost-prerequisite-item' : staleMastery ? 'stale-mastery-item' : undefined,
            style,
            title,
          }
        }),
      ),
    [focusEra?.id, focusedPrerequisiteIds, progress, reviewDueByEra, timelineEras],
  )

  const nestedChildren = useMemo(() => {
    if (!focusEra) return []
    return sourceEras
      .filter((era) => getParentId(era) === focusEra.id)
      .sort((left, right) => right.start - left.start)
  }, [focusEra, sourceEras])

  const activeMissionPayload = useMemo(() => {
    if (!focusEra) return null
    if (focusEra.payload) return focusEra.payload
    return {
      taskType: 'active-recall' as const,
      missionTitle: `Recall Check: ${focusEra.content}`,
      prompt: focusEra.description
        ? `Explain why this mattered: ${focusEra.description}`
        : `Explain the core idea of ${focusEra.content} in one sentence.`,
      completionEvidenceHint: 'Provide one concise evidence-based sentence.',
      primarySourceSnippets: [],
    }
  }, [focusEra])
  const microBandSnippets = useMemo(() => {
    if (zoomBand !== 'micro') return []
    const snippets = timelineEras.flatMap((era) =>
      (era.payload?.primarySourceSnippets ?? []).map((snippet) => ({
        ...snippet,
        eraContent: era.content,
      })),
    )
    return snippets.slice(0, 4)
  }, [timelineEras, zoomBand])

  useEffect(() => {
    timelineErasRef.current = timelineEras
  }, [timelineEras])

  useEffect(() => {
    if (!containerRef.current || timelineRef.current) return

    timelineRef.current = new VisTimeline(containerRef.current, items, groups, {
      stack: false,
      zoomMin: LOG_UNIT_MS * 0.005,
      zoomMax: LOG_UNIT_MS * 15,
      orientation: 'top',
      timeAxis: { scale: 'year', step: 1 },
      format: {
        minorLabels: (date: Date | number | string) => {
          const yearsAgo = Math.max(0, dateToYearsAgo(date))
          if (yearsAgo < 500) {
            return String(Math.round(new Date().getFullYear() - yearsAgo))
          }
          return formatYearsAgo(yearsAgo)
        },
        majorLabels: () => '',
      },
      tooltip: {
        followMouse: true,
        overflowMethod: 'flip',
        delay: 200,
      },
    })

    timelineRef.current.on('select', ({ items: selectedItems }) => {
      const selectedId = selectedItems[0]
      if (!selectedId) return
      const era = eraLookupRef.current.get(String(selectedId))
      if (!era) return

      if (focusedPrerequisiteIdsRef.current.has(era.id) && focusEraIdRef.current !== era.id) {
        onJumpToContextRef.current?.(era)
        return
      }

      onSelectEraRef.current?.(era)
    })

    timelineRef.current.on('rangechanged', ({ start, end }) => {
      const yearsStart = Math.max(0, dateToYearsAgo(start))
      const yearsEnd = Math.max(0, dateToYearsAgo(end))
      const spanYears = Math.max(1, Math.abs(yearsStart - yearsEnd))
      const zoomLevel = deriveZoomLevel(spanYears)
      const zoomBand = zoomBandFromLevel(zoomLevel)
      const visibleCount = countVisibleEras(timelineErasRef.current, yearsStart, yearsEnd)
      const density = visibleCount / spanYears
      const nextTickSettings = pickTickSettings(zoomBand, spanYears, density)

      const activeTickSettings = tickSettingsRef.current
      if (activeTickSettings.scale !== nextTickSettings.scale || activeTickSettings.step !== nextTickSettings.step) {
        tickSettingsRef.current = nextTickSettings
        timelineRef.current?.setOptions({
          timeAxis: {
            scale: nextTickSettings.scale,
            step: nextTickSettings.step,
          },
        })
      }

      onZoomLevelChangeRef.current?.(zoomLevel, zoomBand)
    })

    return () => {
      timelineRef.current?.destroy()
      timelineRef.current = null
    }
  }, [groups, items])

  useEffect(() => {
    timelineRef.current?.setData({ items, groups })
  }, [groups, items])

  useEffect(() => {
    if (!timelineRef.current) return
    timelineRef.current.setSelection(focusEra ? [focusEra.id] : [])
  }, [focusEra])

  useEffect(() => {
    if (!timelineRef.current) return

    if (!focusEra) {
      timelineRef.current.fit({ animation: TIMELINE_ANIMATION })
      return
    }

    const eraSpan = Math.max(focusEra.start - focusEra.end, 10)
    const padding = focusPaddingForBand(eraSpan, zoomBand)
    const start = yearsAgoToDate(focusEra.start + padding)
    const end = yearsAgoToDate(Math.max(0, focusEra.end - padding))

    timelineRef.current.setWindow(start, end, { animation: TIMELINE_ANIMATION })
  }, [focusEra, zoomBand])

  return (
    <div aria-label="Timeline canvas" className="flex h-[calc(100vh-64px)] min-w-0 flex-1 flex-col p-4" data-testid="timeline-canvas">
      <div className="min-h-0 flex-1" ref={containerRef} />
      <div
        aria-label="Nested timeline row"
        className={`overflow-hidden transition-all duration-300 ease-out ${nestedChildren.length > 0 && focusEra ? NESTED_ROW_MAX_HEIGHT_CLASS : 'max-h-0'} ${nestedChildren.length > 0 && focusEra ? 'mt-3 opacity-100' : 'opacity-0'}`}
      >
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-xs uppercase tracking-wide text-cyan-300">Nested Sub-Topics</p>
          <p className="mb-2 text-xs text-slate-400">Drill down into prerequisite or follow-up concepts in this branch.</p>
          <div className="flex flex-wrap gap-2">
            {nestedChildren.map((child) => (
              <button
                aria-label={`Drill into ${child.content}`}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-600 hover:text-cyan-200"
                key={child.id}
                onClick={() => onSelectEra?.(child)}
                type="button"
              >
                {child.content}
              </button>
            ))}
          </div>
        </div>
      </div>
      {focusEra && activeMissionPayload && (
        <div aria-label="Mission task workspace" className="mt-3 rounded-lg border border-cyan-800/80 bg-slate-950/95 p-3 shadow-inner shadow-cyan-950/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-cyan-300">Action Workspace</p>
              <h3 className="text-sm font-semibold text-cyan-100">{activeMissionPayload.missionTitle}</h3>
              <p className="mt-1 text-xs text-slate-200">{activeMissionPayload.prompt}</p>
              <p className="mt-1 text-[11px] text-slate-400">Evidence required: {activeMissionPayload.completionEvidenceHint}</p>
            </div>
            <button
              aria-label={`Complete micro task for ${focusEra.content}`}
              className="rounded border border-emerald-700 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/35"
              onClick={() => onCompleteTask?.(focusEra.id)}
              type="button"
            >
              Complete Micro-Task
            </button>
          </div>
        </div>
      )}
      {microBandSnippets.length > 0 && (
        <div aria-label="Primary source snippets" className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-xs uppercase tracking-wide text-cyan-300">Primary Source Snippets</p>
          <ul className="mt-2 space-y-2">
            {microBandSnippets.map((snippet) => (
              <li className="rounded border border-slate-800 bg-slate-900/70 p-2 text-xs text-slate-200" key={snippet.id}>
                <p className="text-cyan-200">{snippet.relativeOffsetLabel ?? 't0+'} · {snippet.eraContent}</p>
                <p className="mt-1">“{snippet.quote}”</p>
                <p className="mt-1 text-[11px] text-slate-400">{snippet.source}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
