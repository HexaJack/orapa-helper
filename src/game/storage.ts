import type { Planet, GameMode } from './types'
import type { LaserResult } from './laser'

export interface GameRecord {
  id: string
  date: string
  mode: GameMode
  winner: string
  planets: Planet[]
  history: { label: string; result: LaserResult }[]
  totalShots: number
  solved: boolean
}

const STORAGE_KEY = 'orapa-records'

export function saveGameRecord(record: GameRecord): void {
  const records = loadGameRecords()
  records.unshift(record)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function loadGameRecords(): GameRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function deleteGameRecord(id: string): void {
  const records = loadGameRecords().filter((r) => r.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function exportRecordsAsJson(): string {
  const records = loadGameRecords()
  return JSON.stringify(records, null, 2)
}

export function downloadRecordsJson(): void {
  const json = exportRecordsAsJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orapa-records-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
