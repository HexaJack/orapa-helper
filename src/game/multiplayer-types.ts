import type { GameMode, Planet } from './types'
import type { LaserResult } from './laser'

export interface PlayerInfo {
  id: string
  name: string
  wrongAnswers: number
  eliminated: boolean
  online: boolean
}

export type RoomPhase = 'lobby' | 'playing' | 'finished'

export interface HistoryEntry {
  label: string
  result: LaserResult
  playerId: string
  playerName: string
}

export interface RoomState {
  roomCode: string
  gameMode: GameMode
  difficulty: number
  players: PlayerInfo[]
  currentTurnPlayerId: string | null
  history: HistoryEntry[]
  phase: RoomPhase
  winnerId: string | null
  firedLabels: string[]
}

// 호스트 → 전체 브로드캐스트
export type HostMessage =
  | { type: 'room-state'; state: RoomState }
  | { type: 'shot-result'; label: string; result: LaserResult; playerId: string; playerName: string; nextTurnPlayerId: string }
  | { type: 'answer-wrong'; playerId: string; wrongCount: number }
  | { type: 'player-eliminated'; playerId: string }
  | { type: 'answer-correct'; playerId: string }
  | { type: 'game-over'; winnerId: string | null }

// 클라이언트 → 호스트
export type ClientMessage =
  | { type: 'join-request'; playerId: string; playerName: string }
  | { type: 'fire-request'; playerId: string; label: string }
  | { type: 'answer-submission'; playerId: string; planets: Planet[] }
  | { type: 'leave'; playerId: string }
