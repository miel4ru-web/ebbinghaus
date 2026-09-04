import { useCallback, useEffect, useState } from 'react'
import { Sidebar, type Tab } from './features/shell/Sidebar'
import { DecksView } from './features/decks/DecksView'
import { ReviewSession } from './features/review/ReviewSession'
import { GenerateView } from './features/generate/GenerateView'
import { StatsView } from './features/stats/StatsView'
import { SettingsView } from './features/settings/SettingsView'
import { syncNow } from './sync/sync'
import { getAllCards } from './db'
import { NEW_STEP } from './scheduler/ebbinghaus'

export default function App() {
  const [tab, setTab] = useState<Tab>('decks')
  const [reviewing, setReviewing] = useState<{ deckId: string; newCardsPerDay: number } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ due: number; neu: number } | null>(null)

  const refreshSummary = useCallback(async () => {
    const cards = await getAllCards()
    const now = Date.now()
    setSummary({
      due: cards.filter((c) => !c.suspended && new Date(c.due).getTime() <= now).length,
      neu: cards.filter((c) => c.step === NEW_STEP).length,
    })
  }, [])

  useEffect(() => {
    if (!reviewing) refreshSummary()
  }, [reviewing, refreshSummary])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const r = await syncNow()
      setSyncMsg(`동기화 완료 — 노트 ${r.pulledNotes}개 수신, 로그 ${r.pulledLogs}개 병합`)
      refreshSummary()
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
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <Sidebar tab={tab} onTab={setTab} onSync={handleSync} syncing={syncing} summary={summary} />

      <div className="flex min-w-0 flex-col">
        {syncMsg && (
          <div className="border-b border-hairline bg-surface-2 px-5 py-2 text-center text-sm text-text-dim md:px-8">
            {syncMsg}
          </div>
        )}
        <main className="min-w-0 flex-1">
          {tab === 'decks' && (
            <DecksView onOpenDeck={(deckId, newCardsPerDay) => setReviewing({ deckId, newCardsPerDay })} />
          )}
          {tab === 'generate' && <GenerateView />}
          {tab === 'stats' && <StatsView />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
