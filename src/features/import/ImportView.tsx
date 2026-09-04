import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Deck, Note } from '../../types'
import { getDecks, putCards, putDeck, putNote } from '../../db'
import { newId } from '../../lib/id'
import { parseNotesCsv, type ParsedNote } from '../../lib/csv'
import { seedCardsForNote } from '../../scheduler/cards'
import { PageHeader, Callout, btnAccent } from '../../components/ui'
import { ImportIcon } from '../../components/icons'

const inputCls = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text'
const labelCls = 'flex flex-col gap-1.5 text-xs text-text-dim'

const EXAMPLE_CSV = `type,front,back,tags
basic,"프랑스의 수도는?",파리,지리
reverse,犬,dog,일본어 동물
cloze,"물은 {{c1::100}}°C에서 끓는다",,과학`

const LLM_PROMPT = `아래 형식의 CSV로 암기 카드를 만들어줘. 첫 줄은 헤더 그대로:

type,front,back,tags

- type: basic(앞→뒤) · reverse(양방향) · cloze(빈칸 채우기)
- basic/reverse: front=질문, back=정답
- cloze: front 안에 {{c1::가릴부분}} 표기, back은 비움
- tags: 공백으로 구분 (선택)
- 한 카드에 사실 하나만. 목록·열거는 쪼갤 것.
- 쉼표·줄바꿈이 들어가는 셀은 큰따옴표로 감쌀 것.`

interface Props {
  onImported: () => void
}

export function ImportView({ onImported }: Props) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [target, setTarget] = useState<'new' | string>('new')
  const [newDeckName, setNewDeckName] = useState('')
  const [cap, setCap] = useState(20)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ deckName: string; notes: number; cards: number } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getDecks().then(setDecks)
  }, [])

  const parsed = useMemo(() => parseNotesCsv(text), [text])
  const counts = useMemo(() => tallyTypes(parsed.notes), [parsed.notes])

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setText(await file.text())
    setFileName(file.name)
    setDone(null)
    setError(null)
    e.target.value = ''
  }

  async function runImport() {
    if (parsed.notes.length === 0) {
      setError('가져올 유효한 카드가 없습니다.')
      return
    }
    const deckName = target === 'new' ? newDeckName.trim() : decks.find((d) => d.id === target)?.name ?? ''
    if (target === 'new' && !deckName) {
      setError('새 덱 이름을 입력하세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      let deckId = target
      if (target === 'new') {
        deckId = newId()
        const deck: Deck = { id: deckId, name: deckName, newCardsPerDay: cap, createdAt: now }
        await putDeck(deck)
      }

      const cards: Card[] = []
      for (const draft of parsed.notes) {
        const note: Note = {
          id: newId(),
          deckId,
          type: draft.type,
          fields: draft.fields,
          tags: draft.tags,
          createdAt: now,
          modifiedAt: now,
        }
        await putNote(note)
        cards.push(...seedCardsForNote(note))
      }
      await putCards(cards)

      setDone({ deckName, notes: parsed.notes.length, cards: cards.length })
      setText('')
      setFileName(null)
      setNewDeckName('')
      setDecks(await getDecks())
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="CSV 가져오기"
        subtitle="외부 LLM이 만든 카드 CSV를 붙여넣거나 업로드해 덱을 만듭니다"
      />

      <div className="grid lg:grid-cols-2">
        {/* Input */}
        <div className="flex flex-col gap-3.5 border-b border-hairline p-5 md:p-8 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-text-dim hover:text-text"
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택 (.csv / .tsv / .txt)
            </button>
            {fileName && <span className="text-xs text-text-dim">{fileName}</span>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              className="ml-auto text-xs text-text-dim underline hover:text-text"
              onClick={() => setShowHelp((v) => !v)}
            >
              CSV 형식 {showHelp ? '숨기기' : '보기'}
            </button>
          </div>

          {showHelp && <FormatHelp />}

          <label className={labelCls}>
            CSV 내용
            <textarea
              className={`${inputCls} min-h-[240px] font-mono leading-relaxed`}
              placeholder={EXAMPLE_CSV}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setFileName(null)
                setDone(null)
              }}
            />
          </label>

          <label className={labelCls}>
            가져올 덱
            <select
              className={inputCls}
              value={target}
              onChange={(e) => setTarget(e.target.value as 'new' | string)}
            >
              <option value="new">+ 새 덱 만들기</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}에 추가
                </option>
              ))}
            </select>
          </label>

          {target === 'new' && (
            <div className="flex flex-col gap-3.5 rounded-lg border border-hairline bg-surface-2 p-3.5">
              <label className={labelCls}>
                덱 이름
                <input
                  className={inputCls}
                  placeholder="예: 일본어 N2 문법"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-text-dim">
                일일 신규 카드 상한
                <input
                  type="number"
                  min={1}
                  className="tnum w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text"
                  value={cap}
                  onChange={(e) => setCap(Math.max(1, Number(e.target.value)))}
                />
              </label>
            </div>
          )}

          {error && <p className="text-sm text-again">{error}</p>}
          {done && (
            <Callout tone="info">
              <strong className="text-text">{done.deckName}</strong>에 노트 {done.notes}개 · 카드{' '}
              {done.cards}장을 추가했습니다. “덱” 탭에서 복습을 시작하세요.
            </Callout>
          )}

          <button
            className={`${btnAccent} py-2.5`}
            onClick={runImport}
            disabled={busy || parsed.notes.length === 0}
          >
            {busy ? '가져오는 중…' : `가져오기 (${parsed.notes.length}장)`}
          </button>
        </div>

        {/* Preview */}
        <div className="flex min-w-0 flex-col">
          {parsed.notes.length === 0 && parsed.errors.length === 0 ? (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <ImportIcon className="mx-auto mb-3 text-2xl text-text-dim" />
                <p className="text-sm text-text-dim">
                  왼쪽에 CSV를 넣으면 여기에 미리보기가 나옵니다.
                  <br />
                  저장 전에 각 카드를 확인하세요.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-5 py-4 text-sm md:px-7">
                <h2 className="text-lg font-semibold">
                  미리보기 <span className="tnum text-sm font-normal text-text-dim">{parsed.notes.length}장</span>
                </h2>
                <span className="tnum text-xs text-text-dim">
                  basic {counts.basic} · reverse {counts.reverse} · cloze {counts.cloze}
                  {parsed.errors.length > 0 && <span className="text-again"> · 오류 {parsed.errors.length}행</span>}
                </span>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto p-5 md:px-7">
                {parsed.errors.length > 0 && (
                  <div className="rounded-lg border border-again/30 bg-again/10 p-3 text-xs text-again">
                    <p className="mb-1 font-medium">건너뛴 행</p>
                    <ul className="flex flex-col gap-0.5">
                      {parsed.errors.map((e) => (
                        <li key={e.row}>
                          <span className="tnum">{e.row}행</span> — {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {parsed.notes.map((n) => (
                  <PreviewCard key={n.row} note={n} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function PreviewCard({ note }: { note: ParsedNote }) {
  const front = note.type === 'cloze' ? note.fields.text : note.fields.front
  const back = note.type === 'cloze' ? '' : note.fields.back
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-hairline bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
          {note.type}
        </span>
        {note.tags.map((t) => (
          <span key={t} className="text-[11px] text-text-dim">
            #{t}
          </span>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-text">{front}</p>
      {back && <p className="text-sm leading-relaxed text-text-dim">{back}</p>}
    </div>
  )
}

function FormatHelp() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-2 p-3.5 text-xs leading-relaxed text-text-dim">
      <div>
        <p className="mb-1 font-medium text-text">열</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <code className="rounded bg-bg px-1">type</code> — basic · reverse · cloze (생략 시 자동 판별)
          </li>
          <li>
            <code className="rounded bg-bg px-1">front</code> — 질문. cloze는 <code className="rounded bg-bg px-1">{'{{c1::답}}'}</code> 표기 포함
          </li>
          <li>
            <code className="rounded bg-bg px-1">back</code> — 정답. cloze는 비움
          </li>
          <li>
            <code className="rounded bg-bg px-1">tags</code> — 공백으로 구분 (선택)
          </li>
        </ul>
        <p className="mt-1">헤더 없이 2열이면 front,back(basic)으로 읽습니다. 구분자는 쉼표·탭·세미콜론 자동 인식.</p>
      </div>
      <div>
        <p className="mb-1 font-medium text-text">예시</p>
        <pre className="overflow-x-auto rounded bg-bg p-2 text-[11px] text-text">{EXAMPLE_CSV}</pre>
      </div>
      <div>
        <p className="mb-1 font-medium text-text">LLM에게 붙여넣을 프롬프트</p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-bg p-2 text-[11px] text-text">{LLM_PROMPT}</pre>
      </div>
    </div>
  )
}

function tallyTypes(notes: ParsedNote[]) {
  const c = { basic: 0, reverse: 0, cloze: 0 }
  for (const n of notes) c[n.type]++
  return c
}
