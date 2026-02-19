import { useMemo } from 'react'
import type { Era, WorldRegion } from '../data/timeline-data'
import { REGION_COLORS, WORLD_REGIONS, resolveEraRegion } from '../data/timeline-data'
import { REGION_PATHS } from '../data/world-regions-geo'

interface CivilizationMapProps {
  eras: Era[]
  progress: Record<string, number>
  width: number
  height: number
}

// ── Per-region progress aggregation ────────────────────────────────────
interface RegionStats {
  region: WorldRegion
  eraCount: number
  avgProgress: number
  studiedCount: number
  masteredCount: number
}

// ── Era light — a studied era plotted at its geoCenter ─────────────────
interface EraLight {
  era: Era
  progress: number
  region: WorldRegion
  /** SVG x in equirectangular coords (= longitude) */
  cx: number
  /** SVG y in equirectangular coords (= -latitude) */
  cy: number
}

/**
 * CivilizationMap — A Natural Earth geographic map that progressively
 * reveals continent silhouettes as the learner studies eras in each region.
 * Unstudied regions are barely visible; studied regions glow with vibrant
 * region colors. Individual era "knowledge lights" appear at geoCenter
 * locations for studied eras.
 */
export function CivilizationMap({ eras, progress, width, height }: CivilizationMapProps) {
  // Aggregate progress per region
  const regionStats = useMemo<RegionStats[]>(() => {
    const map = new Map<WorldRegion, { total: number; count: number; studied: number; mastered: number }>()
    for (const r of WORLD_REGIONS) map.set(r, { total: 0, count: 0, studied: 0, mastered: 0 })

    for (const era of eras) {
      const region = resolveEraRegion(era)
      const p = progress[era.id] ?? 0
      if (region === 'Global') {
        // Global eras contribute to every region
        for (const r of WORLD_REGIONS) {
          const s = map.get(r)!
          s.total += p; s.count++
          if (p > 0) s.studied++
          if (p >= 100) s.mastered++
        }
      } else {
        const s = map.get(region)
        if (s) {
          s.total += p; s.count++
          if (p > 0) s.studied++
          if (p >= 100) s.mastered++
        }
      }
    }

    return WORLD_REGIONS.map((region) => {
      const s = map.get(region)!
      return {
        region,
        eraCount: s.count,
        avgProgress: s.count > 0 ? Math.round(s.total / s.count) : 0,
        studiedCount: s.studied,
        masteredCount: s.mastered,
      }
    })
  }, [eras, progress])

  // Collect "knowledge light" dots for studied eras with geoCenter
  const eraLights = useMemo<EraLight[]>(() => {
    const lights: EraLight[] = []
    for (const era of eras) {
      const p = progress[era.id] ?? 0
      if (p <= 0 || !era.geoCenter) continue
      lights.push({
        era,
        progress: p,
        region: resolveEraRegion(era),
        cx: era.geoCenter.longitude,
        cy: -era.geoCenter.latitude, // SVG y is inverted
      })
    }
    return lights
  }, [eras, progress])

  // The SVG viewBox uses equirectangular projection: x=lng, y=-lat
  // We crop slightly to exclude extreme polar regions and center nicely
  const vbMinX = -180
  const vbMinY = -80 // ~80°N
  const vbW = 360
  const vbH = 160 // 80°N to 80°S

  return (
    <svg
      aria-label="Civilization progress map"
      className="civilization-map"
      height={height}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      viewBox={`${vbMinX} ${vbMinY} ${vbW} ${vbH}`}
      width={width}
    >
      <defs>
        {/* Glow filter for knowledge lights */}
        <filter id="era-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Broader glow for mastered regions */}
        <filter id="region-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Subtle graticule pattern */}
        <pattern id="graticule" width="30" height="30" patternUnits="userSpaceOnUse">
          <line x1="15" y1="0" x2="15" y2="30" stroke="#1e293b" strokeWidth="0.15" />
          <line x1="0" y1="15" x2="30" y2="15" stroke="#1e293b" strokeWidth="0.15" />
        </pattern>
      </defs>

      {/* Deep ocean background */}
      <rect fill="#020617" height={vbH} width={vbW} x={vbMinX} y={vbMinY} />

      {/* Subtle graticule grid — gives the ocean texture */}
      <rect fill="url(#graticule)" height={vbH} opacity="0.6" width={vbW} x={vbMinX} y={vbMinY} />

      {/* ── Continent silhouettes ── */}
      {regionStats.map((stats) => {
        const pathData = REGION_PATHS[stats.region]
        if (!pathData) return null
        const colors = REGION_COLORS[stats.region]
        const frac = stats.avgProgress / 100

        // Progressive reveal: near-invisible when unstudied → vivid when mastered
        const baseOpacity = 0.07
        const revealOpacity = baseOpacity + frac * 0.73
        const saturation = 0.12 + frac * 0.88

        return (
          <g className="civ-region" key={stats.region}>
            {/* Faint outline so continent shape is always slightly visible */}
            <path
              d={pathData}
              fill="none"
              opacity={0.2}
              stroke={colors.fill}
              strokeWidth="0.3"
            />

            {/* Continent fill — reveals with progress */}
            <path
              className="civ-region-fill"
              d={pathData}
              fill={colors.fill}
              opacity={revealOpacity}
              style={{
                transition: 'opacity 0.8s ease, filter 0.8s ease',
                filter: `saturate(${saturation})`,
              }}
            />

            {/* Extra glow layer for mastered regions */}
            {stats.avgProgress >= 80 && (
              <path
                className="civ-mastered-glow"
                d={pathData}
                fill={colors.fill}
                filter="url(#region-glow)"
                opacity={0.25 + (stats.avgProgress - 80) * 0.0125}
              />
            )}

            {/* Region label — appears when some progress exists */}
            {stats.avgProgress > 5 && (
              <text
                className="civ-region-label"
                dominantBaseline="middle"
                fill={colors.fill}
                fontSize="5"
                fontWeight="700"
                opacity={Math.min(0.9, 0.3 + frac * 0.6)}
                style={{ transition: 'opacity 0.6s ease' }}
                textAnchor="middle"
                x={regionLabelPos(stats.region).x}
                y={regionLabelPos(stats.region).y}
              >
                {colors.label} · {stats.avgProgress}%
              </text>
            )}
          </g>
        )
      })}

      {/* ── Knowledge lights — individual era study markers ── */}
      {eraLights.map((light) => {
        const colors = REGION_COLORS[light.region] ?? REGION_COLORS.Global
        const frac = light.progress / 100
        const radius = 0.8 + frac * 1.2

        return (
          <g className="civ-era-light" key={light.era.id}>
            {/* Glow halo */}
            <circle
              cx={light.cx}
              cy={light.cy}
              fill={colors.fill}
              filter="url(#era-glow)"
              opacity={0.15 + frac * 0.35}
              r={radius * 2.5}
            />
            {/* Core dot */}
            <circle
              cx={light.cx}
              cy={light.cy}
              fill="#f8fafc"
              opacity={0.5 + frac * 0.5}
              r={radius}
              style={{ transition: 'r 0.4s ease, opacity 0.4s ease' }}
            />
            {/* Era label for well-studied eras */}
            {light.progress >= 25 && (
              <text
                dominantBaseline="hanging"
                fill="#f8fafc"
                fontSize="2.5"
                fontWeight="500"
                opacity={Math.min(0.9, 0.2 + frac * 0.7)}
                style={{ transition: 'opacity 0.5s ease' }}
                textAnchor="middle"
                x={light.cx}
                y={light.cy + radius + 1.5}
              >
                {light.era.content.length > 20
                  ? light.era.content.slice(0, 18) + '…'
                  : light.era.content}
              </text>
            )}
            {/* Gold ring for mastered eras */}
            {light.progress >= 100 && (
              <circle
                className="civ-mastered-glow"
                cx={light.cx}
                cy={light.cy}
                fill="none"
                r={radius + 0.6}
                stroke="#fcd34d"
                strokeWidth="0.4"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Approximate label positions per region (equirectangular coords) ───
function regionLabelPos(region: WorldRegion): { x: number; y: number } {
  switch (region) {
    case 'Africa': return { x: 20, y: 5 }
    case 'Americas': return { x: -90, y: 10 }
    case 'Asia': return { x: 90, y: -30 }
    case 'Australasia': return { x: 134, y: 28 }
    case 'Europe': return { x: 15, y: -50 }
    case 'Middle East': return { x: 45, y: -28 }
    default: return { x: 0, y: 0 }
  }
}
