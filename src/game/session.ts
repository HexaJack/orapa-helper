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
  sessionStorage.removeItem(HOST_STATE_KEY)
}

// 호스트 게임 상태 복구용
const HOST_STATE_KEY = 'orapa-host-state'

export interface HostSavedState {
  roomCode: string
  roomState: unknown
  planets: unknown
}

export function saveHostState(state: HostSavedState): void {
  sessionStorage.setItem(HOST_STATE_KEY, JSON.stringify(state))
}

export function loadHostState(): HostSavedState | null {
  const raw = sessionStorage.getItem(HOST_STATE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
