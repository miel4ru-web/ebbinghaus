import { LADDER_MINUTES } from './ladder'
import { seededUnit } from '../lib/hash'
import type { Card, Rating, ReviewLog } from '../types'

/** Sentinel step for a card that has never been reviewed. */
export const NEW_STEP = -1

export const EASE_MIN = 0.5
export const EASE_MAX = 2.5
export const EASE_DEFAULT = 1.0

/** Interval is scaled by a factor in [1 - FUZZ_SPAN, 1 + FUZZ_SPAN]. */
export const FUZZ_SPAN = 0.08

/** How many ladder rungs a lapse ("모름") drops a card. */
export const LAPSE_STEP_PENALTY = 2

const MAX_STEP = LADDER_MINUTES.length - 1

export interface SchedulerResult {
  card: Card
  log: ReviewLog
}

export interface Scheduler {
  next(card: Card, rating: Rating, now: Date, durationMs: number): SchedulerResult
}

function clampStep(step: number): number {
  return Math.max(0, Math.min(MAX_STEP, step))
}

function clampEase(ease: number): number {
  return Math.max(EASE_MIN, Math.min(EASE_MAX, ease))
}

/**
 * Deterministic pseudo-random scale factor for one specific review. Seeded by
 * (cardId, reps) rather than wall-clock or Math.random so that replaying a review log
 * — the sync conflict-resolution strategy (see replay.ts) — always reproduces the exact
 * same due date. Never change this to use Date.now() or Math.random().
 */
function fuzzFor(cardId: string, reps: number): number {
  const unit = seededUnit(`${cardId}:${reps}`) // [0, 1)
  return 1 - FUZZ_SPAN + unit * (2 * FUZZ_SPAN)
}

/**
 * Pure scheduling function: next(card, rating, now, durationMs) always returns the same
 * result for the same inputs. This purity is load-bearing — see replay.ts.
 */
function next(card: Card, rating: Rating, now: Date, durationMs: number): SchedulerResult {
  const stepBefore = card.step
  const easeBefore = card.ease
  const intervalBeforeMinutes = stepBefore < 0 ? 0 : LADDER_MINUTES[clampStep(stepBefore)]

  const dueDate = new Date(card.due)
  const wasLate = now.getTime() > dueDate.getTime()

  let step = stepBefore
  let ease = easeBefore
  let lapses = card.lapses
  const reps = card.reps + 1

  if (rating === 1) {
    step = clampStep(step + 1)
    ease *= 1.05
    if (wasLate) {
      // Reviewed later than scheduled and still recalled correctly: actual retention is
      // stronger than the ladder predicted, so reward it beyond the normal bump.
      ease *= 1.15
    }
  } else {
    step = clampStep(step - LAPSE_STEP_PENALTY)
    ease *= 0.75
    lapses += 1
  }
  ease = clampEase(ease)

  const fuzz = fuzzFor(card.id, reps)
  const intervalAfterMinutes = LADDER_MINUTES[step] * ease * fuzz
  const due = new Date(now.getTime() + intervalAfterMinutes * 60_000).toISOString()

  const updatedCard: Card = { ...card, step, ease, due, lapses, reps }

  const log: ReviewLog = {
    cardId: card.id,
    reviewedAt: now.toISOString(),
    rating,
    stepBefore,
    easeBefore,
    intervalBeforeMinutes,
    intervalAfterMinutes,
    durationMs,
  }

  return { card: updatedCard, log }
}

export const ebbinghausScheduler: Scheduler = { next }

export function createCard(params: { id: string; noteId: string; deckId: string; ord: number; now: Date }): Card {
  return {
    id: params.id,
    noteId: params.noteId,
    deckId: params.deckId,
    ord: params.ord,
    step: NEW_STEP,
    ease: EASE_DEFAULT,
    due: params.now.toISOString(),
    lapses: 0,
    reps: 0,
    suspended: false,
  }
}

/** Human-readable preview of the interval a rating would produce — for grading buttons. */
export function previewInterval(card: Card, rating: Rating, now: Date): string {
  const { card: after } = next(card, rating, now, 0)
  const minutes = (new Date(after.due).getTime() - now.getTime()) / 60_000
  return formatMinutes(minutes)
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}분`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간`
  const days = minutes / (60 * 24)
  if (days < 30) return `${Math.round(days)}일`
  if (days < 365) return `${Math.round(days / 30)}개월`
  return `${Math.round(days / 365)}년`
}
