/**
 * Deterministic 32-bit FNV-1a hash. The scheduler uses this to seed its interval "fuzz"
 * so it stays a pure function of (card, rating, now) — replaying the same review log
 * on any device always reproduces the same due dates. Do not swap this for Math.random().
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Maps a string seed to a float in [0, 1). */
export function seededUnit(seed: string): number {
  return fnv1a(seed) / 0x100000000
}
