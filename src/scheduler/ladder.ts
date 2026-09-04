// The Ebbinghaus ladder is a tunable *preset*, not scripture — see plan Context. It is the
// starting point for a card's spacing; per-card `ease` (see ebbinghaus.ts) adjusts it based
// on actual recall history.

export const LADDER_MINUTES = [
  10, // 10분
  60, // 1시간
  60 * 24, // 1일
  60 * 24 * 2, // 2일 (48시간)
  60 * 24 * 4, // 4일
  60 * 24 * 7, // 1주
  60 * 24 * 14, // 2주
  60 * 24 * 30, // 1개월
  60 * 24 * 90, // 3개월
  60 * 24 * 180, // 6개월
] as const

export const LADDER_LABELS = ['10분', '1시간', '1일', '2일', '4일', '1주', '2주', '1개월', '3개월', '6개월'] as const
