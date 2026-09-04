// Minimal GitHub Contents API client. Deliberately hand-rolled fetch calls (not the
// GitHub SDK/Octokit) to keep the bundle small — this is the only surface that talks to
// GitHub, so a thin wrapper is easier to audit than an added dependency.

const API_BASE = 'https://api.github.com'

export class GitHubApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
  }
}

export interface GitHubFile {
  content: string
  sha: string
}

export interface GitHubDirEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

interface RawContentResponse {
  content: string
  sha: string
}

interface RawPutResponse {
  content: { sha: string }
}

interface RawDirEntry {
  name: string
  path: string
  type: string
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** UTF-8 safe base64 encode (GitHub's Contents API requires base64 file bodies). */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function request<T>(url: string, token: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GitHubApiError(res.status, `GitHub API ${res.status}: ${body || res.statusText}`)
  }
  return (await res.json()) as T
}

export async function getFile(owner: string, repo: string, path: string, token: string): Promise<GitHubFile | null> {
  const json = await request<RawContentResponse>(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, token)
  if (!json) return null
  return { content: fromBase64(json.content), sha: json.sha }
}

/** Upserts a file. Pass the previous `sha` when updating; omit it to create a new file. */
export async function putFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
  content: string,
  message: string,
  sha?: string,
): Promise<string> {
  const json = await request<RawPutResponse>(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: toBase64(content), sha }),
  })
  if (!json) throw new GitHubApiError(500, `PUT ${path} returned no body`)
  return json.content.sha
}

export async function listDir(owner: string, repo: string, path: string, token: string): Promise<GitHubDirEntry[]> {
  const json = await request<RawDirEntry[]>(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, token)
  if (!json) return []
  return json.map((f) => ({ name: f.name, path: f.path, type: f.type === 'dir' ? 'dir' : 'file' }))
}

/** Verifies the token can read the repo — used by the settings screen's "연결 확인" button. */
export async function checkAccess(owner: string, repo: string, token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/repos/${owner}/${repo}`, { headers: authHeaders(token) })
  return res.ok
}
