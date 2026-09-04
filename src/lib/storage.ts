// Settings persistence. GitHub PAT and Anthropic API key live in localStorage — see the
// plan's "보안" section for the accepted trade-off (1-user app, no server to hide keys
// behind) and the mitigations (fine-grained PAT scoped to one repo, strict CSP, DOMPurify
// on all rendered card content).

const KEYS = {
  githubToken: 'ebbinghaus.githubToken',
  githubOwner: 'ebbinghaus.githubOwner',
  githubDataRepo: 'ebbinghaus.githubDataRepo',
  anthropicApiKey: 'ebbinghaus.anthropicApiKey',
  anthropicModel: 'ebbinghaus.anthropicModel',
} as const

export const DEFAULT_MODEL = 'claude-opus-5'

export interface Settings {
  githubToken: string
  githubOwner: string
  githubDataRepo: string
  anthropicApiKey: string
  anthropicModel: string
}

export function loadSettings(): Settings {
  return {
    githubToken: localStorage.getItem(KEYS.githubToken) ?? '',
    githubOwner: localStorage.getItem(KEYS.githubOwner) ?? '',
    githubDataRepo: localStorage.getItem(KEYS.githubDataRepo) ?? 'ebbinghaus-data',
    anthropicApiKey: localStorage.getItem(KEYS.anthropicApiKey) ?? '',
    anthropicModel: localStorage.getItem(KEYS.anthropicModel) ?? DEFAULT_MODEL,
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEYS.githubToken, settings.githubToken)
  localStorage.setItem(KEYS.githubOwner, settings.githubOwner)
  localStorage.setItem(KEYS.githubDataRepo, settings.githubDataRepo)
  localStorage.setItem(KEYS.anthropicApiKey, settings.anthropicApiKey)
  localStorage.setItem(KEYS.anthropicModel, settings.anthropicModel)
}

export function clearGithubToken(): void {
  localStorage.removeItem(KEYS.githubToken)
}

export function clearAnthropicKey(): void {
  localStorage.removeItem(KEYS.anthropicApiKey)
}

export function isGithubConfigured(s: Settings): boolean {
  return Boolean(s.githubToken && s.githubOwner && s.githubDataRepo)
}

export function isAnthropicConfigured(s: Settings): boolean {
  return Boolean(s.anthropicApiKey)
}
