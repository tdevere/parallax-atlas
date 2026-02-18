export type SourceFormat = 'paper' | 'video' | 'dataset' | 'report' | 'overview' | 'book' | 'lecture'

export interface Source {
  id: string
  title: string
  url: string
  format: SourceFormat
  author?: string
  year?: number
  domain?: string
  snippet?: string
  difficulty?: 'intro' | 'intermediate' | 'advanced'
  estimatedMinutes?: number
}

export const FORMAT_ICON: Record<SourceFormat, string> = {
  paper: '📄',
  video: '🎬',
  dataset: '📊',
  report: '📋',
  overview: '🌐',
  book: '📚',
  lecture: '🎓',
}

export const FORMAT_LABEL: Record<SourceFormat, string> = {
  paper: 'Paper',
  video: 'Video',
  dataset: 'Dataset',
  report: 'Report',
  overview: 'Overview',
  book: 'Book',
  lecture: 'Lecture',
}
