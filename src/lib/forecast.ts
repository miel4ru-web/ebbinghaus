import type { Card } from '../types'

/** Upcoming due-card counts per day (like Anki's forecast graph) — a direct view into
 * the review-debt risk the plan warns about (plan §리뷰 부채 방어). Suspended cards are
 * excluded; anything already overdue lands in bucket 0. */
export function forecastByDay(cards: Card[], days: number, from: Date = new Date()): number[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const buckets = new Array<number>(days).fill(0)
  for (const c of cards) {
    if (c.suspended) continue
    const diffDays = Math.floor((new Date(c.due).getTime() - start.getTime()) / 86_400_000)
    if (diffDays < 0) buckets[0]++
    else if (diffDays < days) buckets[diffDays]++
  }
  return buckets
}
