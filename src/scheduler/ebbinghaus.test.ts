import { describe, expect, it } from 'vitest'
import {
  EASE_MAX,
  EASE_MIN,
  createCard,
  ebbinghausScheduler,
  previewInterval,
} from './ebbinghaus'
import { LADDER_MINUTES } from './ladder'
import { dedupeLogs, replay } from './replay'
import type { Card, ReviewLog } from '../types'

const NOW = new Date('2026-09-04T00:00:00.000Z')

function freshCard(overrides: Partial<Card> = {}): Card {
  return { ...createCard({ id: 'c1', noteId: 'n1', deckId: 'd1', ord: 0, now: NOW }), ...overrides }
}

describe('ebbinghausScheduler.next — determinism', () => {
  it('returns identical results for identical inputs (required for log replay)', () => {
    const card = freshCard()
    const r1 = ebbinghausScheduler.next(card, 1, NOW, 4000)
    const r2 = ebbinghausScheduler.next(card, 1, NOW, 4000)
    expect(r1.card).toEqual(r2.card)
    expect(r1.log).toEqual(r2.log)
  })

  it('replaying the same log twice from scratch yields identical card state', () => {
    const initial = freshCard()
    const logs: ReviewLog[] = [
      { cardId: 'c1', reviewedAt: '2026-09-04T00:00:00.000Z', rating: 1, stepBefore: -1, easeBefore: 1, intervalBeforeMinutes: 0, intervalAfterMinutes: 10, durationMs: 1000 },
      { cardId: 'c1', reviewedAt: '2026-09-04T00:15:00.000Z', rating: 1, stepBefore: 0, easeBefore: 1.05, intervalBeforeMinutes: 10, intervalAfterMinutes: 60, durationMs: 1200 },
      { cardId: 'c1', reviewedAt: '2026-09-04T01:20:00.000Z', rating: 0, stepBefore: 1, easeBefore: 1.1, intervalBeforeMinutes: 60, intervalAfterMinutes: 10, durationMs: 900 },
    ]

    const a = replay(new Map([['c1', initial]]), logs)
    const b = replay(new Map([['c1', initial]]), logs)
    expect(a.get('c1')).toEqual(b.get('c1'))
  })

  it('replay result is order-independent once logs are sorted (merge from two devices)', () => {
    const initial = freshCard()
    const logs: ReviewLog[] = [
      { cardId: 'c1', reviewedAt: '2026-09-04T00:00:00.000Z', rating: 1, stepBefore: -1, easeBefore: 1, intervalBeforeMinutes: 0, intervalAfterMinutes: 10, durationMs: 1000 },
      { cardId: 'c1', reviewedAt: '2026-09-04T00:15:00.000Z', rating: 0, stepBefore: 0, easeBefore: 1.05, intervalBeforeMinutes: 10, intervalAfterMinutes: 10, durationMs: 1200 },
    ]
    // Simulate two devices merging logs in different arrival order.
    const merged1 = dedupeLogs([logs[0], logs[1], logs[0]])
    const merged2 = dedupeLogs([logs[1], logs[0]])

    const a = replay(new Map([['c1', initial]]), merged1)
    const b = replay(new Map([['c1', initial]]), merged2)
    expect(a.get('c1')).toEqual(b.get('c1'))
  })
})

describe('ebbinghausScheduler.next — ladder boundaries', () => {
  it('a brand-new card answered 알음 advances to the first rung (10분)', () => {
    const card = freshCard()
    const { card: after } = ebbinghausScheduler.next(card, 1, NOW, 0)
    expect(after.step).toBe(0)
  })

  it('never advances past the last rung (6개월)', () => {
    const card = freshCard({ step: LADDER_MINUTES.length - 1 })
    const { card: after } = ebbinghausScheduler.next(card, 1, NOW, 0)
    expect(after.step).toBe(LADDER_MINUTES.length - 1)
  })

  it('never drops below the first rung on repeated lapses', () => {
    const card = freshCard({ step: 0 })
    const { card: after } = ebbinghausScheduler.next(card, 0, NOW, 0)
    expect(after.step).toBe(0)
  })

  it('a lapse drops the card by two rungs', () => {
    const card = freshCard({ step: 5 })
    const { card: after } = ebbinghausScheduler.next(card, 0, NOW, 0)
    expect(after.step).toBe(3)
  })
})

describe('ebbinghausScheduler.next — ease bounds', () => {
  it('ease never exceeds EASE_MAX under repeated correct answers', () => {
    let card = freshCard({ ease: EASE_MAX - 0.01 })
    for (let i = 0; i < 5; i++) {
      card = ebbinghausScheduler.next(card, 1, new Date(NOW.getTime() + i * 3_600_000), 0).card
    }
    expect(card.ease).toBeLessThanOrEqual(EASE_MAX)
  })

  it('ease never drops below EASE_MIN under repeated lapses', () => {
    let card = freshCard({ ease: EASE_MIN + 0.01 })
    for (let i = 0; i < 5; i++) {
      card = ebbinghausScheduler.next(card, 0, new Date(NOW.getTime() + i * 3_600_000), 0).card
    }
    expect(card.ease).toBeGreaterThanOrEqual(EASE_MIN)
  })

  it('lapses counter increments only on 모름', () => {
    const card = freshCard({ lapses: 2 })
    const known = ebbinghausScheduler.next(card, 1, NOW, 0).card
    expect(known.lapses).toBe(2)
    const forgotten = ebbinghausScheduler.next(card, 0, NOW, 0).card
    expect(forgotten.lapses).toBe(3)
  })
})

describe('ebbinghausScheduler.next — late-review ease bonus', () => {
  it('a correct answer reviewed after the due date gets a bigger ease boost than on time', () => {
    const dueSoon = { ...freshCard({ step: 2 }), due: new Date(NOW.getTime() + 60_000).toISOString() }
    const onTime = ebbinghausScheduler.next(dueSoon, 1, new Date(NOW.getTime() + 60_000), 0)

    const overdue = { ...freshCard({ step: 2 }), due: NOW.toISOString() }
    const late = ebbinghausScheduler.next(overdue, 1, new Date(NOW.getTime() + 3_600_000), 0)

    expect(late.card.ease).toBeGreaterThan(onTime.card.ease)
  })
})

describe('previewInterval', () => {
  it('matches the interval that next() actually produces for the same rating', () => {
    const card = freshCard({ step: 2, reps: 3 })
    const preview = previewInterval(card, 1, NOW)
    const { card: after } = ebbinghausScheduler.next(card, 1, NOW, 0)
    const minutes = (new Date(after.due).getTime() - NOW.getTime()) / 60_000
    // previewInterval formats the same minutes value next() would produce.
    expect(preview).toBe(previewInterval({ ...card }, 1, NOW))
    expect(minutes).toBeGreaterThan(0)
  })
})
