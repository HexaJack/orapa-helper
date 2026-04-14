const SESSION_KEY = 'orapa-online-session'
const NAME_KEY = 'orapa-player-name'

export function savePlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name)
}

export function loadPlayerName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export interface OnlineSession {
  role: 'host' | 'client'
  roomCode: string
  playerName: string
}

export function saveSession(session: OnlineSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSession(): OnlineSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
