import type {
  ProvidedViewerContext,
  RuntimeNotice,
  SubjectPackEntry,
  SubjectPackManifest,
  SubjectPackPayload,
  TimelineViewerConfig,
  ViewerMode,
} from './types'

const PACK_MANIFEST_PATH = '/subject-packs/index.json'
const ALLOWED_PERSISTENCE = ['local', 'memory', 'none']
type JsonLoadErrorReason = 'network' | 'http' | 'invalid-json'

interface JsonLoadResult<T> {
  data: T | null
  reason?: JsonLoadErrorReason
  status?: number
}

const isViewerMode = (value: string | null): value is ViewerMode =>
  value === 'no-context' || value === 'default-context' || value === 'provided-context' || value === 'generated-context'

const fetchJson = async <T>(path: string): Promise<JsonLoadResult<T>> => {
  try {
    const response = await fetch(path)
    if (!response.ok) return { data: null, reason: 'http', status: response.status }

    try {
      return { data: (await response.json()) as T }
    } catch {
      return { data: null, reason: 'invalid-json' }
    }
  } catch {
    return { data: null, reason: 'network' }
  }
}

const getPackIdFromQuery = (): string | null => new URLSearchParams(window.location.search).get('subjectPack')

const isValidPackEntry = (value: unknown): value is SubjectPackEntry => {
  if (!value || typeof value !== 'object') return false
  const pack = value as Record<string, unknown>
  return (
    typeof pack.id === 'string' &&
    pack.id.length > 0 &&
    typeof pack.name === 'string' &&
    pack.name.length > 0 &&
    typeof pack.file === 'string' &&
    pack.file.length > 0
  )
}

const isValidEra = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const era = value as Record<string, unknown>
  return (
    typeof era.id === 'string' &&
    era.id.length > 0 &&
    typeof era.content === 'string' &&
    era.content.length > 0 &&
    typeof era.group === 'string' &&
    era.group.length > 0 &&
    typeof era.start === 'number' &&
    typeof era.end === 'number' &&
    Number.isFinite(era.start) &&
    Number.isFinite(era.end) &&
    era.start >= era.end
  )
}

const isValidProgress = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const progress = value as Record<string, unknown>
  return Object.values(progress).every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 100)
}

const validateProvidedContext = (context: ProvidedViewerContext): boolean => {
  if (!Array.isArray(context.eras) || context.eras.length === 0 || !context.eras.every(isValidEra)) return false
  if (context.progress && !isValidProgress(context.progress)) return false
  if (context.persistence && !ALLOWED_PERSISTENCE.includes(context.persistence)) return false
  return true
}

export const getModeFromQuery = (): ViewerMode | undefined => {
  const mode = new URLSearchParams(window.location.search).get('viewerMode')
  return isViewerMode(mode) ? mode : undefined
}

export const updateViewerQuery = (mode: ViewerMode, subjectPackId?: string): void => {
  const params = new URLSearchParams(window.location.search)
  params.set('viewerMode', mode)

  if (subjectPackId) {
    params.set('subjectPack', subjectPackId)
  } else {
    params.delete('subjectPack')
  }

  const nextQuery = params.toString()
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
  window.location.assign(nextUrl)
}

const loadManifest = async (): Promise<{ packs: SubjectPackEntry[]; droppedCount: number; notice?: RuntimeNotice }> => {
  const manifestResult = await fetchJson<SubjectPackManifest>(PACK_MANIFEST_PATH)
  const manifest = manifestResult.data
  if (!manifest) {
    if (manifestResult.reason === 'invalid-json') {
      return {
        droppedCount: 0,
        notice: {
          level: 'warning',
          message: 'Subject-pack manifest is not valid JSON. Using built-in timeline data.',
        },
        packs: [],
      }
    }

    if (manifestResult.reason === 'http') {
      return {
        droppedCount: 0,
        notice: {
          level: 'warning',
          message: `Subject-pack manifest could not be loaded (HTTP ${manifestResult.status ?? 'unknown'}). Using built-in timeline data.`,
        },
        packs: [],
      }
    }

    return {
      droppedCount: 0,
      notice: {
        level: 'warning',
        message: 'Subject-pack manifest could not be loaded due to a network error. Using built-in timeline data.',
      },
      packs: [],
    }
  }

  if (!Array.isArray(manifest.packs)) {
    return {
      droppedCount: 0,
      notice: {
        level: 'warning',
        message: "Subject-pack manifest is missing a valid 'packs' list. Using built-in timeline data.",
      },
      packs: [],
    }
  }

  const validPacks = manifest.packs.filter((pack) => isValidPackEntry(pack))
  return {
    droppedCount: Math.max(0, manifest.packs.length - validPacks.length),
    packs: validPacks,
  }
}

const loadPackContext = async (
  subjectPackId: string,
  packs: SubjectPackEntry[],
): Promise<{ context: ProvidedViewerContext | null; notice?: RuntimeNotice }> => {
  const selectedPack = packs.find((entry) => entry.id === subjectPackId)
  if (!selectedPack) {
    return {
      context: null,
      notice: {
        level: 'warning',
        message: `Subject pack '${subjectPackId}' was not found. Falling back to built-in timeline.`,
      },
    }
  }

  const payloadResult = await fetchJson<SubjectPackPayload>(`/subject-packs/${selectedPack.file}`)
  const payload = payloadResult.data
  if (!payload?.context) {
    const loadDetail =
      payloadResult.reason === 'invalid-json'
        ? 'it is not valid JSON'
        : payloadResult.reason === 'http'
          ? `it returned HTTP ${payloadResult.status ?? 'unknown'}`
          : 'it could not be reached'

    return {
      context: null,
      notice: {
        level: 'warning',
        message: `Subject pack '${selectedPack.name}' could not be loaded because ${loadDetail}. Falling back to built-in timeline.`,
      },
    }
  }

  if (!validateProvidedContext(payload.context)) {
    return {
      context: null,
      notice: {
        level: 'warning',
        message: `Subject pack '${selectedPack.name}' is invalid. Falling back to built-in timeline.`,
      },
    }
  }

  return { context: payload.context }
}

export const loadRuntimeViewerConfig = async (
  baseConfig?: TimelineViewerConfig,
): Promise<{ config: TimelineViewerConfig; packs: SubjectPackEntry[]; notices: RuntimeNotice[] }> => {
  const notices: RuntimeNotice[] = []
  const { droppedCount, notice: manifestNotice, packs } = await loadManifest()
  const modeFromQuery = getModeFromQuery()
  const subjectPackId = getPackIdFromQuery()
  const providedContextFromPack = subjectPackId ? await loadPackContext(subjectPackId, packs) : { context: null }

  if (manifestNotice) {
    notices.push(manifestNotice)
  }

  if (droppedCount > 0) {
    notices.push({
      level: 'warning',
      message: `${droppedCount} invalid subject-pack entr${droppedCount === 1 ? 'y was' : 'ies were'} ignored from the manifest.`,
    })
  }

  if (packs.length === 0 && !manifestNotice) {
    notices.push({
      level: 'warning',
      message: 'No subject packs are currently available. Using built-in timeline data.',
    })
  }

  if (modeFromQuery === 'provided-context' && !subjectPackId) {
    notices.push({
      level: 'warning',
      message: "Provided-context mode requires a 'subjectPack' query value. Falling back to built-in timeline.",
    })
  }

  if (providedContextFromPack.notice) {
    notices.push(providedContextFromPack.notice)
  }

  const config: TimelineViewerConfig = {
    ...baseConfig,
    mode: modeFromQuery ?? baseConfig?.mode,
  }

  if (providedContextFromPack.context) {
    config.mode = 'provided-context'
    config.providedContext = providedContextFromPack.context
  }

  if (config.mode === 'provided-context' && !config.providedContext?.eras) {
    config.mode = 'default-context'
  }

  return { config, notices, packs }
}
