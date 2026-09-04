import { useEffect, useState } from 'react'
import type { Card, Note } from '../../types'
import { buildQueue } from './queue'
import { ebbinghausScheduler, previewInterval, LEECH_THRESHOLD } from '../../scheduler/ebbinghaus'
import { getNote, putCard, putNote, putReviewLog } from '../../db'
import { renderClozeField, renderField } from '../../lib/renderCard'
import { btnAccent, btnDefault, btnGhost } from '../../components/ui'
import { BackIcon, CheckIcon, EditIcon } from '../../components/icons'

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
    return <div className="grid min-h-screen place-items-center text-text-dim">불러오는 중…</div>
  }

  if (!card) {
    return (
      <div className="grid min-h-screen place-items-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-good/40 bg-good/10 text-good">
            <CheckIcon className="text-xl" />
          </div>
          <h1 className="text-2xl font-semibold md:text-[1.7rem]">오늘 복습을 모두 마쳤습니다</h1>
          <div className="mx-auto my-6 inline-flex gap-7 rounded-xl border border-hairline bg-surface px-6 py-3.5">
            <Tally n={tally.known} label="알음" cls="text-good" />
            <Tally n={tally.forgot} label="모름" cls="text-again" />
          </div>
          <div>
            <button className={btnAccent} onClick={onExit}>
              덱 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  const now = new Date()
  const front = note ? fieldFor(note, card, 'front', revealed) : ''
  const back = note ? fieldFor(note, card, 'back', revealed) : ''
  const forgotLabel = previewInterval(card, 0, now)
  const knowLabel = previewInterval(card, 1, now)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6 md:py-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onExit}
          className="flex items-center gap-1 text-sm text-text-dim hover:text-text"
        >
          <BackIcon className="text-[14px]" /> 나가기
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className="tnum text-xs text-text-dim">
          {index + 1} / {queue.length}
        </span>
        <button
          onClick={startEdit}
          className="flex items-center gap-1 text-sm text-text-dim hover:text-text"
        >
          <EditIcon className="text-[14px]" /> 편집
        </button>
      </div>

      {leechNotice && (
        <p className="rounded-lg border border-again/30 bg-again/10 px-3.5 py-2.5 text-xs leading-relaxed text-again">
          이 카드는 {LEECH_THRESHOLD}번 반복해서 틀려 자동으로 정지되었습니다. “편집”으로 카드를 더 작은
          단위로 쪼개거나 맥락을 보강해 다시 만들어보세요.
        </p>
      )}

      {editing && note ? (
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
          {Object.entries(draftFields).map(([key, value]) => (
            <label key={key} className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-text-dim">{key}</span>
              <textarea
                className="min-h-[88px] rounded-lg border border-border bg-bg px-3 py-2 leading-relaxed text-text"
                value={value}
                onChange={(e) => setDraftFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <div className="flex gap-2.5">
            <button className={btnAccent} onClick={saveEdit}>
              저장
            </button>
            <button className={btnGhost} onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="min-h-[220px] flex-1 rounded-2xl border border-hairline bg-surface p-6 text-left text-lg leading-relaxed md:p-8 md:text-xl"
            onClick={() => setRevealed((r) => !r)}
          >
            <div dangerouslySetInnerHTML={{ __html: front }} />
            {revealed && back && (
              <>
                <hr className="my-5 border-hairline" />
                <div dangerouslySetInnerHTML={{ __html: back }} />
              </>
            )}
          </button>

          {!revealed ? (
            <button className={`${btnDefault} w-full py-3.5`} onClick={() => setRevealed(true)}>
              답 보기&nbsp;<span className="tnum text-text-dim">(Space)</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                className="flex flex-col items-center gap-1 rounded-xl border border-again/40 bg-again/10 py-3.5 text-sm font-semibold text-again"
                onClick={() => grade(0)}
              >
                모름 (1)
                <span className="tnum text-xs font-normal opacity-90">다시 {forgotLabel} 뒤</span>
              </button>
              <button
                className="flex flex-col items-center gap-1 rounded-xl border border-good/40 bg-good/10 py-3.5 text-sm font-semibold text-good"
                onClick={() => grade(1)}
              >
                알음 (2)
                <span className="tnum text-xs font-normal opacity-90">다음 {knowLabel} 뒤</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-text-dim">
            <span>Space 답 보기</span>
            <span>1 모름</span>
            <span>2 알음</span>
            <span>세션 상한 {SESSION_LIMIT}장</span>
          </div>
        </>
      )}
    </div>
  )
}

function Tally({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`tnum text-2xl font-semibold ${cls}`}>{n}</span>
      <span className="text-[11px] text-text-dim">{label}</span>
    </div>
  )
}
