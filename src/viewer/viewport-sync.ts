import type { GeoCenter, GeoEra, MapSyncMode, ViewportSyncState } from './types'

type ViewportChangeCallback = (state: ViewportSyncState) => void

const DEFAULT_MAP_CENTER: GeoCenter = { latitude: 40, longitude: -95, zoom: 4 }
const DEBOUNCE_MS = 150

/**
 * ViewportSyncController coordinates bidirectional synchronization between
 * the timeline viewport and Bing Maps. It debounces rapid viewport changes
 * to prevent performance degradation during fast scrolling or zooming.
 */
export class ViewportSyncController {
  private state: ViewportSyncState
  private listeners: Set<ViewportChangeCallback> = new Set()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(initialMode: MapSyncMode = 'timeline-leads') {
    this.state = {
      timelineRange: { start: new Date(), end: new Date() },
      mapCenter: { ...DEFAULT_MAP_CENTER },
      syncMode: initialMode,
      focusedEraId: null,
      isAnimating: false,
    }
  }

  /** Current viewport synchronization state (immutable copy) */
  getState(): ViewportSyncState {
    return { ...this.state, mapCenter: { ...this.state.mapCenter } }
  }

  /** Subscribe to viewport changes; returns an unsubscribe function */
  subscribe(callback: ViewportChangeCallback): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /** Change the synchronization mode */
  setSyncMode(mode: MapSyncMode): void {
    this.state.syncMode = mode
    this.notifyListeners()
  }

  /** Signal that an animation is in progress to suppress cross-source events */
  setAnimating(animating: boolean): void {
    this.state.isAnimating = animating
    if (!animating) {
      this.notifyListeners()
    }
  }

  /**
   * Called when the timeline viewport changes (range or focused era).
   * If a focused era has geo data, update the map center.
   */
  onTimelineViewportChange(start: Date, end: Date, focusedEra?: GeoEra | null): void {
    if (this.state.syncMode === 'map-leads' && this.state.isAnimating) {
      return
    }

    this.state.timelineRange = { start, end }
    this.state.focusedEraId = focusedEra?.id ?? null

    if (focusedEra?.geoCenter && this.state.syncMode !== 'map-leads') {
      this.state.mapCenter = { ...focusedEra.geoCenter }
      this.notifyListeners()
    }
  }

  /**
   * Called when a specific era is selected (clicked) on the timeline.
   * Triggers an immediate map fly-to if the era has geo data.
   */
  onEraSelected(era: GeoEra | null): void {
    this.state.focusedEraId = era?.id ?? null

    if (era?.geoCenter && this.state.syncMode !== 'map-leads') {
      this.state.mapCenter = { ...era.geoCenter }
      this.notifyListeners()
    }
  }

  /**
   * Called when the Bing Maps viewport changes (pan/zoom).
   * Debounces rapid updates to avoid jitter during continuous gestures.
   */
  onMapViewChange(center: GeoCenter): void {
    if (this.state.syncMode === 'timeline-leads' && this.state.isAnimating) {
      return
    }

    this.state.mapCenter = { ...center }

    if (this.state.syncMode === 'map-leads' || this.state.syncMode === 'bidirectional') {
      this.debouncedNotify()
    }
  }

  /**
   * Find eras that have geo data within the given map bounds.
   * Useful for highlighting timeline items visible on the current map view.
   */
  findErasInMapBounds(
    eras: GeoEra[],
    bounds: { north: number; south: number; east: number; west: number },
  ): GeoEra[] {
    return eras.filter((era) => {
      if (!era.geoCenter) return false
      const { latitude, longitude } = era.geoCenter
      return latitude <= bounds.north && latitude >= bounds.south && longitude <= bounds.east && longitude >= bounds.west
    })
  }

  /** Reset to default map center */
  resetToDefault(): void {
    this.state.mapCenter = { ...DEFAULT_MAP_CENTER }
    this.state.focusedEraId = null
    this.notifyListeners()
  }

  private notifyListeners(): void {
    const snapshot = this.getState()
    this.listeners.forEach((callback) => callback(snapshot))
  }

  private debouncedNotify(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.notifyListeners()
      this.debounceTimer = null
    }, DEBOUNCE_MS)
  }
}

/** Singleton viewport sync controller for app-wide usage */
export const viewportSync = new ViewportSyncController()
