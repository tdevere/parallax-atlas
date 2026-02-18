import type { Source } from '../sources/source-types'

export type EraPayloadType = 'concept-sorting' | 'synthesis-challenge' | 'active-recall' | 'guided-reading' | 'quiz' | 'reflection' | 'spaced-recall'

export type DifficultyLevel = 'intro' | 'intermediate' | 'advanced'

export interface PrimarySourceSnippet {
  id: string
  quote: string
  source: string
  relativeOffsetLabel?: string
}

export interface EraPayload {
  taskType: EraPayloadType
  missionTitle: string
  prompt: string
  completionEvidenceHint: string
  primarySourceSnippets?: PrimarySourceSnippet[]
}

export interface EraConnection {
  targetEraId: string
  kind: 'analogy' | 'influence' | 'contrast' | 'application'
  strength?: number
}

export interface Era {
  id: string
  content: string
  start: number
  end: number
  group: string
  description?: string
  defaultColor?: string
  parentId?: string
  prerequisiteIds?: string[]
  connections?: EraConnection[]
  zoomBand?: 'cosmic' | 'macro' | 'historical' | 'modern' | 'micro'
  payload?: EraPayload
  sources?: Source[]
  geoCenter?: { latitude: number; longitude: number; zoom?: number; heading?: number }
  difficulty?: DifficultyLevel
  learningObjectives?: string[]
  estimatedMinutes?: number
  skillTags?: string[]
}

export const eras: Era[] = [
  { id: 'big-bang', content: 'Big Bang', start: 13.8e9, end: 13.75e9, group: 'Cosmology', description: 'Rapid expansion marks the beginning of the observable universe.' },
  { id: 'first-stars', content: 'First Stars', start: 13.5e9, end: 13.2e9, group: 'Cosmology', description: 'Population III stars ignite and begin early element production.' },
  { id: 'reionization', content: 'Reionization', start: 1.2e9, end: 0.9e9, group: 'Cosmology', description: 'Ultraviolet light from early galaxies reionizes intergalactic hydrogen.' },
  { id: 'milky-way', content: 'Milky Way Formation', start: 1.0e10, end: 8.5e9, group: 'Cosmology', description: 'Our galaxy assembles through mergers and gas accretion.' },
  { id: 'solar-system', content: 'Solar System Forms', start: 4.6e9, end: 4.5e9, group: 'Geology', description: 'The Sun and surrounding planetary disk form from a molecular cloud.' },
  { id: 'late-heavy-bombardment', content: 'Late Heavy Bombardment', start: 4.1e9, end: 3.8e9, group: 'Geology', description: 'Intense impacts reshape surfaces in the inner solar system.' },
  { id: 'first-life', content: 'First Life', start: 3.8e9, end: 3.5e9, group: 'Biology', description: 'Earliest evidence of simple microbial life appears on Earth.', geoCenter: { latitude: -26.2, longitude: 29.0, zoom: 6 } },
  { id: 'great-oxygenation', content: 'Great Oxygenation', start: 2.4e9, end: 2.0e9, group: 'Biology', description: 'Photosynthetic microbes raise atmospheric oxygen levels.' },
  { id: 'multicellular-life', content: 'Multicellular Life', start: 1.2e9, end: 0.8e9, group: 'Biology', description: 'Complex organisms with differentiated cells emerge.' },
  { id: 'cambrian', content: 'Cambrian Explosion', start: 5.4e8, end: 4.85e8, group: 'Biology', description: 'Rapid diversification of major animal body plans.', geoCenter: { latitude: 51.76, longitude: -3.05, zoom: 8 } },
  { id: 'dinosaurs', content: 'Age of Dinosaurs', start: 2.3e8, end: 6.6e7, group: 'Biology', description: 'Dinosaurs dominate terrestrial ecosystems for over 160 million years.', geoCenter: { latitude: 20.67, longitude: -89.65, zoom: 6 } },
  { id: 'mammal-expansion', content: 'Mammal Expansion', start: 6.6e7, end: 2.0e6, group: 'Biology', description: 'Mammals diversify after the Cretaceous-Paleogene extinction.' },
  { id: 'homo-sapiens', content: 'Homo sapiens', start: 3e5, end: 0, group: 'Human History', description: 'Anatomically modern humans emerge and spread globally.', geoCenter: { latitude: -2.0, longitude: 36.8, zoom: 5 } },
  { id: 'agriculture', content: 'Agriculture', start: 1.2e4, end: 7e3, group: 'Human History', description: 'Farming and permanent settlements begin in multiple regions.', geoCenter: { latitude: 37.0, longitude: 43.0, zoom: 6 } },
  { id: 'classical-civilizations', content: 'Classical Civilizations', start: 2.8e3, end: 1.5e3, group: 'Human History', description: 'Large empires and philosophical traditions shape societies.', geoCenter: { latitude: 41.9, longitude: 12.5, zoom: 5 } },
  { id: 'scientific-revolution', content: 'Scientific Revolution', start: 500, end: 300, group: 'Human History', description: 'Modern scientific methods and institutions gain traction.', geoCenter: { latitude: 51.5, longitude: -0.1, zoom: 6 } },
  { id: 'industrial-revolution', content: 'Industrial Revolution', start: 250, end: 150, group: 'Human History', description: 'Mechanized industry transforms economies and demographics.', geoCenter: { latitude: 53.5, longitude: -2.2, zoom: 8 } },
  { id: 'internet-era', content: 'Internet Era', start: 40, end: 0, group: 'Human History', description: 'Global digital networks redefine communication and knowledge exchange.', geoCenter: { latitude: 37.4, longitude: -122.1, zoom: 10 } },
  { id: 'today', content: 'Today', start: 1, end: 0, group: 'Human History', description: 'Present day reference point on the timeline.' },
]

export const formatYearsAgo = (yearsAgo: number): string => {
  if (yearsAgo <= 1) return 'Today'
  if (yearsAgo >= 1e9) return `${(yearsAgo / 1e9).toFixed(1)} Bya`
  if (yearsAgo >= 1e6) return `${(yearsAgo / 1e6).toFixed(1)} Mya`
  if (yearsAgo >= 1e3) return `${Math.round(yearsAgo).toLocaleString()} ya`
  return `${Math.round(new Date().getFullYear() - yearsAgo)} CE`
}

export const colorForProgress = (value: number): string => {
  if (value >= 100) return '#fcd34d'
  if (value >= 75) return '#facc15'
  if (value >= 50) return '#22c55e'
  if (value >= 25) return '#2563eb'
  return '#374151'
}

const GROUP_HUES: Record<string, { fill: string; base: string; accent: string }> = {
  'Cosmology': { fill: '#8b5cf6', base: '#2e1065', accent: '#a78bfa' },
  'Geology': { fill: '#f59e0b', base: '#451a03', accent: '#fbbf24' },
  'Biology': { fill: '#10b981', base: '#064e3b', accent: '#34d399' },
  'Human History': { fill: '#3b82f6', base: '#1e3a5f', accent: '#60a5fa' },
  'Computation Track': { fill: '#06b6d4', base: '#083344', accent: '#22d3ee' },
  'AI Timeline': { fill: '#14b8a6', base: '#042f2e', accent: '#2dd4bf' },
  'Genius Track': { fill: '#f43f5e', base: '#4c0519', accent: '#fb7185' },
  'Biology Track': { fill: '#10b981', base: '#064e3b', accent: '#34d399' },
}

const DEFAULT_HUE = { fill: '#64748b', base: '#0f172a', accent: '#94a3b8' }

export const groupHue = (group: string): { fill: string; base: string; accent: string } =>
  GROUP_HUES[group] ?? DEFAULT_HUE

export const badgeClassForProgress = (value: number): string => {
  if (value >= 100) return 'bg-amber-300 text-black'
  if (value >= 75) return 'bg-yellow-400 text-black'
  if (value >= 50) return 'bg-green-500 text-black'
  if (value >= 25) return 'bg-blue-600 text-white'
  return 'bg-slate-700 text-slate-100'
}

export const milestoneLabelForProgress = (value: number): string => {
  if (value >= 100) return 'Mastered — teach it to someone.'
  if (value >= 75) return 'Advanced — one more push to mastery.'
  if (value >= 50) return 'Momentum building — keep going.'
  if (value >= 25) return 'Great start — foundations are forming.'
  if (value > 0) return 'First steps complete — keep exploring.'
  return 'Ready to begin this era.'
}
