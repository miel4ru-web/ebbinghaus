import { useEffect, useState } from 'react'
import type { Card, Deck } from '../../types'
import { getCardsByDeck, getDecks } from '../../db'
import { NEW_STEP } from '../../scheduler/ebbinghaus'
import { LADDER_MINUTES } from '../../scheduler/ladder'

const FORECAST_DAYS = 14

/** Upcoming due-card counts per day, like Anki's forecast graph — a direct view into the
 * review-debt risk the plan warns about (plan §리뷰 부채 방어). */
function forecastByDay(cards: Card[], days: number): number[] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const buckets = new Array(days).fill(0)
  for (const c of cards) {
    if (c.suspended) continue
    const diffDays = Math.floor((new Date(c.due).getTime() - start.getTime()) / 86_400_000)
    if (diffDays >= 0 && diffDays < days) buckets[diffDays]++
  }
  return buckets
}

/**
 * Plan §통계: "망각곡선 시각화(R = (1+t/S)^-1)". S (stability, in minutes) isn't a
 * tracked field in this scheduler — it's approximated as the card's current ladder
 * interval (LADDER_MINUTES[step] * ease), since the ladder is designed so a card is due
 * roughly when its recall probability has decayed to the target. This is a display
 * approximation, not a calibrated retention model.
 */
function retrievabilityCurve(stabilityMinutes: number, points = 40): { t: number; r: number }[] {
  const maxT = stabilityMinutes * 4
  const out: { t: number; r: number }[] = []
  for (let i = 0; i <= points; i++) {
    const t = (maxT / points) * i
    out.push({ t, r: 1 / (1 + t / stabilityMinutes) })
  }
  return out
}

export function StatsView() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState('')
  const [cards, setCards] = useState<Card[]>([])

  useEffect(() => {
    getDecks().then((d) => {
      setDecks(d)
      if (d[0]) setDeckId(d[0].id)
    })
  }, [])

  useEffect(() => {
    if (deckId) getCardsByDeck(deckId).then(setCards)
  }, [deckId])

  if (decks.length === 0) {
    return <p className="p-4 text-text-dim">덱을 먼저 만들어보세요.</p>
  }

  const newCount = cards.filter((c) => c.step === NEW_STEP).length
  const youngCount = cards.filter((c) => c.step >= 0 && c.step < 5).length
  const matureCount = cards.filter((c) => c.step >= 5).length
  const avgEase = cards.length ? cards.reduce((s, c) => s + c.ease, 0) / cards.length : 0

  const forecast = forecastByDay(cards, FORECAST_DAYS)
  const maxForecast = Math.max(1, ...forecast)

  const reviewCards = cards.filter((c) => c.step !== NEW_STEP)
  const avgStabilityMinutes = reviewCards.length
    ? reviewCards.reduce((s, c) => s + LADDER_MINUTES[c.step] * c.ease, 0) / reviewCards.length
    : LADDER_MINUTES[0]
  const curve = retrievabilityCurve(avgStabilityMinutes)
  const curvePoints = curve.map((p, i) => `${(i / (curve.length - 1)) * 200},${100 - p.r * 100}`).join(' ')

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">통계</h1>

      <select
        className="rounded border border-border bg-surface-2 px-3 py-2"
        value={deckId}
        onChange={(e) => setDeckId(e.target.value)}
      >
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 font-medium">진도</h2>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="text-lg">{newCount}</div>
            <div className="text-text-dim">신규</div>
          </div>
          <div>
            <div className="text-lg">{youngCount}</div>
            <div className="text-text-dim">학습중</div>
          </div>
          <div>
            <div className="text-lg">{matureCount}</div>
            <div className="text-text-dim">성숙</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-text-dim">평균 ease {avgEase.toFixed(2)}</p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 font-medium">향후 {FORECAST_DAYS}일 예상 리뷰량</h2>
        <div className="flex h-24 items-end gap-1">
          {forecast.map((n, i) => (
            <div
              key={i}
              className="flex-1 bg-brand"
              style={{ height: `${(n / maxForecast) * 100}%`, minHeight: n > 0 ? '2px' : 0 }}
              title={`D+${i}: ${n}장`}
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 font-medium">예상 회상률 곡선 (덱 평균)</h2>
        <svg viewBox="0 0 200 100" className="w-full">
          <line x1="0" y1="10" x2="200" y2="10" stroke="#2a3450" strokeDasharray="4" />
          <polyline fill="none" stroke="#818cf8" strokeWidth="2" points={curvePoints} />
        </svg>
        <p className="text-xs text-text-dim">다음 복습 시점(사다리 간격)에서 회상률이 90% 안팎이 되도록 설계된 근사치입니다.</p>
      </section>
    </div>
  )
}
