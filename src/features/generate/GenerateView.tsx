import { useEffect, useState } from 'react'
import type { Deck, Note } from '../../types'
import { getDecks, putNote } from '../../db'
import { newId } from '../../lib/id'
import { loadSettings } from '../../lib/storage'
import { estimateCostUsd, generateNotes, toNoteFields, type GeneratedNote } from '../../llm/generate'

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
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">카드 생성 (LLM)</h1>

      <select
        className="rounded border border-border bg-surface-2 px-3 py-2"
        value={deckId}
        onChange={(e) => setDeckId(e.target.value)}
      >
        <option value="" disabled>
          저장할 덱 선택
        </option>
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <textarea
        className="min-h-[140px] rounded border border-border bg-surface-2 px-3 py-2"
        placeholder="주제어나 원문을 붙여넣으세요"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <input
        className="rounded border border-border bg-surface-2 px-3 py-2"
        placeholder="추가 지시사항 (선택)"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-text-dim">
        최대 카드 수
        <input
          type="number"
          min={1}
          max={50}
          className="w-20 rounded border border-border bg-surface-2 px-2 py-1"
          value={maxCards}
          onChange={(e) => setMaxCards(Number(e.target.value))}
        />
      </label>

      {error && <p className="text-sm text-again">{error}</p>}

      <button className="rounded-lg bg-brand py-2.5 disabled:opacity-50" onClick={generate} disabled={loading}>
        {loading ? '생성 중…' : '카드 생성'}
      </button>

      {totalCostUsd > 0 && <p className="text-xs text-text-dim">이번 세션 누적 예상 비용: ${totalCostUsd.toFixed(4)}</p>}

      {drafts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">검수 ({drafts.length}장)</h2>
          {drafts.map((d, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
              <span className="text-xs text-text-dim">{d.type}</span>
              <textarea
                className="rounded border border-border bg-surface-2 px-2 py-1"
                value={d.front}
                onChange={(e) => updateDraft(i, { front: e.target.value })}
              />
              {d.type !== 'cloze' && (
                <textarea
                  className="rounded border border-border bg-surface-2 px-2 py-1"
                  value={d.back}
                  onChange={(e) => updateDraft(i, { back: e.target.value })}
                />
              )}
              <button className="w-fit text-xs text-again underline" onClick={() => removeDraft(i)}>
                삭제
              </button>
            </div>
          ))}
          <button className="rounded-lg bg-good/80 py-2.5" onClick={saveAll}>
            전체 저장 ({drafts.length}장)
          </button>
        </div>
      )}
    </div>
  )
}
