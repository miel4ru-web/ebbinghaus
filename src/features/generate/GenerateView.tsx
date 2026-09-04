import { useEffect, useRef, useState } from 'react'
import type { Deck, Note } from '../../types'
import { getDecks, getLeechNotes, putNote } from '../../db'
import { newId } from '../../lib/id'
import { loadSettings } from '../../lib/storage'
import { estimateCostUsd, generateNotes, toNoteFields, type GeneratedNote } from '../../llm/generate'
import { PageHeader, btnAccent } from '../../components/ui'
import { GenerateIcon } from '../../components/icons'

const LEECH_REWRITE_INSTRUCTIONS =
  '아래는 반복해서 틀린(leech) 카드들입니다. 각 카드를 더 작은 단위로 쪼개거나 맥락을 보강해서, ' +
  '더 쉽게 기억할 수 있는 카드로 다시 작성하세요. 원래 카드를 그대로 베끼지 말고 개선하세요.'

const inputCls = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text'
const chipBtn =
  'rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-text-dim hover:text-text'

export function GenerateView() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState('')
  const [source, setSource] = useState('')
  const [instructions, setInstructions] = useState('')
  const [maxCards, setMaxCards] = useState(15)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<GeneratedNote[]>([])
  const [totalCostUsd, setTotalCostUsd] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getDecks().then((d) => {
      setDecks(d)
      if (d[0]) setDeckId(d[0].id)
    })
  }, [])

  async function generate() {
    const settings = loadSettings()
    if (!settings.anthropicApiKey) {
      setError('설정에서 Anthropic API 키를 먼저 입력하세요.')
      return
    }
    if (!source.trim()) {
      setError('원문이나 주제를 입력하세요.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await generateNotes({
        apiKey: settings.anthropicApiKey,
        model: settings.anthropicModel,
        source,
        instructions,
        maxCards,
      })
      setDrafts((prev) => [...prev, ...result.notes])
      setTotalCostUsd((c) => c + estimateCostUsd(settings.anthropicModel, result.usage))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function updateDraft(i: number, patch: Partial<GeneratedNote>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setSource((prev) => (prev ? `${prev}\n\n${text}` : text))
    e.target.value = ''
  }

  async function fillFromLeeches() {
    const leeches = await getLeechNotes()
    if (leeches.length === 0) {
      setError('leech로 표시된(반복해서 틀린) 카드가 없습니다.')
      return
    }
    const text = leeches
      .map((n) => Object.entries(n.fields).map(([k, v]) => `${k}: ${v}`).join(' / '))
      .join('\n')
    setSource(text)
    setInstructions(LEECH_REWRITE_INSTRUCTIONS)
    setError(null)
  }

  async function saveAll() {
    if (!deckId) {
      setError('저장할 덱을 먼저 선택하세요.')
      return
    }
    const now = new Date().toISOString()
    for (const draft of drafts) {
      const { type, fields } = toNoteFields(draft)
      const note: Note = { id: newId(), deckId, type, fields, tags: draft.tags, createdAt: now, modifiedAt: now }
      await putNote(note)
    }
    setDrafts([])
  }

  return (
    <>
      <PageHeader
        title="카드 생성"
        subtitle={
          <>
            주제 · 문서 · 오답에서 카드를 만들고, 저장 전에 검수합니다{' '}
            <span className="tnum text-text-dim">— {loadSettings().anthropicModel} (BYOK)</span>
          </>
        }
      />

      <div className="grid lg:grid-cols-2">
        {/* Input */}
        <div className="flex flex-col gap-3.5 border-b border-hairline p-5 md:p-8 lg:border-b-0 lg:border-r">
          <label className="flex flex-col gap-1.5 text-xs text-text-dim">
            저장할 덱
            <select className={inputCls} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              <option value="" disabled>
                저장할 덱 선택
              </option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={chipBtn} onClick={() => fileInputRef.current?.click()}>
              파일에서 불러오기 (.md/.txt/.csv)
            </button>
            <button type="button" className={chipBtn} onClick={fillFromLeeches}>
              오답에서 불러오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.csv,text/plain,text/markdown,text/csv"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>

          <label className="flex flex-col gap-1.5 text-xs text-text-dim">
            주제어나 원문
            <textarea
              className={`${inputCls} min-h-[180px] leading-relaxed`}
              placeholder="주제어나 원문을 붙여넣으세요"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-text-dim">
            추가 지시사항 (선택)
            <input
              className={inputCls}
              placeholder="예: 한→일 역방향 카드도 함께 만들기"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-text-dim">
              최대 카드 수
              <input
                type="number"
                min={1}
                max={50}
                className="tnum w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text"
                value={maxCards}
                onChange={(e) => setMaxCards(Number(e.target.value))}
              />
            </label>
            {totalCostUsd > 0 && (
              <span className="tnum text-xs text-text-dim">이번 세션 비용 ${totalCostUsd.toFixed(4)}</span>
            )}
          </div>

          {error && <p className="text-sm text-again">{error}</p>}

          <button className={`${btnAccent} py-2.5`} onClick={generate} disabled={loading}>
            {loading ? '생성 중…' : '카드 생성'}
          </button>
        </div>

        {/* Review */}
        <div className="flex min-w-0 flex-col">
          {drafts.length === 0 ? (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <GenerateIcon className="mx-auto mb-3 text-2xl text-text-dim" />
                <p className="text-sm text-text-dim">
                  생성한 카드가 여기 검수 목록으로 나옵니다.
                  <br />
                  한 장씩 확인하고 저장하세요.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-hairline px-5 py-4 md:px-7">
                <h2 className="text-lg font-semibold">
                  검수 <span className="tnum text-sm font-normal text-text-dim">{drafts.length}장</span>
                </h2>
                <span className="text-xs text-text-dim">저장 전 한 장씩 확인</span>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto p-5 md:px-7">
                {drafts.map((d, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
                        {d.type}
                      </span>
                      <button className="text-xs text-again hover:underline" onClick={() => removeDraft(i)}>
                        삭제
                      </button>
                    </div>
                    <textarea
                      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm leading-relaxed text-text"
                      rows={2}
                      value={d.front}
                      onChange={(e) => updateDraft(i, { front: e.target.value })}
                    />
                    {d.type !== 'cloze' && (
                      <textarea
                        className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm leading-relaxed text-text-dim"
                        rows={2}
                        value={d.back}
                        onChange={(e) => updateDraft(i, { back: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-hairline bg-bg px-5 py-4 md:px-7">
                <span className="text-xs text-text-dim">
                  {decks.find((d) => d.id === deckId)?.name ?? '덱 미선택'}에 저장
                </span>
                <button className={btnAccent} onClick={saveAll}>
                  전체 저장 ({drafts.length}장)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
