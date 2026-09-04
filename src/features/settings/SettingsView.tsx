import { useState } from 'react'
import { clearAnthropicKey, clearGithubToken, loadSettings, saveSettings, type Settings } from '../../lib/storage'
import { loadTheme, saveTheme, type Theme } from '../../lib/theme'
import { checkAccess } from '../../sync/github'
import { PageHeader, Callout, btnAccent } from '../../components/ui'
import { CheckIcon } from '../../components/icons'

const inputCls = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text'
const labelCls = 'text-xs text-text-dim'

const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: '라이트' },
  { id: 'dark', label: '다크' },
  { id: 'system', label: '시스템' },
]

export function SettingsView() {
  const [settings, setSettings] = useState<Settings>(loadSettings())
  const [theme, setTheme] = useState<Theme>(loadTheme())
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<'ok' | 'fail' | null>(null)

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveSettings(next)
  }

  function pickTheme(t: Theme) {
    setTheme(t)
    saveTheme(t)
  }

  async function testConnection() {
    setChecking(true)
    setCheckResult(null)
    const ok = await checkAccess(settings.githubOwner, settings.githubDataRepo, settings.githubToken).catch(() => false)
    setCheckResult(ok ? 'ok' : 'fail')
    setChecking(false)
  }

  return (
    <>
      <PageHeader title="설정" subtitle="데이터 동기화 · 카드 생성 키 · 화면" />

      <div className="max-w-2xl px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-hairline bg-surface p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">화면 — 테마</h2>
              <div className="inline-flex overflow-hidden rounded-lg border border-border">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickTheme(t.id)}
                    className={`border-r border-border px-4 py-1.5 text-xs last:border-r-0 ${
                      theme === t.id ? 'bg-brand-quiet text-text' : 'bg-bg text-text-dim hover:text-text'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-hairline bg-surface p-5 md:p-6">
            <h2 className="text-base font-semibold">GitHub — 데이터 저장</h2>
            <p className="mb-4 mt-1 text-xs leading-relaxed text-text-dim">
              <code className="rounded bg-surface-2 px-1 py-0.5">ebbinghaus-data</code> 저장소 하나에만{' '}
              <code className="rounded bg-surface-2 px-1 py-0.5">contents: write</code> 권한을 준 fine-grained PAT를
              발급해서 넣으세요. 다른 권한은 주지 마세요.
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>GitHub 계정</span>
                <input
                  className={inputCls}
                  value={settings.githubOwner}
                  onChange={(e) => update('githubOwner', e.target.value)}
                  placeholder="예: miel4ru-web"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>데이터 저장소 이름</span>
                <input
                  className={inputCls}
                  value={settings.githubDataRepo}
                  onChange={(e) => update('githubDataRepo', e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Personal Access Token</span>
                <input
                  type="password"
                  className={inputCls}
                  value={settings.githubToken}
                  onChange={(e) => update('githubToken', e.target.value)}
                  placeholder="github_pat_…"
                />
              </label>
              <div className="mt-1 flex items-center gap-3">
                <button className={btnAccent} onClick={testConnection} disabled={checking}>
                  {checking ? '확인 중…' : '연결 확인'}
                </button>
                {checkResult === 'ok' && (
                  <span className="flex items-center gap-1 text-sm text-good">
                    <CheckIcon className="text-sm" /> 연결됨
                  </span>
                )}
                {checkResult === 'fail' && <span className="text-sm text-again">연결 실패</span>}
                <button
                  className="ml-auto text-xs text-text-dim underline hover:text-text"
                  onClick={() => {
                    clearGithubToken()
                    update('githubToken', '')
                  }}
                >
                  토큰 삭제
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-hairline bg-surface p-5 md:p-6">
            <h2 className="mb-3 text-base font-semibold">Anthropic — 카드 자동 생성</h2>
            <Callout tone="warn" className="mb-4">
              이 브라우저 탭에서 API를 직접 호출합니다 (BYOK, 프록시 없음). 이 사이트는 공개되어 있으므로 XSS 등으로
              키가 노출될 이론적 위험이 있습니다 — 개인용으로만 사용하세요.
            </Callout>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Anthropic API 키</span>
                <input
                  type="password"
                  className={inputCls}
                  value={settings.anthropicApiKey}
                  onChange={(e) => update('anthropicApiKey', e.target.value)}
                  placeholder="sk-ant-…"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>모델</span>
                <select
                  className={inputCls}
                  value={settings.anthropicModel}
                  onChange={(e) => update('anthropicModel', e.target.value)}
                >
                  <option value="claude-opus-5">claude-opus-5</option>
                  <option value="claude-sonnet-5">claude-sonnet-5</option>
                  <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                </select>
              </label>
              <button
                className="mt-1 w-fit text-xs text-text-dim underline hover:text-text"
                onClick={() => {
                  clearAnthropicKey()
                  update('anthropicApiKey', '')
                }}
              >
                키 삭제
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
