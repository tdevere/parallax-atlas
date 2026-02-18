import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { GeoCenter, GeoEra, MapSyncMode } from '../viewer/types'
import { groupHue } from '../data/timeline-data'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AtlasNamespace = any
type AtlasMap = any
type AtlasMarker = any
/* eslint-enable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    atlas?: AtlasNamespace
  }
}

interface AzureMapPanelProps {
  apiKey: string
  center: GeoCenter
  eras: GeoEra[]
  selectedEraId?: string | null
  syncMode: MapSyncMode
  onMapMove: (center: GeoCenter) => void
  onEraSelect: (eraId: string) => void
  onSyncModeChange: (mode: MapSyncMode) => void
}

const AZURE_MAPS_SCRIPT_ID = 'azure-maps-sdk'
const AZURE_MAPS_CSS_ID = 'azure-maps-css'
const AZURE_MAPS_SDK_VERSION = '3'

/**
 * AzureMapPanel renders an Azure Maps instance synchronized with the timeline.
 * Uses refs to prevent full re-renders on every timeline tick.
 */
export function AzureMapPanel({
  apiKey,
  center,
  eras,
  selectedEraId,
  syncMode,
  onMapMove,
  onEraSelect,
  onSyncModeChange,
}: AzureMapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AtlasMap | null>(null)
  const markersRef = useRef<Map<string, AtlasMarker>>(new Map())
  const lastCenterRef = useRef<GeoCenter>(center)
  const suppressNextMoveRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(() => Boolean(window.atlas?.Map))
  const [loadError, setLoadError] = useState<string | null>(null)
  const hasFitInitialBoundsRef = useRef(false)

  const geoEras = useMemo(() => eras.filter((e) => e.geoCenter), [eras])
  const selectedHasGeo = useMemo(() => {
    if (!selectedEraId) return true // no selection = no warning
    return geoEras.some((e) => e.id === selectedEraId)
  }, [geoEras, selectedEraId])

  // Load Azure Maps Web SDK (script + CSS)
  useEffect(() => {
    if (isLoaded) return

    // Inject CSS if not present
    if (!document.getElementById(AZURE_MAPS_CSS_ID)) {
      const link = document.createElement('link')
      link.id = AZURE_MAPS_CSS_ID
      link.rel = 'stylesheet'
      link.href = `https://atlas.microsoft.com/sdk/javascript/mapcontrol/${AZURE_MAPS_SDK_VERSION}/atlas.min.css`
      document.head.appendChild(link)
    }

    // Inject script if not present
    if (document.getElementById(AZURE_MAPS_SCRIPT_ID)) return

    const script = document.createElement('script')
    script.id = AZURE_MAPS_SCRIPT_ID
    script.src = `https://atlas.microsoft.com/sdk/javascript/mapcontrol/${AZURE_MAPS_SDK_VERSION}/atlas.min.js`
    script.async = true

    script.onload = () => {
      if (window.atlas?.Map) {
        setIsLoaded(true)
      } else {
        setLoadError('Azure Maps SDK loaded but atlas.Map not found.')
      }
    }

    script.onerror = () => {
      setLoadError('Failed to load Azure Maps SDK. Check API key and network.')
    }

    document.head.appendChild(script)
  }, [isLoaded])

  // Initialize map instance
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return

    const atlas = window.atlas
    if (!atlas) return

    const map = new atlas.Map(containerRef.current, {
      center: [center.longitude, center.latitude],
      zoom: center.zoom ?? 4,
      style: 'satellite_road_labels',
      view: 'Auto',
      authOptions: {
        authType: 'subscriptionKey',
        subscriptionKey: apiKey,
      },
    })

    mapRef.current = map

    map.events.add('ready', () => {
      // Listen for user-initiated viewport changes after map is ready
      map.events.add('moveend', () => {
        if (suppressNextMoveRef.current) {
          suppressNextMoveRef.current = false
          return
        }

        const cam = map.getCamera()
        const [lng, lat] = cam.center
        const newCenter: GeoCenter = {
          latitude: lat,
          longitude: lng,
          zoom: cam.zoom,
        }

        const last = lastCenterRef.current
        const threshold = 0.0001
        if (
          Math.abs(newCenter.latitude - last.latitude) > threshold ||
          Math.abs(newCenter.longitude - last.longitude) > threshold ||
          (newCenter.zoom != null && last.zoom != null && Math.abs(newCenter.zoom - last.zoom) > 0.5)
        ) {
          onMapMove(newCenter)
        }
      })
    })

    const currentMarkersRef = markersRef

    return () => {
      map.dispose()
      mapRef.current = null
      currentMarkersRef.current.clear()
    }
    // Only run on mount/unmount after SDK loads; refs are captured in cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  // Fly-to when timeline drives center updates
  useEffect(() => {
    const map = mapRef.current
    if (!map || syncMode === 'map-leads') return

    const cam = map.getCamera()
    const [currentLng, currentLat] = cam.center ?? [0, 0]
    const threshold = 0.0001

    if (
      Math.abs(center.latitude - currentLat) > threshold ||
      Math.abs(center.longitude - currentLng) > threshold
    ) {
      lastCenterRef.current = center
      suppressNextMoveRef.current = true

      map.setCamera({
        center: [center.longitude, center.latitude],
        zoom: center.zoom ?? cam.zoom,
        type: 'fly',
        duration: 600,
      })
    }
  }, [center, syncMode])

  // Render era markers
  const updateMarkers = useCallback(() => {
    const map = mapRef.current
    const atlas = window.atlas
    if (!map || !atlas) return

    // Remove existing markers
    markersRef.current.forEach((marker) => map.markers.remove(marker))
    markersRef.current.clear()

    geoEras.forEach((era) => {
      if (!era.geoCenter) return

      const isSelected = era.id === selectedEraId
      const hue = groupHue(era.group)
      const bg = isSelected ? hue.accent : hue.fill
      const border = isSelected ? '#fff' : hue.accent
      const scale = isSelected ? 'scale(1.25)' : 'scale(1)'
      const shadow = isSelected ? '0 0 8px rgba(255,255,255,.35)' : '0 1px 4px rgba(0,0,0,.4)'
      const label = era.content.length > 18 ? era.content.slice(0, 16) + '…' : era.content

      const marker = new atlas.HtmlMarker({
        position: [era.geoCenter.longitude, era.geoCenter.latitude],
        htmlContent: `<div
          title="${era.content} (${era.group})"
          style="
            display:flex;align-items:center;gap:4px;
            padding:3px 8px 3px 6px;border-radius:14px;
            font-size:11px;font-weight:600;color:white;cursor:pointer;
            background:${bg};
            border:2px solid ${border};
            box-shadow:${shadow};
            transform:${scale};
            transition:transform .15s,box-shadow .15s;
            white-space:nowrap;
          "
        ><span style="width:8px;height:8px;border-radius:50%;background:${border};flex-shrink:0;"></span>${label}</div>`,
      })

      map.events.add('click', marker, () => {
        onEraSelect(era.id)
      })

      map.markers.add(marker)
      markersRef.current.set(era.id, marker)
    })

    // Fit bounds on first render
    if (!hasFitInitialBoundsRef.current && geoEras.length > 0) {
      hasFitInitialBoundsRef.current = true
      const lats = geoEras.map((e) => e.geoCenter!.latitude)
      const lngs = geoEras.map((e) => e.geoCenter!.longitude)
      const padding = 40

      if (geoEras.length === 1) {
        suppressNextMoveRef.current = true
        map.setCamera({
          center: [lngs[0], lats[0]],
          zoom: geoEras[0].geoCenter!.zoom ?? 10,
          type: 'fly',
          duration: 600,
        })
      } else {
        suppressNextMoveRef.current = true
        map.setCamera({
          bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
          padding,
          type: 'fly',
          duration: 800,
        })
      }
    }
  }, [geoEras, selectedEraId, onEraSelect])

  useEffect(() => {
    if (isLoaded && mapRef.current) {
      updateMarkers()
    }
  }, [isLoaded, updateMarkers])

  if (loadError) {
    return (
      <div className="flex h-full min-h-[300px] w-full items-center justify-center rounded-lg border border-rose-800 bg-rose-950/30 p-4 text-rose-200">
        <p>{loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">Spatial View</span>
          <span className="text-[10px] text-slate-500">{geoEras.length}/{eras.length} located</span>
        </div>
        <div className="flex gap-1">
          <button
            className={`rounded px-2 py-0.5 text-[11px] transition ${syncMode === 'timeline-leads' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            onClick={() => onSyncModeChange('timeline-leads')}
            title="Timeline controls map"
            type="button"
          >
            Timeline → Map
          </button>
          <button
            className={`rounded px-2 py-0.5 text-[11px] transition ${syncMode === 'bidirectional' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            onClick={() => onSyncModeChange('bidirectional')}
            title="Linked navigation"
            type="button"
          >
            ↔ Linked
          </button>
          <button
            className={`rounded px-2 py-0.5 text-[11px] transition ${syncMode === 'map-leads' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            onClick={() => onSyncModeChange('map-leads')}
            title="Map controls timeline"
            type="button"
          >
            Map → Timeline
          </button>
        </div>
      </div>
      {!selectedHasGeo && selectedEraId && (
        <div className="border-b border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-200">
          No location data for this era — showing nearby pins.
        </div>
      )}
      <div className="relative min-h-[300px] flex-1" ref={containerRef}>
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <p className="text-sm text-slate-400">Loading Azure Maps...</p>
          </div>
        )}
        {geoEras.length === 0 && isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-sm text-slate-400">
            No eras in this pack have location data.
          </div>
        )}
      </div>
    </div>
  )
}
