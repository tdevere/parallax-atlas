import type { SourceFormat } from '../sources/source-types'

export type NotebookAction =
  | 'viewed-source'
  | 'logged-source'
  | 'explored-era'
  | 'completed-mission'
  | 'insight'
  | 'question'
  | 'connection-made'

export interface NotebookEntry {
  id: string
  timestamp: string
  eraId: string
  eraContent: string
  eraGroup: string
  sourceId?: string
  sourceTitle?: string
  sourceUrl?: string
  sourceFormat?: SourceFormat
  action: NotebookAction
  note?: string
  progressAtTime?: number
  /** Cross-era links — the student's personal connections */
  linkedEraIds?: string[]
  /** Free-form tags for categorization */
  tags?: string[]
}
