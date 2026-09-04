import { useState } from 'react'
import { DecksView } from './features/decks/DecksView'
import { ReviewSession } from './features/review/ReviewSession'
import { GenerateView } from './features/generate/GenerateView'
import { StatsView } from './features/stats/StatsView'
import { SettingsView } from './features/settings/SettingsView'
import { syncNow } from './sync/sync'

type Tab = 'decks' | 'generate' | 'stats' | 'settings'

const TAB_LABEL: Record<Tab, string> = { decks: '덱', generate: '생성', stats: '통계', settings: '설정' }

export default function App() {
  const [tab, setTab] = useState<Tab>('decks')
  const [reviewing, setReviewing] = useState<{ deckId: string; newCardsPerDay: number } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const r = await syncNow()
      setSyncMsg(`동기화 완료 — 노트 ${r.pulledNotes}개 수신, 로그 ${r.pulledLogs}개 병합`)
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  if (reviewing) {
    return (
      <ReviewSession
        deckId={reviewing.deckId}
        newCardsPerDay={reviewing.newCardsPerDay}
        onExit={() => setReviewing(null)}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-semibold">Ebbinghaus</span>
        <button className="text-sm text-brand-light disabled:opacity-50" onClick={handleSync} disabled={syncing}>
          {syncing ? '동기화 중…' : '동기화'}
        </button>
      </header>

      {syncMsg && <div className="bg-surface-2 px-4 py-2 text-sm text-text-dim">{syncMsg}</div>}

      <main className="flex-1 overflow-y-auto pb-16">
        {tab === 'decks' && (
          <DecksView onOpenDeck={(deckId, newCardsPerDay) => setReviewing({ deckId, newCardsPerDay })} />
        )}
        {tab === 'generate' && <GenerateView />}
        {tab === 'stats' && <StatsView />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface">
        {(['decks', 'generate', 'stats', 'settings'] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 py-3 text-sm ${tab === t ? 'text-brand-light' : 'text-text-dim'}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>
    </div>
  )
}
