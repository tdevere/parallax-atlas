#!/usr/bin/env node
/**
 * One-time script to convert Natural Earth 110m countries GeoJSON
 * into simplified SVG path data grouped by WorldRegion.
 *
 * Usage:
 *   node scripts/generate-geo-paths.mjs
 *
 * Prereq:
 *   Download ne_110m_admin_0_countries.geojson into scripts/ first.
 */
import { readFileSync, writeFileSync } from 'fs'

const raw = readFileSync('scripts/ne_110m_countries.geojson', 'utf-8')
const geojson = JSON.parse(raw)

// ── Region mapping ─────────────────────────────────────────────────────
// Map Natural Earth CONTINENT → our WorldRegion
const CONTINENT_MAP = {
  Africa: 'Africa',
  Asia: 'Asia',
  Europe: 'Europe',
  'North America': 'Americas',
  'South America': 'Americas',
  Oceania: 'Australasia',
  Antarctica: null,
  'Seven seas (open ocean)': null,
}

// Countries to reassign from Asia → Middle East
const MIDDLE_EAST = new Set([
  'Turkey',
  'Syria',
  'Iraq',
  'Iran',
  'Saudi Arabia',
  'Yemen',
  'Oman',
  'United Arab Emirates',
  'Qatar',
  'Kuwait',
  'Jordan',
  'Israel',
  'Lebanon',
  'Cyprus',
])

// ── Coordinate simplification ──────────────────────────────────────────
// Douglas-Peucker-like simplification: skip points within `tolerance`
// degrees of the line between kept neighbours.
function simplifyRing(ring, tolerance = 0.8) {
  if (ring.length <= 4) return ring

  function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd[0] - lineStart[0]
    const dy = lineEnd[1] - lineStart[1]
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(point[0] - lineStart[0], point[1] - lineStart[1])
    let t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const projX = lineStart[0] + t * dx
    const projY = lineStart[1] + t * dy
    return Math.hypot(point[0] - projX, point[1] - projY)
  }

  function dpRecurse(points, start, end, keep) {
    let maxDist = 0
    let maxIdx = start
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end])
      if (d > maxDist) {
        maxDist = d
        maxIdx = i
      }
    }
    if (maxDist > tolerance) {
      keep[maxIdx] = true
      dpRecurse(points, start, maxIdx, keep)
      dpRecurse(points, maxIdx, end, keep)
    }
  }

  const keep = new Array(ring.length).fill(false)
  keep[0] = true
  keep[ring.length - 1] = true
  dpRecurse(ring, 0, ring.length - 1, keep)
  return ring.filter((_, i) => keep[i])
}

// ── GeoJSON → SVG path ────────────────────────────────────────────────
// Equirectangular projection: x = longitude, y = -latitude (SVG y-down)
function ringToPath(ring, precision = 1) {
  const simplified = simplifyRing(ring)
  if (simplified.length < 3) return ''
  return (
    simplified
      .map(([lng, lat], i) => {
        const x = Number(lng.toFixed(precision))
        const y = Number((-lat).toFixed(precision))
        return `${i === 0 ? 'M' : 'L'}${x},${y}`
      })
      .join('') + 'Z'
  )
}

function featureToPath(feature, precision = 1) {
  const { type, coordinates } = feature.geometry
  const paths = []
  if (type === 'Polygon') {
    for (const ring of coordinates) {
      const p = ringToPath(ring, precision)
      if (p) paths.push(p)
    }
  } else if (type === 'MultiPolygon') {
    for (const polygon of coordinates) {
      for (const ring of polygon) {
        const p = ringToPath(ring, precision)
        if (p) paths.push(p)
      }
    }
  }
  return paths.join('')
}

// ── Group features by region ───────────────────────────────────────────
const regionPaths = {}
let skipped = 0
for (const feature of geojson.features) {
  const name = feature.properties.NAME
  const continent = feature.properties.CONTINENT
  let region = CONTINENT_MAP[continent]
  if (MIDDLE_EAST.has(name)) region = 'Middle East'
  if (!region) {
    skipped++
    continue
  }
  if (!regionPaths[region]) regionPaths[region] = []
  regionPaths[region].push(featureToPath(feature))
}

// ── Generate TypeScript output ─────────────────────────────────────────
const REGIONS = ['Africa', 'Americas', 'Asia', 'Australasia', 'Europe', 'Middle East']

let output = `// Auto-generated from Natural Earth 110m countries data.
// Do not edit by hand — regenerate with: node scripts/generate-geo-paths.mjs

import type { WorldRegion } from './timeline-data'

/** SVG path data for each world region (equirectangular projection).
 *  Coordinate system: x = longitude (-180…180), y = -latitude (-90…90).
 *  viewBox should be "-180 -90 360 180".
 */
export const REGION_PATHS: Record<WorldRegion, string> = {
`

for (const region of REGIONS) {
  const paths = regionPaths[region] || []
  const combined = paths.join('')
  output += `  '${region}':\n    '${combined}',\n\n`
}

output += `  Global: '', // No specific geography for global eras\n`
output += `}\n`

writeFileSync('src/data/world-regions-geo.ts', output, 'utf-8')

// ── Report ─────────────────────────────────────────────────────────────
console.log(`Generated src/data/world-regions-geo.ts`)
console.log(`  Features processed: ${geojson.features.length - skipped}`)
console.log(`  Features skipped (Antarctica / ocean): ${skipped}`)
let totalChars = 0
for (const region of REGIONS) {
  const paths = regionPaths[region] || []
  const combined = paths.join('')
  totalChars += combined.length
  console.log(`  ${region.padEnd(14)} ${combined.length.toLocaleString().padStart(7)} chars  (${paths.length} features)`)
}
console.log(`  Total path data: ${totalChars.toLocaleString()} chars`)
