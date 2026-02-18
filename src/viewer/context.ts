import type { Era } from '../data/timeline-data'
import { eras as defaultEras } from '../data/timeline-data'
import type { ResolvedViewerContext, TimelineViewerConfig } from './types'

const DEFAULT_STORAGE_KEY = 'knowledge-timeline-progress'

const progressForEras = (items: Era[], seed?: Record<string, number>): Record<string, number> =>
  items.reduce<Record<string, number>>((accumulator, era) => {
    accumulator[era.id] = seed?.[era.id] ?? 0
    return accumulator
  }, {})

export const resolveViewerContext = (config?: TimelineViewerConfig): ResolvedViewerContext => {
  const mode = config?.mode ?? 'default-context'
  const provided = config?.providedContext
  const isProvidedLike = mode === 'provided-context' || mode === 'generated-context'
  const activeEras = isProvidedLike && provided?.eras ? provided.eras : defaultEras

  const initialProgress = progressForEras(activeEras, isProvidedLike ? provided?.progress : undefined)
  const selectedId = isProvidedLike ? provided?.selectedEraId ?? null : null
  const selectedExists = selectedId ? activeEras.some((era) => era.id === selectedId) : false

  if (mode === 'no-context') {
    return {
      eras: activeEras,
      initialProgress,
      initialSelectedEraId: null,
      initialSidebarOpen: false,
      persistence: 'none',
      storageKey: config?.storageKey ?? DEFAULT_STORAGE_KEY,
    }
  }

  if (isProvidedLike) {
    return {
      eras: activeEras,
      initialProgress,
      initialSelectedEraId: selectedExists ? selectedId : null,
      initialSidebarOpen: provided?.sidebarOpen ?? false,
      persistence: provided?.persistence ?? 'memory',
      storageKey: config?.storageKey ?? DEFAULT_STORAGE_KEY,
    }
  }

  return {
    eras: activeEras,
    initialProgress,
    initialSelectedEraId: null,
    initialSidebarOpen: false,
    persistence: 'local',
    storageKey: config?.storageKey ?? DEFAULT_STORAGE_KEY,
  }
}
