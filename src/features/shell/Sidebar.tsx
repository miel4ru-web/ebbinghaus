import type { ComponentType } from 'react'
import {
  BrandGlyph,
  DecksIcon,
  ImportIcon,
  SettingsIcon,
  StatsIcon,
  SyncIcon,
} from '../../components/icons'

export type Tab = 'decks' | 'import' | 'stats' | 'settings'

const TABS: { id: Tab; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: 'decks', label: '덱', Icon: DecksIcon },
  { id: 'import', label: '가져오기', Icon: ImportIcon },
  { id: 'stats', label: '통계', Icon: StatsIcon },
  { id: 'settings', label: '설정', Icon: SettingsIcon },
]

interface Props {
  tab: Tab
  onTab: (t: Tab) => void
  onSync: () => void
  syncing: boolean
  summary: { due: number; neu: number } | null
}

// Left rail on md+ (sticky, full height); a sticky top bar on narrow screens.
export function Sidebar({ tab, onTab, onSync, syncing, summary }: Props) {
  return (
    <aside
      className="sticky top-0 z-30 flex items-center gap-1 border-b border-hairline bg-surface px-3 py-2
                 md:h-screen md:w-60 md:flex-col md:items-stretch md:gap-1 md:border-b-0 md:border-r md:px-3 md:py-5"
    >
      <div className="flex items-center gap-2 px-1 md:px-2 md:pb-4">
        <BrandGlyph className="text-[22px]" />
        <span className="text-[17px] font-semibold tracking-tight">Ebbinghaus</span>
      </div>

      <nav className="flex gap-1 md:mt-2 md:flex-col">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => onTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors
                ${active ? 'bg-brand-quiet text-text' : 'text-text-dim hover:bg-surface-2 hover:text-text'}`}
            >
              <span
                className={`absolute -left-3 top-2 bottom-2 hidden w-[3px] rounded-r bg-brand md:block ${
                  active ? '' : 'opacity-0'
                }`}
              />
              <Icon className="text-[19px]" />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2 md:ml-0 md:mt-auto md:flex-col md:items-stretch md:gap-3">
        {summary && (
          <div className="hidden items-center justify-between rounded-lg border border-hairline bg-bg px-3 py-2.5 text-xs md:flex">
            <span className="text-text-dim">오늘의 복습</span>
            <span className="tnum font-mono">
              {summary.due}
              <span className="text-text-dim"> · 신규 {summary.neu}</span>
            </span>
          </div>
        )}
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-text hover:border-text-dim disabled:opacity-50"
        >
          <SyncIcon className={`text-sm ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{syncing ? '동기화 중…' : '동기화'}</span>
        </button>
      </div>
    </aside>
  )
}
