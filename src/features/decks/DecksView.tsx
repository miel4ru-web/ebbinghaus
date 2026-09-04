import { useEffect, useState } from 'react'
import type { Deck } from '../../types'
import { getCardsByDeck, getDecks, putDeck } from '../../db'
import { newId } from '../../lib/id'
import { NEW_STEP } from '../../scheduler/ebbinghaus'

interface DeckStat {
  deck: Deck
  due: number
  newToday: number
}

interface Props {
  onOpenDeck: (deckId: string, newCardsPerDay: number) => void
}

export function DecksView({ onOpenDeck }: Props) {
  const [stats, setStats] = useState<DeckStat[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [cap, setCap] = useState(20)

  async function refresh() {
    const decks = await getDecks()
    const now = Date.now()
    const rows: DeckStat[] = []
    for (const deck of decks) {
      const cards = await getCardsByDeck(deck.id)
      const due = cards.filter((c) => !c.suspended && new Date(c.due).getTime() <= now).length
      const newCount = cards.filter((c) => c.step === NEW_STEP).length
      rows.push({ deck, due, newToday: newCount })
    }
    setStats(rows)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function createDeck() {
    if (!name.trim()) return
    const deck: Deck = { id: newId(), name: name.trim(), newCardsPerDay: cap, createdAt: new Date().toISOString() }
    await putDeck(deck)
    setName('')
    setCreating(false)
    await refresh()
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">덱</h1>

      {stats.length === 0 && !creating && <p className="text-text-dim">아직 덱이 없습니다. 하나 만들어보세요.</p>}

      <ul className="flex flex-col gap-2">
        {stats.map(({ deck, due, newToday }) => (
          <li key={deck.id}>
            <button
              className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-left"
              onClick={() => onOpenDeck(deck.id, deck.newCardsPerDay)}
            >
              <span>{deck.name}</span>
              <span className="text-sm text-text-dim">
                복습 {due} · 신규 {newToday} (상한 {deck.newCardsPerDay})
              </span>
            </button>
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <input
            className="rounded border border-border bg-surface-2 px-3 py-2"
            placeholder="덱 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-text-dim">
            일일 신규 카드 상한
            <input
              type="number"
              min={1}
              className="w-20 rounded border border-border bg-surface-2 px-2 py-1"
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
            />
          </label>
          {/* Plan §리뷰 부채 방어: surface the steady-state review load before it happens,
              at the exact moment a user is about to set an unsustainable cap. */}
          <p className="text-xs text-text-dim">예상 정상상태 리뷰량 ≈ 하루 {cap * 10}장 (카드당 평생 리뷰 ~10회 가정)</p>
          <div className="flex gap-2">
            <button className="rounded bg-brand px-3 py-1.5" onClick={createDeck}>
              만들기
            </button>
            <button className="rounded bg-surface-2 px-3 py-1.5" onClick={() => setCreating(false)}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          className="rounded-lg border border-dashed border-border py-3 text-text-dim"
          onClick={() => setCreating(true)}
        >
          + 새 덱
        </button>
      )}
    </div>
  )
}
