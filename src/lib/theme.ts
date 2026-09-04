// Theme selection. 'system' follows the OS (no attribute — index.css handles it via
// prefers-color-scheme); 'light'/'dark' pin an explicit choice on <html data-theme>.

export type Theme = 'light' | 'dark' | 'system'

const KEY = 'ebbinghaus.theme'

export function loadTheme(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function applyTheme(theme: Theme): void {
  const el = document.documentElement
  if (theme === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

export function saveTheme(theme: Theme): void {
  if (theme === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, theme)
  applyTheme(theme)
}
