// Browser-direct BYOK call to the Anthropic API. `dangerouslyAllowBrowser: true` makes
// the SDK send the `anthropic-dangerous-direct-browser-access` header, which the API
// accepts with CORS — no proxy server needed. The trade-off (the user's own key sits in
// this tab) is accepted and documented in the plan's "보안" section.
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { NoteType } from '../types'

const GeneratedNoteSchema = z.object({
  type: z.enum(['basic', 'reverse', 'cloze']),
  front: z.string().describe('For basic/reverse: the prompt side. For cloze: the full sentence with {{c1::...}} markup.'),
  back: z.string().describe('For basic/reverse: the answer side. Empty string for cloze notes.'),
  tags: z.array(z.string()),
})

const GeneratedDeckSchema = z.object({
  notes: z.array(GeneratedNoteSchema),
})

export type GeneratedNote = z.infer<typeof GeneratedNoteSchema>

export interface GenerateParams {
  apiKey: string
  model: string
  /** Free-form topic, or pasted source text/document to derive cards from. */
  source: string
  /** Extra instructions, e.g. "시험 대비", "일본어 JLPT N3 단어". */
  instructions?: string
  maxCards?: number
}

export interface GenerateUsage {
  inputTokens: number
  outputTokens: number
}

export interface GenerateResult {
  notes: GeneratedNote[]
  usage: GenerateUsage
}

const SYSTEM_PROMPT = `You write spaced-repetition flashcards. Follow Wozniak's minimum
information principle strictly:
- One fact per card. Never combine multiple facts into one front/back pair.
- Never write a card whose answer is a list or enumeration — split it into one card per item.
- Prefer cloze deletion for facts embedded in a sentence; prefer basic front/back for
  discrete question/answer pairs; use reverse only when recalling in both directions is
  actually useful (e.g. vocabulary pairs).
- Include enough context in the front that the card is unambiguous out of context, but no
  more than that.
- Do not create a card for anything the source material doesn't actually support.
- Write in the same language as the source material unless instructed otherwise.`

/** Rough cost estimate in USD for the configured model tiers, for the UI's running total. */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export function estimateCostUsd(model: string, usage: GenerateUsage): number {
  const price = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK['claude-opus-5']
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000
}

export async function generateNotes(params: GenerateParams): Promise<GenerateResult> {
  const client = new Anthropic({ apiKey: params.apiKey, dangerouslyAllowBrowser: true })

  const userText = [
    params.instructions ? `추가 지시사항: ${params.instructions}` : null,
    `최대 ${params.maxCards ?? 20}장까지 생성하세요.`,
    '---',
    params.source,
  ]
    .filter(Boolean)
    .join('\n\n')

  const response = await client.messages.parse({
    model: params.model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userText }],
    output_config: { format: zodOutputFormat(GeneratedDeckSchema) },
  })

  if (!response.parsed_output) {
    throw new Error('모델이 유효한 카드 목록을 생성하지 못했습니다. 다시 시도해주세요.')
  }

  return {
    notes: response.parsed_output.notes,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  }
}

/** Maps a generated note's declared type to the app's NoteType + field shape. */
export function toNoteFields(note: GeneratedNote): { type: NoteType; fields: Record<string, string> } {
  if (note.type === 'cloze') {
    return { type: 'cloze', fields: { text: note.front } }
  }
  return { type: note.type, fields: { front: note.front, back: note.back } }
}
