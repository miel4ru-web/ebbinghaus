import type { Card, ReviewLog } from '../types'
import { ebbinghausScheduler } from './ebbinghaus'

/**
 * Rebuilds card scheduling state by replaying every log entry, in chronological order,
 * through the pure scheduler. This is the sync conflict-resolution mechanism (plan
 * §동기화): merge two devices' logs, dedupe, sort by reviewedAt, and replay from each
 * card's pristine initial state (as produced by createCard — never a partially-progressed
 * snapshot) to reach one deterministic result, regardless of which device reviewed which
 * card in what order.
 */
export function replay(initialCards: Map<string, Card>, logs: ReviewLog[]): Map<string, Card> {
  const sorted = [...logs].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
  const cards = new Map(initialCards)

  for (const log of sorted) {
    const card = cards.get(log.cardId)
    if (!card) continue // log references a card that no longer exists (e.g. deleted note)
    const now = new Date(log.reviewedAt)
    const { card: updated } = ebbinghausScheduler.next(card, log.rating, now, log.durationMs)
    cards.set(card.id, updated)
  }

  return cards
}

/** Drops exact duplicate log entries (same card, same timestamp) before replay/storage. */
export function dedupeLogs(logs: ReviewLog[]): ReviewLog[] {
  const seen = new Set<string>()
  const result: ReviewLog[] = []
  for (const log of logs) {
    const key = `${log.cardId}:${log.reviewedAt}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(log)
  }
  return result
}
