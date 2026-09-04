import { openDB, type IDBPDatabase } from 'idb'
import type { EbbinghausDB } from './schema'
import type { Card, Deck, Note, ReviewLog } from '../types'

const DB_NAME = 'ebbinghaus'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<EbbinghausDB>> | null = null

export function getDB(): Promise<IDBPDatabase<EbbinghausDB>> {
  if (!dbPromise) {
    dbPromise = openDB<EbbinghausDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const notes = db.createObjectStore('notes', { keyPath: 'id' })
        notes.createIndex('by-deck', 'deckId')

        const cards = db.createObjectStore('cards', { keyPath: 'id' })
        cards.createIndex('by-deck', 'deckId')
        cards.createIndex('by-due', 'due')
        cards.createIndex('by-note', 'noteId')

        const logs = db.createObjectStore('reviewLogs', { keyPath: ['cardId', 'reviewedAt'] })
        logs.createIndex('by-card', 'cardId')

        db.createObjectStore('decks', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

// --- Decks ---
export async function putDeck(deck: Deck): Promise<void> {
  const db = await getDB()
  await db.put('decks', deck)
}
export async function getDecks(): Promise<Deck[]> {
  const db = await getDB()
  return db.getAll('decks')
}
export async function getDeck(id: string): Promise<Deck | undefined> {
  const db = await getDB()
  return db.get('decks', id)
}

// --- Notes ---
export async function putNote(note: Note): Promise<void> {
  const db = await getDB()
  await db.put('notes', note)
}
export async function getNotesByDeck(deckId: string): Promise<Note[]> {
  const db = await getDB()
  return db.getAllFromIndex('notes', 'by-deck', deckId)
}
export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDB()
  return db.get('notes', id)
}
export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB()
  return db.getAll('notes')
}

// --- Cards ---
export async function putCard(card: Card): Promise<void> {
  const db = await getDB()
  await db.put('cards', card)
}
export async function putCards(cards: Card[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('cards', 'readwrite')
  await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done])
}
export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  const db = await getDB()
  return db.getAllFromIndex('cards', 'by-deck', deckId)
}
export async function getCardsByNote(noteId: string): Promise<Card[]> {
  const db = await getDB()
  return db.getAllFromIndex('cards', 'by-note', noteId)
}
export async function getAllCards(): Promise<Card[]> {
  const db = await getDB()
  return db.getAll('cards')
}

/** Due, unsuspended cards for a deck, oldest-due first, capped at `limit`. */
export async function getDueCards(deckId: string, now: Date, limit: number): Promise<Card[]> {
  const all = await getCardsByDeck(deckId)
  return all
    .filter((c) => !c.suspended && new Date(c.due).getTime() <= now.getTime())
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, limit)
}

// --- Review logs ---
export async function putReviewLog(log: ReviewLog): Promise<void> {
  const db = await getDB()
  await db.put('reviewLogs', log)
}
export async function getAllReviewLogs(): Promise<ReviewLog[]> {
  const db = await getDB()
  return db.getAll('reviewLogs')
}
export async function getReviewLogsForCard(cardId: string): Promise<ReviewLog[]> {
  const db = await getDB()
  return db.getAllFromIndex('reviewLogs', 'by-card', cardId)
}
