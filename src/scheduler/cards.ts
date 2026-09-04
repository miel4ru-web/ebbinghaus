import { createCard } from './ebbinghaus'
import type { Card, Note } from '../types'

// How a note maps to schedulable cards. Kept out of the Note type since it's purely a
// scheduling concern, and shared by two callers that must agree exactly: CSV import (which
// materialises cards up front) and sync's log-replay (which rebuilds them from scratch).
// Both must produce the same id and the same pristine seed for replay to be deterministic.

/** Which card ords a note produces. `reverse` yields a front→back and a back→front card. */
export function cardOrdsForNote(note: Note): number[] {
  return note.type === 'reverse' ? [0, 1] : [0]
}

/** Stable card id derived from its note — also the natural key for dedupe across devices. */
export function cardId(noteId: string, ord: number): string {
  return `${noteId}:${ord}`
}

/** Pristine, never-reviewed cards for a note: used on import and as the seeds for replay. */
export function seedCardsForNote(note: Note): Card[] {
  const now = new Date(note.createdAt)
  return cardOrdsForNote(note).map((ord) =>
    createCard({ id: cardId(note.id, ord), noteId: note.id, deckId: note.deckId, ord, now }),
  )
}
