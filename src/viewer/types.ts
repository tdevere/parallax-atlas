import type { Era } from '../data/timeline-data'

export type ViewerMode = 'no-context' | 'default-context' | 'provided-context' | 'generated-context'
export type PersistenceMode = 'local' | 'memory' | 'none'
export type SubgraphSortMode = 'chronological' | 'prerequisite-order'
export type GhostLayerMode = 'off' | 'prerequisites'
export type ZoomBand = 'cosmic' | 'macro' | 'historical' | 'modern' | 'micro'
export type MapSyncMode = 'timeline-leads' | 'map-leads' | 'bidirectional'

/** Geographic center coordinates for Bing Maps integration */
export interface GeoCenter {
  latitude: number
  longitude: number
  zoom?: number
  heading?: number
}

/** Spatial metadata extending an era with geographic context */
export interface SpatialMetadata {
  geoCenter?: GeoCenter
  geoBounds?: {
    north: number
    south: number
    east: number
    west: number
  }
}

/** Era extended with optional spatial metadata for map synchronization */
export interface GeoEra extends Era, SpatialMetadata {}

/** Viewport synchronization state between timeline and map */
export interface ViewportSyncState {
  timelineRange: { start: Date; end: Date }
  mapCenter: GeoCenter
  syncMode: MapSyncMode
  focusedEraId: string | null
  isAnimating: boolean
}

export interface EraConnection {
  targetEraId: string
  kind: 'analogy' | 'influence' | 'contrast' | 'application'
  strength?: number
}

export interface TimelineInteractionState {
  sortMode: SubgraphSortMode
  ghostLayerMode: GhostLayerMode
  zoomLevel: number
  zoomBand: ZoomBand
}

export interface ProvidedViewerContext {
  eras?: Era[]
  progress?: Record<string, number>
  selectedEraId?: string
  sidebarOpen?: boolean
  persistence?: PersistenceMode
}

export interface TimelineViewerConfig {
  mode?: ViewerMode
  storageKey?: string
  providedContext?: ProvidedViewerContext
  bingMapsApiKey?: string
}

export interface RuntimeNotice {
  level: 'warning' | 'error'
  message: string
}

export interface SubjectPackEntry {
  id: string
  name: string
  description?: string
  file: string
}

export interface SubjectPackManifest {
  packs: SubjectPackEntry[]
}

export interface SubjectPackPayload {
  id: string
  name: string
  description?: string
  context: ProvidedViewerContext
}

export interface ResolvedViewerContext {
  eras: Era[]
  initialProgress: Record<string, number>
  initialSelectedEraId: string | null
  initialSidebarOpen: boolean
  persistence: PersistenceMode
  storageKey: string
}
