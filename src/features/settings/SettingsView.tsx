import { useState } from 'react'
import { clearAnthropicKey, clearGithubToken, loadSettings, saveSettings, type Settings } from '../../lib/storage'
import { checkAccess } from '../../sync/github'

export function SettingsView() {
  const [settings, setSettings] = useState<Settings>(loadSettings())
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<'ok' | 'fail' | null>(null)

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveSettings(next)
  }

  async function testConnection() {
    setChecking(true)
    setCheckResult(null)
    const ok = await checkAccess(settings.githubOwner, settings.githubDataRepo, settings.githubToken).catch(() => false)
    setCheckResult(ok ? 'ok' : 'fail')
    setChecking(false)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">설정</h1>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">GitHub (데이터 저장)</h2>
        <p className="text-xs text-text-dim">
          <code>ebbinghaus-data</code> 저장소 하나에만 <code>contents: write</code> 권한을 준 fine-grained PAT를
          발급해서 넣으세요. 다른 권한은 주지 마세요.
        </p>
        <label className="text-sm text-text-dim">GitHub 계정</label>
        <input
          className="rounded border border-border bg-surface-2 px-3 py-2"
          value={settings.githubOwner}
          onChange={(e) => update('githubOwner', e.target.value)}
          placeholder="예: miel4ru-web"
        />
        <label className="text-sm text-text-dim">데이터 저장소 이름</label>
        <input
          className="rounded border border-border bg-surface-2 px-3 py-2"
          value={settings.githubDataRepo}
          onChange={(e) => update('githubDataRepo', e.target.value)}
        />
        <label className="text-sm text-text-dim">Personal Access Token</label>
        <input
          type="password"
          className="rounded border border-border bg-surface-2 px-3 py-2"
          value={settings.githubToken}
          onChange={(e) => update('githubToken', e.target.value)}
          placeholder="github_pat_…"
        />
        <div className="flex items-center gap-3">
          <button className="rounded bg-brand px-3 py-1.5 disabled:opacity-50" onClick={testConnection} disabled={checking}>
            {checking ? '확인 중…' : '연결 확인'}
          </button>
          {checkResult === 'ok' && <span className="text-sm text-good">연결됨 ✓</span>}
          {checkResult === 'fail' && <span className="text-sm text-again">연결 실패</span>}
          <button
            className="text-xs text-text-dim underline"
            onClick={() => {
              clearGithubToken()
              update('githubToken', '')
            }}
          >
            토큰 삭제
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">Anthropic (카드 자동 생성)</h2>
        <p className="text-xs text-text-dim">
          이 브라우저 탭에서 API를 직접 호출합니다(BYOK, 프록시 없음). 이 사이트는 공개되어 있으므로 XSS 등으로 키가
          노출될 이론적 위험이 있습니다 — 개인용으로만 사용하세요.
        </p>
        <label className="text-sm text-text-dim">Anthropic API 키</label>
        <input
          type="password"
          className="rounded border border-border bg-surface-2 px-3 py-2"
          value={settings.anthropicApiKey}
          onChange={(e) => update('anthropicApiKey', e.target.value)}
          placeholder="sk-ant-…"
        />
        <label className="text-sm text-text-dim">모델</label>
        <select
          className="rounded border border-border bg-surface-2 px-3 py-2"
          value={settings.anthropicModel}
          onChange={(e) => update('anthropicModel', e.target.value)}
        >
          <option value="claude-opus-5">claude-opus-5</option>
          <option value="claude-sonnet-5">claude-sonnet-5</option>
          <option value="claude-haiku-4-5">claude-haiku-4-5</option>
        </select>
        <button
          className="w-fit text-xs text-text-dim underline"
          onClick={() => {
            clearAnthropicKey()
            update('anthropicApiKey', '')
          }}
        >
          키 삭제
        </button>
      </section>
    </div>
  )
}
