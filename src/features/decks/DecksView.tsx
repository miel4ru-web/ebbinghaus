import { useEffect, useState } from 'react'
import type { Deck } from '../../types'
import { getCardsByDeck, getDecks, putDeck } from '../../db'
import { newId } from '../../lib/id'
import { NEW_STEP } from '../../scheduler/ebbinghaus'
import { forecastByDay } from '../../lib/forecast'
import { PageHeader, Modal, btnAccent, btnGhost } from '../../components/ui'
import { DecksIcon, PlusIcon } from '../../components/icons'

interface DeckStat {
  deck: Deck
  due: number
  newToday: number
  total: number
  forecast: number[]
}

interface Props {
  onOpenDeck: (deckId: string, newCardsPerDay: number) => void
}

const FORECAST_DAYS = 14

export function DecksView({ onOpenDeck }: Props) {
  const [stats, setStats] = useState<DeckStat[]>([])
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [cap, setCap] = useState(20)

  async function refresh() {
    const decks = await getDecks()
    const now = Date.now()
    const rows: DeckStat[] = []
    for (const deck of decks) {
      const cards = await getCardsByDeck(deck.id)
      rows.push({
        deck,
        due: cards.filter((c) => !c.suspended && new Date(c.due).getTime() <= now).length,
        newToday: cards.filter((c) => c.step === NEW_STEP).length,
        total: cards.length,
        forecast: forecastByDay(cards, FORECAST_DAYS),
      })
    }
    setStats(rows)
    setLoaded(true)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function createDeck() {
    if (!name.trim()) return
    const deck: Deck = {
      id: newId(),
      name: name.trim(),
      newCardsPerDay: cap,
      createdAt: new Date().toISOString(),
    }
    await putDeck(deck)
    setName('')
    setCap(20)
    setCreating(false)
    await refresh()
  }

  return (
    <>
      <PageHeader
        title="덱"
        subtitle="밀린 카드를 밀어내고, 새 카드를 추가합니다"
        action={
          <button className={btnAccent} onClick={() => setCreating(true)}>
            <PlusIcon className="text-[15px]" /> 새 덱
          </button>
        }
      />

      <div className="px-5 py-6 md:px-8 md:py-8">
        {loaded && stats.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((s) => (
              <DeckCard
                key={s.deck.id}
                stat={s}
                onOpen={() => onOpenDeck(s.deck.id, s.deck.newCardsPerDay)}
              />
            ))}
            <button
              onClick={() => setCreating(true)}
              className="flex min-h-[188px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-text-dim hover:border-text-dim hover:text-text"
            >
              <PlusIcon className="text-xl" /> 새 덱 만들기
            </button>
          </div>
        )}
      </div>

      {creating && (
        <Modal
          title="새 덱"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className={btnGhost} onClick={() => setCreating(false)}>
                취소
              </button>
              <button className={btnAccent} onClick={createDeck}>
                만들기
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-xs text-text-dim">
              덱 이름
              <input
                autoFocus
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
                placeholder="예: 일본어 N2 문법"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createDeck()}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-text-dim">
              일일 신규 카드 상한
              <input
                type="number"
                min={1}
                className="tnum w-24 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
                value={cap}
                onChange={(e) => setCap(Math.max(1, Number(e.target.value)))}
              />
            </label>
            {/* Plan §리뷰 부채 방어: surface the steady-state review load at the exact
                moment a user is about to set an unsustainable cap. */}
            <p className="rounded-lg border border-hairline bg-surface-2 p-3 text-xs leading-relaxed text-text-dim">
              예상 정상상태 리뷰량 ≈ 하루{' '}
              <span className="tnum font-medium text-text">{cap * 10}</span>장 (카드당 평생 리뷰 ~10회 가정).
              초반에 무리하게 올리면 몇 주 뒤 밀린 복습이 감당 불가가 됩니다.
            </p>
          </div>
        </Modal>
      )}
    </>
  )
}

function DeckCard({ stat, onOpen }: { stat: DeckStat; onOpen: () => void }) {
  const { deck, due, newToday, total, forecast } = stat
  const backlog = due > 120
  const nothing = due === 0 && newToday === 0
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-border">
      <div>
        <h3 className="text-lg font-semibold">{deck.name}</h3>
        <p className="mt-1 text-xs text-text-dim">
          {total.toLocaleString()} 카드
          {backlog && <span className="text-again"> · 리뷰 밀림</span>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat n={due} label="복습" tone={backlog ? 'again' : due > 0 ? 'text' : 'dim'} />
        <Stat n={newToday} label="신규" tone={newToday > 0 ? 'text' : 'dim'} />
        <Stat n={deck.newCardsPerDay} label="상한" tone="dim" />
      </div>

      <Sparkline data={forecast} />

      <button
        onClick={onOpen}
        disabled={nothing}
        className={
          nothing
            ? 'w-full cursor-default rounded-lg border border-border bg-surface-2 py-2 text-sm text-text-dim'
            : `${btnAccent} w-full`
        }
      >
        {nothing ? '오늘 볼 카드 없음' : '복습 시작'}
      </button>
    </article>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: 'text' | 'dim' | 'again' }) {
  const c = tone === 'again' ? 'text-again' : tone === 'dim' ? 'text-text-dim' : 'text-text'
  return (
    <div>
      <div className={`tnum text-xl font-semibold ${c}`}>{n}</div>
      <div className="mt-0.5 text-[10px] text-text-dim">{label}</div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {data.map((n, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${n === max && max > 1 ? 'bg-brand' : 'bg-brand/25'}`}
          style={{ height: `${Math.max(6, (n / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-surface text-text-dim">
        <DecksIcon className="text-2xl" />
      </div>
      <h2 className="text-xl font-semibold">아직 덱이 없습니다</h2>
      <p className="mx-auto mt-2.5 max-w-sm text-sm text-text-dim">
        덱은 카드 묶음이자, 하루에 유입되는 새 카드 수를 조절하는 단위입니다. 하나 만들어 시작하세요.
      </p>
      <button className={`${btnAccent} mx-auto mt-5`} onClick={onCreate}>
        첫 덱 만들기
      </button>
    </div>
  )
}
