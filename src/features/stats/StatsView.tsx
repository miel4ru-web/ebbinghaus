import { useEffect, useState } from 'react'
import type { Card, Deck } from '../../types'
import { getCardsByDeck, getDecks } from '../../db'
import { NEW_STEP } from '../../scheduler/ebbinghaus'
import { LADDER_MINUTES } from '../../scheduler/ladder'
import { forecastByDay } from '../../lib/forecast'
import { PageHeader } from '../../components/ui'

const FORECAST_DAYS = 14

function humanizeMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}분`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간`
  const days = minutes / (60 * 24)
  if (days < 30) return `${Math.round(days)}일`
  if (days < 365) return `${Math.round(days / 30)}개월`
  return `${Math.round(days / 365)}년`
}

/**
 * Plan §통계: "망각곡선 시각화(R = (1+t/S)^-1)". S (stability, minutes) isn't a tracked
 * field — it's approximated as the card's current ladder interval (LADDER_MINUTES[step]
 * * ease). Display approximation, not a calibrated retention model.
 */
function retrievabilityCurve(stabilityMinutes: number, points = 48): { t: number; r: number }[] {
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
    return (
      <>
        <PageHeader title="통계" subtitle="진도 · 예상 부하 · 회상률 곡선" />
        <p className="px-5 py-8 text-sm text-text-dim md:px-8">덱을 먼저 만들어보세요.</p>
      </>
    )
  }

  const newCount = cards.filter((c) => c.step === NEW_STEP).length
  const youngCount = cards.filter((c) => c.step >= 0 && c.step < 5).length
  const matureCount = cards.filter((c) => c.step >= 5).length
  const total = cards.length || 1
  const avgEase = cards.length ? cards.reduce((s, c) => s + c.ease, 0) / cards.length : 0

  const forecast = forecastByDay(cards, FORECAST_DAYS)

  const reviewCards = cards.filter((c) => c.step !== NEW_STEP)
  const avgStabilityMinutes = reviewCards.length
    ? reviewCards.reduce((s, c) => s + LADDER_MINUTES[c.step] * c.ease, 0) / reviewCards.length
    : LADDER_MINUTES[0]
  const curve = retrievabilityCurve(avgStabilityMinutes)

  return (
    <>
      <PageHeader
        title="통계"
        subtitle="진도 · 예상 부하 · 회상률 곡선"
        action={
          <select
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
            value={deckId}
            onChange={(e) => setDeckId(e.target.value)}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <Tile n={newCount} label="신규 (미학습)" />
          <Tile n={youngCount} label="학습중 (step < 5)" />
          <Tile n={matureCount} label="성숙 (step ≥ 5)" />
          <Tile n={avgEase.toFixed(2)} label="평균 ease" />
        </div>

        <Panel title="덱 구성" caption="성숙 카드 비율이 높을수록 하루 리뷰량이 안정적입니다">
          <div className="flex h-2.5 overflow-hidden rounded-full">
            <span className="bg-brand/30" style={{ width: `${(newCount / total) * 100}%` }} />
            <span className="bg-brand/60" style={{ width: `${(youngCount / total) * 100}%` }} />
            <span className="bg-brand" style={{ width: `${(matureCount / total) * 100}%` }} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-text-dim">
            <Key cls="bg-brand/30" label={`신규 ${newCount}`} />
            <Key cls="bg-brand/60" label={`학습중 ${youngCount}`} />
            <Key cls="bg-brand" label={`성숙 ${matureCount}`} />
          </div>
        </Panel>

        <Panel
          title={`향후 ${FORECAST_DAYS}일 예상 리뷰량`}
          caption="Anki 예보 그래프와 같은 개념 — 밀리기 전에 부하 스파이크를 본다"
        >
          <ForecastChart forecast={forecast} />
        </Panel>

        <Panel
          title="예상 회상률 곡선 (덱 평균)"
          caption="R = 1 / (1 + t/S), S ≈ 현재 사다리 간격 × ease. 다음 복습 시점에서 회상률이 90% 안팎이 되도록 설계된 근사치"
        >
          <RetrievabilityChart
            curve={curve}
            stabilityMinutes={avgStabilityMinutes}
            nextLabel={humanizeMinutes(avgStabilityMinutes)}
          />
        </Panel>
      </div>
    </>
  )
}

function Tile({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
      <div className="tnum text-2xl font-semibold">{n}</div>
      <div className="mt-1.5 text-[11px] text-text-dim">{label}</div>
    </div>
  )
}

function Panel({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5 md:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mb-4 mt-0.5 text-xs text-text-dim">{caption}</p>
      {children}
    </section>
  )
}

function Key({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`inline-block h-2 w-2 rounded-sm ${cls}`} />
      {label}
    </span>
  )
}

function ForecastChart({ forecast }: { forecast: number[] }) {
  const W = 720
  const H = 200
  const PADL = 30
  const PADB = 22
  const plotW = W - PADL
  const plotH = H - PADB
  const max = Math.max(1, ...forecast)
  const step = Math.max(1, Math.round(max / 3))
  const lines = [0, step, step * 2, step * 3].filter((v) => v <= max + step)
  const slot = plotW / forecast.length
  const barW = slot * 0.6
  const peak = forecast.indexOf(max)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="향후 14일 예상 리뷰량">
      {lines.map((v) => {
        const y = PADB / 2 + (plotH - (v / max) * plotH)
        return (
          <g key={v}>
            <line x1={PADL} y1={y} x2={W} y2={y} stroke="var(--color-hairline)" />
            <text x={PADL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-dim)">
              {v}
            </text>
          </g>
        )
      })}
      {forecast.map((v, i) => {
        const h = (v / max) * plotH
        const x = PADL + i * slot + (slot - barW) / 2
        const y = PADB / 2 + (plotH - h)
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={Math.max(h, v > 0 ? 2 : 0)}
            rx={2}
            fill={i === peak && max > 1 ? 'var(--color-brand)' : 'color-mix(in oklab, var(--color-brand) 40%, transparent)'}
          />
        )
      })}
      {[0, 3, 6, 9, 12].map((i) => (
        <text
          key={i}
          x={PADL + i * slot + slot / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize="9"
          fill="var(--color-text-dim)"
        >
          {i === 0 ? '오늘' : `+${i}일`}
        </text>
      ))}
    </svg>
  )
}

function RetrievabilityChart({
  curve,
  stabilityMinutes,
  nextLabel,
}: {
  curve: { t: number; r: number }[]
  stabilityMinutes: number
  nextLabel: string
}) {
  const W = 720
  const H = 200
  const PADL = 30
  const PADB = 22
  const plotW = W - PADL
  const plotH = H - PADB
  const maxT = stabilityMinutes * 4
  const x = (t: number) => PADL + (t / maxT) * plotW
  const y = (r: number) => PADB / 2 + plotH * (1 - r)
  const points = curve.map((p) => `${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ')
  const ticks = [0, 1, 2, 3, 4].map((k) => ({ t: stabilityMinutes * k, label: humanizeMinutes(stabilityMinutes * k) }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="예상 회상률 곡선">
      <line x1={PADL} y1={y(1)} x2={PADL} y2={y(0)} stroke="var(--color-border)" />
      <line x1={PADL} y1={y(0)} x2={W} y2={y(0)} stroke="var(--color-border)" />

      <line x1={PADL} y1={y(0.9)} x2={W} y2={y(0.9)} stroke="var(--color-brand)" strokeDasharray="4 4" opacity="0.7" />
      <text x={W} y={y(0.9) - 5} textAnchor="end" fontSize="9" fill="var(--color-brand-light)">
        회상률 90% — 다음 복습 목표
      </text>

      <line x1={x(stabilityMinutes)} y1={y(1)} x2={x(stabilityMinutes)} y2={y(0)} stroke="var(--color-text-dim)" strokeDasharray="3 4" opacity="0.5" />
      <text x={x(stabilityMinutes) + 4} y={y(1) + 10} fontSize="9" fill="var(--color-text-dim)">
        다음 복습 ≈ {nextLabel}
      </text>

      <polyline fill="none" stroke="var(--color-brand)" strokeWidth="2.2" strokeLinecap="round" points={points} />

      {ticks.map((tk, i) => (
        <text key={i} x={x(tk.t)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-text-dim)">
          {i === 0 ? '지금' : tk.label}
        </text>
      ))}
      <text x={PADL - 6} y={y(1) + 3} textAnchor="end" fontSize="9" fill="var(--color-text-dim)">
        1.0
      </text>
      <text x={PADL - 6} y={y(0) + 3} textAnchor="end" fontSize="9" fill="var(--color-text-dim)">
        0
      </text>
    </svg>
  )
}
