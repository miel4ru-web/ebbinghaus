import { useEffect, useState } from 'react'
import type { Card, Note } from '../../types'
import { buildQueue } from './queue'
import { ebbinghausScheduler, previewInterval, LEECH_THRESHOLD } from '../../scheduler/ebbinghaus'
import { getNote, putCard, putNote, putReviewLog } from '../../db'
import { renderClozeField, renderField } from '../../lib/renderCard'

interface Props {
  deckId: string
  newCardsPerDay: number
  onExit: () => void
}

// Plan §리뷰 부채 방어: cap session length so fatigue doesn't degrade real recall into
// pattern-matching on card order (plan §패턴 인식으로의 퇴화).
const SESSION_LIMIT = 60

function fieldFor(note: Note, card: Card, side: 'front' | 'back', revealed: boolean): string {
  if (note.type === 'cloze') {
    if (side === 'back') return ''
    return renderClozeField(note.fields.text ?? '', card.ord, revealed)
  }
  if (note.type === 'reverse' && card.ord === 1) {
    // ord 1 is the back->front card: swap which field is the prompt.
    return side === 'front' ? renderField(note.fields.back ?? '') : renderField(note.fields.front ?? '')
  }
  return renderField(note.fields[side] ?? '')
}

export function ReviewSession({ deckId, newCardsPerDay, onExit }: Props) {
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [index, setIndex] = useState(0)
  const [note, setNote] = useState<Note | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [shownAt, setShownAt] = useState(Date.now())
  const [tally, setTally] = useState({ known: 0, forgot: 0 })
  const [editing, setEditing] = useState(false)
  const [draftFields, setDraftFields] = useState<Record<string, string>>({})
  const [leechNotice, setLeechNotice] = useState(false)

  useEffect(() => {
    buildQueue(deckId, { now: new Date(), newCardsPerDay, sessionLimit: SESSION_LIMIT }).then((q) => {
      setQueue(q)
      setIndex(0)
    })
  }, [deckId, newCardsPerDay])

  const card = queue?.[index] ?? null

  useEffect(() => {
    if (!card) return
    getNote(card.noteId).then((n) => setNote(n ?? null))
    setRevealed(false)
    setEditing(false)
    setShownAt(Date.now())
  }, [card])

  async function grade(rating: 0 | 1) {
    if (!card) return
    const durationMs = Date.now() - shownAt
    const reviewedAt = new Date()
    const { card: updated, log } = ebbinghausScheduler.next(card, rating, reviewedAt, durationMs)

    // Plan §리뷰 부채 방어: auto-suspend + tag a card the moment it crosses the leech
    // threshold, rather than letting it keep eating review budget.
    let finalCard = updated
    if (!card.suspended && updated.lapses >= LEECH_THRESHOLD) {
      finalCard = { ...updated, suspended: true }
      if (note && !note.tags.includes('leech')) {
        await putNote({ ...note, tags: [...note.tags, 'leech'], modifiedAt: reviewedAt.toISOString() })
      }
      setLeechNotice(true)
    }

    await putCard(finalCard)
    await putReviewLog(log)
    setTally((t) => (rating === 1 ? { ...t, known: t.known + 1 } : { ...t, forgot: t.forgot + 1 }))
    setIndex((i) => i + 1)
  }

  function startEdit() {
    if (!note) return
    setDraftFields({ ...note.fields })
    setEditing(true)
  }

  async function saveEdit() {
    if (!note) return
    const updated: Note = { ...note, fields: draftFields, modifiedAt: new Date().toISOString() }
    await putNote(updated)
    setNote(updated)
    setEditing(false)
  }

  // Re-registered every render (no deps) so the handler always sees the current card /
  // revealed state without needing them threaded through a dependency array.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card || editing) return
      if (e.code === 'Space') {
        e.preventDefault()
        setRevealed((r) => !r)
      } else if (revealed && e.key === '1') {
        grade(0)
      } else if (revealed && e.key === '2') {
        grade(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (queue === null) {
    return <div className="p-6 text-text-dim">불러오는 중…</div>
  }

  if (!card) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg">오늘 복습을 모두 마쳤습니다 🎉</p>
        <p className="text-text-dim">
          알음 {tally.known} · 모름 {tally.forgot}
        </p>
        <button className="rounded-lg bg-brand px-4 py-2" onClick={onExit}>
          덱 목록으로
        </button>
      </div>
    )
  }

  const now = new Date()
  const front = note ? fieldFor(note, card, 'front', revealed) : ''
  const back = note ? fieldFor(note, card, 'back', revealed) : ''
  const forgotLabel = previewInterval(card, 0, now)
  const knowLabel = previewInterval(card, 1, now)

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between text-sm text-text-dim">
        <button onClick={onExit}>← 나가기</button>
        <div className="flex items-center gap-3">
          <span>
            {index + 1} / {queue.length}
          </span>
          <button onClick={startEdit}>편집</button>
        </div>
      </div>

      {leechNotice && (
        <p className="rounded bg-again/15 px-3 py-2 text-xs text-again">
          이 카드는 {LEECH_THRESHOLD}번 반복해서 틀려 자동으로 정지되었습니다. 카드를 더 작은 단위로 다시
          만들어보세요 — 생성 화면의 "오답에서 불러오기"를 쓰면 편합니다.
        </p>
      )}

      {editing && note ? (
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          {Object.entries(draftFields).map(([key, value]) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-text-dim">{key}</span>
              <textarea
                className="min-h-[80px] rounded border border-border bg-surface-2 px-3 py-2"
                value={value}
                onChange={(e) => setDraftFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <div className="flex gap-2">
            <button className="rounded bg-brand px-3 py-1.5" onClick={saveEdit}>
              저장
            </button>
            <button className="rounded bg-surface-2 px-3 py-1.5" onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="min-h-[220px] flex-1 rounded-xl border border-border bg-surface p-6 text-left text-lg"
            onClick={() => setRevealed((r) => !r)}
          >
            <div dangerouslySetInnerHTML={{ __html: front }} />
            {revealed && back && (
              <>
                <hr className="my-4 border-border" />
                <div dangerouslySetInnerHTML={{ __html: back }} />
              </>
            )}
          </button>

          {!revealed ? (
            <button className="rounded-lg bg-surface-2 py-3" onClick={() => setRevealed(true)}>
              답 보기 (space)
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button className="rounded-lg border border-again bg-again/15 py-3" onClick={() => grade(0)}>
                모름 (1) · {forgotLabel}
              </button>
              <button className="rounded-lg border border-good bg-good/15 py-3" onClick={() => grade(1)}>
                알음 (2) · {knowLabel}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
