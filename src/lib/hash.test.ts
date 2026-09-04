import { describe, expect, it } from 'vitest'
import { fnv1a, seededUnit } from './hash'

describe('fnv1a / seededUnit', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a('card-1:3')).toBe(fnv1a('card-1:3'))
    expect(seededUnit('card-1:3')).toBe(seededUnit('card-1:3'))
  })

  it('differs across different reps of the same card (in general)', () => {
    const a = seededUnit('card-1:1')
    const b = seededUnit('card-1:2')
    expect(a).not.toBe(b)
  })

  it('always returns a value in [0, 1)', () => {
    for (const seed of ['a', 'b', 'card-99:0', 'card-99:1000']) {
      const v = seededUnit(seed)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
