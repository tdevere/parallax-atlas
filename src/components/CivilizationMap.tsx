import { useMemo } from 'react'
import type { Era, WorldRegion } from '../data/timeline-data'
import { REGION_COLORS, WORLD_REGIONS, resolveEraRegion, formatYearsAgo } from '../data/timeline-data'

interface CivilizationMapProps {
  eras: Era[]
  progress: Record<string, number>
  width: number
  height: number
}

// ── Time column breakpoints (years ago) ────────────────────────────────
// These define the columns in the Schofield-style grid.
// Denser columns for recent history where more civilizations overlap.
const TIME_COLUMNS: { start: number; end: number; label: string }[] = [
  { start: 14e9, end: 4e9, label: '14–4 Bya' },
  { start: 4e9, end: 500e6, label: '4 Bya–500 Mya' },
  { start: 500e6, end: 50e6, label: '500–50 Mya' },
  { start: 50e6, end: 1e6, label: '50–1 Mya' },
  { start: 1e6, end: 100000, label: '1 Mya–100k' },
  { start: 100000, end: 12000, label: '100k–12k' },
  { start: 12000, end: 5000, label: '12k–5k' },
  { start: 5000, end: 3000, label: '5k–3k' },
  { start: 3000, end: 2000, label: '3000 BC–AD 1' },
  { start: 2000, end: 1000, label: 'AD 1–1000' },
  { start: 1000, end: 500, label: '1000–1500' },
  { start: 500, end: 250, label: '1500–1776' },
  { start: 250, end: 100, label: '1776–1926' },
  { start: 100, end: 0, label: '1926–Today' },
]

interface CellData {
  region: WorldRegion
  colIndex: number
  eras: { era: Era; progress: number }[]
  avgProgress: number
  maxProgress: number
  label: string
}

/**
 * CivilizationMap — A Schofield & Sims-inspired region × time grid that
 * progressively reveals as the learner studies. Unstudied cells are dark
 * and muted; studied cells fill with vibrant region colors.
 */
export function CivilizationMap({ eras, progress, width, height }: CivilizationMapProps) {
  const cells = useMemo(() => {
    const result: CellData[] = []

    for (const region of WORLD_REGIONS) {
      for (let colIndex = 0; colIndex < TIME_COLUMNS.length; colIndex++) {
        const col = TIME_COLUMNS[colIndex]
        // Find eras that overlap this region × time cell
        const matching = eras
          .filter((era) => {
            const eraRegion = resolveEraRegion(era)
            if (eraRegion !== region && eraRegion !== 'Global') return false
            // Era overlaps column if era.start >= col.end AND era.end <= col.start
            return era.start >= col.end && era.end <= col.start
          })
          .map((era) => ({ era, progress: progress[era.id] ?? 0 }))

        const progressValues = matching.map((m) => m.progress)
        const avgProgress = progressValues.length > 0
          ? Math.round(progressValues.reduce((s, v) => s + v, 0) / progressValues.length)
          : 0
        const maxProgress = progressValues.length > 0
          ? Math.max(...progressValues)
          : 0

        // Only include cells that have at least one era
        if (matching.length > 0) {
          // Pick the most progressed era as the label, or the first alphabetically
          const bestEra = [...matching].sort((a, b) => b.progress - a.progress || a.era.content.localeCompare(b.era.content))[0]
          result.push({
            region,
            colIndex,
            eras: matching,
            avgProgress,
            maxProgress,
            label: bestEra?.era.content ?? '',
          })
        }
      }
    }
    return result
  }, [eras, progress])

  // Layout constants
  const leftLabelWidth = 90
  const topLabelHeight = 32
  const gridWidth = width - leftLabelWidth
  const gridHeight = height - topLabelHeight
  const colWidth = gridWidth / TIME_COLUMNS.length
  const rowHeight = gridHeight / WORLD_REGIONS.length

  return (
    <svg
      aria-label="Civilization progress map"
      className="civilization-map"
      height={height}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <defs>
        {/* Subtle noise filter for a parchment-like feel */}
        <filter id="civ-noise">
          <feTurbulence baseFrequency="0.65" numOctaves="3" result="noise" type="fractalNoise" />
          <feColorMatrix in="noise" result="monoNoise" type="saturate" values="0" />
          <feBlend in="SourceGraphic" in2="monoNoise" mode="multiply" />
        </filter>
      </defs>

      {/* Background */}
      <rect fill="#020617" height={height} width={width} x="0" y="0" />

      {/* Region row labels (left axis) */}
      {WORLD_REGIONS.map((region, rowIndex) => {
        const y = topLabelHeight + rowIndex * rowHeight
        const colors = REGION_COLORS[region]
        return (
          <g key={region}>
            {/* Row background band */}
            <rect
              fill={colors.muted}
              height={rowHeight}
              opacity="0.15"
              width={gridWidth}
              x={leftLabelWidth}
              y={y}
            />
            {/* Row border */}
            <line
              stroke="#1e293b"
              strokeWidth="0.5"
              x1={leftLabelWidth}
              x2={width}
              y1={y}
              y2={y}
            />
            {/* Label */}
            <text
              dominantBaseline="middle"
              fill={colors.fill}
              fontSize="11"
              fontWeight="600"
              opacity="0.85"
              textAnchor="end"
              x={leftLabelWidth - 8}
              y={y + rowHeight / 2}
            >
              {colors.label}
            </text>
          </g>
        )
      })}

      {/* Time column labels (top axis) */}
      {TIME_COLUMNS.map((col, colIndex) => {
        const x = leftLabelWidth + colIndex * colWidth
        return (
          <g key={col.label}>
            {/* Column border */}
            <line
              stroke="#1e293b"
              strokeWidth="0.5"
              x1={x}
              x2={x}
              y1={topLabelHeight}
              y2={height}
            />
            {/* Label */}
            <text
              dominantBaseline="hanging"
              fill="#94a3b8"
              fontSize="8"
              textAnchor="middle"
              x={x + colWidth / 2}
              y={4}
            >
              {formatYearsAgo(col.start)}
            </text>
          </g>
        )
      })}

      {/* Civilization cells — the progressive reveal layer */}
      {cells.map((cell) => {
        const rowIndex = WORLD_REGIONS.indexOf(cell.region)
        const x = leftLabelWidth + cell.colIndex * colWidth
        const y = topLabelHeight + rowIndex * rowHeight
        const colors = REGION_COLORS[cell.region]

        // Progress drives reveal: 0% → near invisible, 100% → fully vivid
        const progressFraction = cell.avgProgress / 100
        const baseOpacity = 0.06
        const revealOpacity = baseOpacity + progressFraction * 0.74
        const saturation = 0.15 + progressFraction * 0.85
        const cellPad = 1.5

        return (
          <g className="civ-cell" key={`${cell.region}-${cell.colIndex}`}>
            {/* Cell fill — reveals with progress */}
            <rect
              fill={colors.fill}
              height={rowHeight - cellPad * 2}
              opacity={revealOpacity}
              rx="3"
              ry="3"
              style={{
                transition: 'opacity 0.6s ease, filter 0.6s ease',
                filter: `saturate(${saturation})`,
              }}
              width={colWidth - cellPad * 2}
              x={x + cellPad}
              y={y + cellPad}
            />

            {/* Progress bar along bottom edge */}
            {cell.avgProgress > 0 && (
              <rect
                fill={colors.fill}
                height="2.5"
                opacity={0.5 + progressFraction * 0.5}
                rx="1"
                width={(colWidth - cellPad * 4) * progressFraction}
                x={x + cellPad * 2}
                y={y + rowHeight - cellPad - 4}
              />
            )}

            {/* Label — only visible when progress > 15% */}
            {cell.avgProgress > 15 && (
              <text
                dominantBaseline="middle"
                fill="#f8fafc"
                fontSize={colWidth < 60 ? '7' : '9'}
                fontWeight="500"
                opacity={Math.min(1, 0.3 + progressFraction * 0.7)}
                style={{ transition: 'opacity 0.5s ease' }}
                textAnchor="middle"
                x={x + colWidth / 2}
                y={y + rowHeight / 2 - 4}
              >
                {cell.label.length > 16 ? cell.label.slice(0, 14) + '…' : cell.label}
              </text>
            )}

            {/* Era count badge — shows when multiple eras in cell */}
            {cell.eras.length > 1 && cell.avgProgress > 10 && (
              <text
                dominantBaseline="middle"
                fill={colors.fill}
                fontSize="7"
                fontWeight="700"
                opacity={0.5 + progressFraction * 0.5}
                textAnchor="middle"
                x={x + colWidth / 2}
                y={y + rowHeight / 2 + 8}
              >
                {cell.eras.length} eras · {cell.avgProgress}%
              </text>
            )}

            {/* Mastery glow for 100% cells */}
            {cell.avgProgress >= 100 && (
              <rect
                className="civ-mastered-glow"
                fill="none"
                height={rowHeight - cellPad * 2}
                rx="3"
                ry="3"
                stroke="#fcd34d"
                strokeWidth="1.5"
                width={colWidth - cellPad * 2}
                x={x + cellPad}
                y={y + cellPad}
              />
            )}
          </g>
        )
      })}

      {/* Grid outer border */}
      <rect
        fill="none"
        height={gridHeight}
        rx="4"
        stroke="#334155"
        strokeWidth="1"
        width={gridWidth}
        x={leftLabelWidth}
        y={topLabelHeight}
      />
    </svg>
  )
}
