import DOMPurify from 'dompurify'

// Card content comes from the LLM and from document imports — both untrusted input that
// gets rendered as HTML (cloze reveal/mask needs real markup, not just escaped text), so
// every field goes through DOMPurify with a tight tag allowlist before it reaches the DOM.

/** Whitelist-only markdown: **bold**, *italic*, `code`, line breaks. Nothing else. */
function mdToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
}

const ALLOWED_TAGS = ['strong', 'em', 'code', 'br', 'u']

export function renderField(text: string): string {
  return DOMPurify.sanitize(mdToHtml(text), { ALLOWED_TAGS })
}

/**
 * Renders a cloze note's `text` field for one specific card ord.
 * {{c1::answer}} is masked as "[...]" until `reveal`, then shown underlined. Clozes
 * belonging to a *different* ord (a sibling card from the same note) are always shown
 * plainly, since they're context for this card, not the thing being tested.
 */
export function renderClozeField(text: string, targetOrd: number, reveal: boolean): string {
  const html = mdToHtml(text).replace(/\{\{c(\d+)::(.+?)\}\}/g, (_m, n: string, answer: string) => {
    const ord = Number(n) - 1
    if (ord !== targetOrd) return `<strong>${answer}</strong>`
    return reveal ? `<u>${answer}</u>` : '[...]'
  })
  return DOMPurify.sanitize(html, { ALLOWED_TAGS })
}
