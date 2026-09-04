// Settings persistence. The GitHub PAT lives in localStorage — see the plan's "보안"
// section for the accepted trade-off (1-user app, no server to hide the key behind) and
// the mitigations (fine-grained PAT scoped to one repo, strict CSP, DOMPurify on all
// rendered card content). Card generation is no longer done in-app, so no LLM key here.

const KEYS = {
  githubToken: 'ebbinghaus.githubToken',
  githubOwner: 'ebbinghaus.githubOwner',
  githubDataRepo: 'ebbinghaus.githubDataRepo',
} as const

export interface Settings {
  githubToken: string
  githubOwner: string
  githubDataRepo: string
}

export function loadSettings(): Settings {
  return {
    githubToken: localStorage.getItem(KEYS.githubToken) ?? '',
    githubOwner: localStorage.getItem(KEYS.githubOwner) ?? '',
    githubDataRepo: localStorage.getItem(KEYS.githubDataRepo) ?? 'ebbinghaus-data',
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEYS.githubToken, settings.githubToken)
  localStorage.setItem(KEYS.githubOwner, settings.githubOwner)
  localStorage.setItem(KEYS.githubDataRepo, settings.githubDataRepo)
}

export function clearGithubToken(): void {
  localStorage.removeItem(KEYS.githubToken)
}

export function isGithubConfigured(s: Settings): boolean {
  return Boolean(s.githubToken && s.githubOwner && s.githubDataRepo)
}
