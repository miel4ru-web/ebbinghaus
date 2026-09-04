// CSV importer for externally-produced flashcard data — the workflow is: ask any LLM to
// emit a table of cards, paste/upload the file here, review, and create a deck from it.
// This replaces the old in-app BYOK generation (no API key in the browser any more).
//
// The parser is RFC 4180: double-quoted fields, "" as an escaped quote, and newlines
// allowed inside quotes. The delimiter is auto-detected between comma, tab and semicolon
// so spreadsheet exports and LLM output both work.

import type { NoteType } from '../types'

const NOTE_TYPES: readonly NoteType[] = ['basic', 'reverse', 'cloze']

/** Header name -> canonical column, matched case-insensitively after trimming. */
const COLUMN_ALIASES: Record<string, 'type' | 'front' | 'back' | 'tags'> = {
  type: 'type', kind: 'type', 유형: 'type', 종류: 'type',
  front: 'front', q: 'front', question: 'front', prompt: 'front', 앞: 'front', 질문: 'front', 문제: 'front',
  back: 'back', a: 'back', answer: 'back', 뒤: 'back', 답: 'back', 정답: 'back',
  tags: 'tags', tag: 'tags', 태그: 'tags',
}

const CLOZE_RE = /\{\{c\d+::.+?\}\}/

export interface ParsedNote {
  /** 1-based line number in the source, for the preview and error list. */
  row: number
  type: NoteType
  fields: Record<string, string>
  tags: string[]
}

export interface RowError {
  row: number
  message: string
}

export interface ParseResult {
  notes: ParsedNote[]
  errors: RowError[]
  /** True when the first row was consumed as a header rather than data. */
  hadHeader: boolean
}

/**
 * Splits CSV text into rows of raw string cells. Handles quoted cells, "" escapes,
 * CRLF/LF, embedded newlines, and a leading UTF-8 BOM.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(cell); cell = '' }
    else if (ch === '\r') { /* skip, handled by \n */ }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split('\n')[0] ?? ''
  const candidates: [string, number][] = [
    [',', firstLine.split(',').length],
    ['\t', firstLine.split('\t').length],
    [';', firstLine.split(';').length],
  ]
  const best = candidates.reduce((a, b) => (b[1] > a[1] ? b : a))
  return best[1] > 1 ? best[0] : ','
}

function isBlank(cells: string[]): boolean {
  return cells.every((c) => c.trim() === '')
}

/** Maps header cells to canonical column indices; returns null if nothing recognisable. */
function readHeader(cells: string[]): Partial<Record<'type' | 'front' | 'back' | 'tags', number>> | null {
  const map: Partial<Record<'type' | 'front' | 'back' | 'tags', number>> = {}
  cells.forEach((cell, i) => {
    const key = COLUMN_ALIASES[cell.trim().toLowerCase()]
    if (key && map[key] === undefined) map[key] = i
  })
  return map.front !== undefined ? map : null
}

/** Column layout when there is no header row, keyed by how many columns each data row has. */
function positionalColumns(width: number): Record<'type' | 'front' | 'back' | 'tags', number> {
  if (width <= 2) return { type: -1, front: 0, back: 1, tags: -1 }
  return { type: -1, front: 0, back: 1, tags: 2 }
}

function splitTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function rowToNote(
  cells: string[],
  cols: Partial<Record<'type' | 'front' | 'back' | 'tags', number>>,
  row: number,
): ParsedNote | RowError {
  const at = (k: 'type' | 'front' | 'back' | 'tags'): string => {
    const idx = cols[k]
    return idx === undefined || idx < 0 ? '' : (cells[idx] ?? '').trim()
  }

  const front = at('front')
  const back = at('back')
  if (!front) return { row, message: '앞면(front)이 비어 있습니다' }

  let type: NoteType
  const declared = at('type').toLowerCase()
  if (declared) {
    if (!NOTE_TYPES.includes(declared as NoteType)) {
      return { row, message: `알 수 없는 유형 "${declared}" (basic·reverse·cloze 중 하나)` }
    }
    type = declared as NoteType
  } else {
    type = CLOZE_RE.test(front) ? 'cloze' : 'basic'
  }

  if (type === 'cloze') {
    if (!CLOZE_RE.test(front)) return { row, message: 'cloze 카드에 {{c1::...}} 표기가 없습니다' }
    return { row, type, fields: { text: front }, tags: splitTags(at('tags')) }
  }
  if (!back) return { row, message: '뒷면(back)이 비어 있습니다' }
  return { row, type, fields: { front, back }, tags: splitTags(at('tags')) }
}

/** Parses a card CSV into notes plus per-row errors. Blank lines are skipped silently. */
export function parseNotesCsv(text: string): ParseResult {
  if (!text.trim()) return { notes: [], errors: [], hadHeader: false }

  const delimiter = detectDelimiter(text)
  const rows = parseCsv(text, delimiter)

  const header = rows.length > 0 ? readHeader(rows[0]) : null
  const hadHeader = header !== null
  const dataRows = hadHeader ? rows.slice(1) : rows

  const notes: ParsedNote[] = []
  const errors: RowError[] = []

  dataRows.forEach((cells, i) => {
    const rowNum = i + (hadHeader ? 2 : 1)
    if (isBlank(cells)) return
    const cols = header ?? positionalColumns(cells.length)
    const result = rowToNote(cells, cols, rowNum)
    if ('message' in result) errors.push(result)
    else notes.push(result)
  })

  return { notes, errors, hadHeader }
}
