import type { DBSchema } from 'idb'
import type { Card, Deck, Note, ReviewLog } from '../types'

export interface EbbinghausDB extends DBSchema {
  notes: {
    key: string
    value: Note
    indexes: { 'by-deck': string }
  }
  cards: {
    key: string
    value: Card
    indexes: { 'by-deck': string; 'by-due': string; 'by-note': string }
  }
  reviewLogs: {
    key: [string, string] // [cardId, reviewedAt] — also the natural dedupe key
    value: ReviewLog
    indexes: { 'by-card': string }
  }
  decks: {
    key: string
    value: Deck
  }
}
