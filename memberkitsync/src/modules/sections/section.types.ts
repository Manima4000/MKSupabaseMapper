import type { Section, SectionInsert } from '../../shared/types.js'
import type { MKSection } from '../../sync/memberkit-api.client.js'

export type { Section, SectionInsert }
export type MKSectionPayload = MKSection

export interface UpsertSectionInput {
  mkId: number
  courseId: number
  name: string
  position: number
  slug: string | null
  createdAt?: string
}
