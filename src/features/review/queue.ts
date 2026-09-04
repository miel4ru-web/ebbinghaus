import { getAllReviewLogs, getCardsByDeck } from '../../db'
import { NEW_STEP } from '../../scheduler/ebbinghaus'
import type { Card } from '../../types'

export interface QueueConfig {
  now: Date
  newCardsPerDay: number
  sessionLimit: number
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Builds today's review queue for a deck: due reviews first, then new cards up to the
 * deck's remaining daily cap (the main review-debt lever — see plan §리뷰 부채 방어),
 * capped at a session limit, with same-note siblings spread apart so seeing one card
 * doesn't give away its pair (plan §패턴 인식으로의 퇴화).
 */
export async function buildQueue(deckId: string, config: QueueConfig): Promise<Card[]> {
  const all = await getCardsByDeck(deckId)
  const due = all.filter((c) => !c.suspended && new Date(c.due).getTime() <= config.now.getTime())

  const dayStart = startOfDay(config.now).toISOString()
  const logs = await getAllReviewLogs()
  const deckCardIds = new Set(all.map((c) => c.id))
  const newReviewedToday = logs.filter(
    (l) => l.reviewedAt >= dayStart && l.stepBefore === NEW_STEP && deckCardIds.has(l.cardId),
  ).length

  const reviewCards = due.filter((c) => c.step !== NEW_STEP).sort((a, b) => a.due.localeCompare(b.due))
  const newCards = due.filter((c) => c.step === NEW_STEP)
  const newBudget = Math.max(0, config.newCardsPerDay - newReviewedToday)

  const queue = [...reviewCards, ...newCards.slice(0, newBudget)]
  return dedupeSiblings(queue).slice(0, config.sessionLimit)
}

function dedupeSiblings(cards: Card[]): Card[] {
  const pending = [...cards]
  const result: Card[] = []
  let lastNoteId: string | null = null
  while (pending.length > 0) {
    let idx = pending.findIndex((c) => c.noteId !== lastNoteId)
    if (idx === -1) idx = 0
    const [card] = pending.splice(idx, 1)
    result.push(card)
    lastNoteId = card.noteId
  }
  return result
}
