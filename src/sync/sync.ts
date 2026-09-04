// Orchestrates pull -> merge -> push against the ebbinghaus-data repo.
//
// Two different conflict strategies are used deliberately:
//  - Notes/decks (content): last-push-wins per deck file. This app is built for one
//    person using it mostly sequentially across devices (see plan), not concurrent
//    simultaneous editing, so a simple whole-file upsert is an acceptable v1 trade-off.
//  - Cards/review logs (schedule state): full log-replay merge (see scheduler/replay.ts).
//    This is the case that actually happens in normal use — reviewing on your phone and
//    then your PC before the next sync — so it gets the real conflict-free mechanism.
import { getFile, putFile, listDir } from './github'
import {
  getAllNotes,
  putNote,
  getDecks,
  putDeck,
  getAllReviewLogs,
  putReviewLog,
  putCards,
} from '../db'
import { cardId, cardOrdsForNote } from '../scheduler/cards'
import { createCard } from '../scheduler/ebbinghaus'
import { replay, dedupeLogs } from '../scheduler/replay'
import type { Card, Deck, Note, ReviewLog } from '../types'
import { loadSettings } from '../lib/storage'

export interface SyncResult {
  pulledNotes: number
  pulledLogs: number
  pushedNotes: number
  pushedLogShards: number
}

function monthKey(iso: string): string {
  return iso.slice(0, 7) // YYYY-MM
}

export async function syncNow(): Promise<SyncResult> {
  const settings = loadSettings()
  if (!settings.githubToken || !settings.githubOwner) {
    throw new Error('GitHub 설정이 없습니다. 설정 화면에서 계정과 토큰을 입력하세요.')
  }
  const owner = settings.githubOwner
  const repo = settings.githubDataRepo
  const token = settings.githubToken
  const shas: Record<string, string> = {}

  // 1. Pull decks + notes. Remote is authoritative for any deck that already exists there.
  const remoteDeckDirs = await listDir(owner, repo, 'decks', token)
  const localNotesBefore = await getAllNotes()
  const localNoteIdsBefore = new Set(localNotesBefore.map((n) => n.id))
  let pulledNotes = 0

  for (const dir of remoteDeckDirs) {
    if (dir.type !== 'dir') continue
    const metaFile = await getFile(owner, repo, `${dir.path}/meta.json`, token)
    if (metaFile) {
      shas[`${dir.path}/meta.json`] = metaFile.sha
      const deck = JSON.parse(metaFile.content) as Deck
      await putDeck(deck)
    }
    const notesFile = await getFile(owner, repo, `${dir.path}/notes.json`, token)
    if (notesFile) {
      shas[`${dir.path}/notes.json`] = notesFile.sha
      const notes = JSON.parse(notesFile.content) as Note[]
      for (const note of notes) {
        await putNote(note)
        if (!localNoteIdsBefore.has(note.id)) pulledNotes++
      }
    }
  }

  // 2. Pull every review-log month shard.
  const logFiles = await listDir(owner, repo, 'logs', token)
  const remoteLogs: ReviewLog[] = []
  for (const f of logFiles) {
    if (f.type !== 'file' || !f.name.endsWith('.jsonl')) continue
    const file = await getFile(owner, repo, f.path, token)
    if (!file) continue
    shas[f.path] = file.sha
    for (const line of file.content.split('\n')) {
      if (line.trim()) remoteLogs.push(JSON.parse(line) as ReviewLog)
    }
  }

  const localLogsBefore = await getAllReviewLogs()
  const mergedLogs = dedupeLogs([...remoteLogs, ...localLogsBefore])
  const pulledLogs = mergedLogs.length - localLogsBefore.length
  for (const log of mergedLogs) await putReviewLog(log)

  // 3. Rebuild card state by replaying merged logs over pristine seeds derived from
  //    notes — never from the mutable cards.json cache, so replay is never double-applied.
  const allNotes = await getAllNotes()
  const seeds = new Map<string, Card>()
  for (const note of allNotes) {
    for (const ord of cardOrdsForNote(note)) {
      const id = cardId(note.id, ord)
      seeds.set(
        id,
        createCard({ id, noteId: note.id, deckId: note.deckId, ord, now: new Date(note.createdAt) }),
      )
    }
  }
  const rebuilt = replay(seeds, mergedLogs)
  await putCards([...rebuilt.values()])

  // 4. Push local decks/notes (whole-file upsert) and the updated log shards + snapshot.
  const decks = await getDecks()
  let pushedNotes = 0
  for (const deck of decks) {
    const deckNotes = allNotes.filter((n) => n.deckId === deck.id)
    const metaPath = `decks/${deck.id}/meta.json`
    const notesPath = `decks/${deck.id}/notes.json`
    await putFile(owner, repo, metaPath, token, JSON.stringify(deck, null, 2), `sync: ${deck.name} meta`, shas[metaPath])
    await putFile(
      owner,
      repo,
      notesPath,
      token,
      JSON.stringify(deckNotes, null, 2),
      `sync: ${deck.name} notes (${deckNotes.length})`,
      shas[notesPath],
    )
    pushedNotes += deckNotes.length
  }

  const byMonth = new Map<string, ReviewLog[]>()
  for (const log of mergedLogs) {
    const key = monthKey(log.reviewedAt)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(log)
  }
  let pushedLogShards = 0
  for (const [month, logs] of byMonth) {
    logs.sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
    const path = `logs/${month}.jsonl`
    const body = `${logs.map((l) => JSON.stringify(l)).join('\n')}\n`
    await putFile(owner, repo, path, token, body, `sync: ${month} review log (${logs.length})`, shas[path])
    pushedLogShards++
  }

  const snapshotSha = (await getFile(owner, repo, 'state/cards.json', token))?.sha
  await putFile(
    owner,
    repo,
    'state/cards.json',
    token,
    JSON.stringify([...rebuilt.values()], null, 2),
    'sync: rebuild card-state snapshot',
    snapshotSha,
  )

  return { pulledNotes, pulledLogs, pushedNotes, pushedLogShards }
}
