// Core data model. Three layers, deliberately kept separate (see ebbinghaus-data/README.md):
//   Note (content, what you edit) -> Card (a schedulable unit) -> ReviewLog (immutable history)
// A note can produce multiple cards (e.g. a "reverse" note yields a front->back and a
// back->front card) with independent schedules, because recognition and recall forget at
// different rates even though they share the same underlying fact.

export type NoteType = 'basic' | 'reverse' | 'cloze'

export interface Note {
  id: string
  deckId: string
  type: NoteType
  /** Field names depend on `type`, e.g. { front, back } for 'basic'. */
  fields: Record<string, string>
  tags: string[]
  createdAt: string
  modifiedAt: string
}

export interface Card {
  id: string
  noteId: string
  deckId: string
  /** Which card template within the note this is (0 for the only card of a 'basic' note). */
  ord: number
  /** Index into LADDER_MINUTES; -1 (NEW_STEP) means "never reviewed". */
  step: number
  /** Per-card difficulty multiplier applied to the ladder interval. Range [EASE_MIN, EASE_MAX]. */
  ease: number
  /** ISO timestamp of next scheduled review. */
  due: string
  lapses: number
  reps: number
  suspended: boolean
}

/** 0 = 모름 (forgot), 1 = 알음 (recalled). */
export type Rating = 0 | 1

export interface ReviewLog {
  cardId: string
  /** ISO timestamp; combined with cardId this is the log's natural, dedupe-friendly key. */
  reviewedAt: string
  rating: Rating
  stepBefore: number
  easeBefore: number
  intervalBeforeMinutes: number
  intervalAfterMinutes: number
  durationMs: number
}

export interface Deck {
  id: string
  name: string
  /** Daily cap on new cards introduced from this deck — the main review-debt lever. */
  newCardsPerDay: number
  createdAt: string
}
