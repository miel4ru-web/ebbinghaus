import { describe, expect, it } from 'vitest'
import { parseCsv, parseNotesCsv } from './csv'

describe('parseCsv', () => {
  it('splits simple comma rows', () => {
    expect(parseCsv('a,b,c\n1,2,3', ',')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('handles quoted cells with commas, escaped quotes and embedded newlines', () => {
    const text = '"a,b","he said ""hi""","line1\nline2"'
    expect(parseCsv(text, ',')).toEqual([['a,b', 'he said "hi"', 'line1\nline2']])
  })

  it('handles CRLF line endings and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('strips a leading BOM', () => {
    expect(parseCsv('﻿a,b', ',')).toEqual([['a', 'b']])
  })

  it('parses tab-delimited input', () => {
    expect(parseCsv('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseNotesCsv', () => {
  it('reads a header row and maps columns by name', () => {
    const r = parseNotesCsv('type,front,back,tags\nbasic,수도,파리,지리 유럽')
    expect(r.hadHeader).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.notes).toEqual([
      { row: 2, type: 'basic', fields: { front: '수도', back: '파리' }, tags: ['지리', '유럽'] },
    ])
  })

  it('accepts columns in any order and ignores unknown headers', () => {
    const r = parseNotesCsv('back,note,front\n파리,x,수도')
    expect(r.notes[0].fields).toEqual({ front: '수도', back: '파리' })
  })

  it('infers cloze from {{c1::}} markup when type is omitted', () => {
    const r = parseNotesCsv('front,back\n"프랑스의 수도는 {{c1::파리}}",')
    expect(r.notes[0].type).toBe('cloze')
    expect(r.notes[0].fields).toEqual({ text: '프랑스의 수도는 {{c1::파리}}' })
  })

  it('treats a headerless two-column file as basic front/back', () => {
    const r = parseNotesCsv('개,dog\n고양이,cat')
    expect(r.hadHeader).toBe(false)
    expect(r.notes).toHaveLength(2)
    expect(r.notes[1]).toEqual({ row: 2, type: 'basic', fields: { front: '고양이', back: 'cat' }, tags: [] })
  })

  it('flags rows missing a required field, keeping the good ones', () => {
    const r = parseNotesCsv('type,front,back\nbasic,,파리\nbasic,수도,\nbasic,개,dog')
    expect(r.notes).toHaveLength(1)
    expect(r.errors).toEqual([
      { row: 2, message: '앞면(front)이 비어 있습니다' },
      { row: 3, message: '뒷면(back)이 비어 있습니다' },
    ])
  })

  it('rejects an unknown note type', () => {
    const r = parseNotesCsv('type,front,back\nquiz,수도,파리')
    expect(r.notes).toEqual([])
    expect(r.errors[0].message).toContain('quiz')
  })

  it('rejects a cloze row without cloze markup', () => {
    const r = parseNotesCsv('type,front,back\ncloze,그냥 문장,')
    expect(r.errors[0].message).toContain('{{c1::')
  })

  it('skips blank lines', () => {
    const r = parseNotesCsv('front,back\n개,dog\n\n고양이,cat\n')
    expect(r.notes).toHaveLength(2)
  })

  it('returns empty for empty input', () => {
    expect(parseNotesCsv('   ')).toEqual({ notes: [], errors: [], hadHeader: false })
  })
})
