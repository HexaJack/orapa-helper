import { useState } from 'react'
import type { GameMode } from '../game/types'
import type { DifficultyLevel } from '../game/difficulty'
import type { RoomState } from '../game/multiplayer-types'
import './online-lobby.css'

interface Props {
  onBack: () => void
  onGameStart: (mode: 'host' | 'client', roomCode: string, playerName: string) => void
}

export default function OnlineLobby({ onBack, onGameStart }: Props) {
  const [screen, setScreen] = useState<'menu' | 'create' | 'join'>('menu')
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [gameMode, setGameMode] = useState<GameMode>('basic')
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'any'>('any')

  if (screen === 'menu') {
    return (
      <div className="lobby">
        <h2>온라인 멀티플레이</h2>
        <div className="lobby-form">
          <input
            type="text"
            placeholder="이름 입력"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="lobby-input"
            maxLength={10}
          />
          <div className="lobby-buttons">
            <button className="btn btn-finish" onClick={() => playerName.trim() && setScreen('create')}>
              방 만들기
            </button>
            <button className="btn" onClick={() => playerName.trim() && setScreen('join')}>
              방 참가
            </button>
          </div>
          <button className="btn btn-back" onClick={onBack}>뒤로가기</button>
        </div>
      </div>
    )
  }

  if (screen === 'join') {
    return (
      <div className="lobby">
        <h2>방 참가</h2>
        <div className="lobby-form">
          <p className="lobby-name">이름: {playerName}</p>
          <input
            type="text"
            placeholder="6자리 방 코드"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="lobby-input lobby-code-input"
            maxLength={6}
            inputMode="numeric"
          />
          <div className="lobby-buttons">
            <button
              className="btn btn-finish"
              disabled={roomCode.length !== 6}
              onClick={() => onGameStart('client', roomCode, playerName.trim())}
            >
              참가
            </button>
            <button className="btn" onClick={() => setScreen('menu')}>뒤로</button>
          </div>
        </div>
      </div>
    )
  }

  // create
  return (
    <div className="lobby">
      <h2>방 만들기</h2>
      <div className="lobby-form">
        <p className="lobby-name">이름: {playerName}</p>

        <div className="lobby-option">
          <span className="lobby-label">게임 모드</span>
          <div className="mode-toggle" onClick={() => setGameMode(m => m === 'basic' ? 'blackhole' : 'basic')}>
            <div className={`toggle-option${gameMode === 'basic' ? ' active' : ''}`}>기본</div>
            <div className={`toggle-option${gameMode === 'blackhole' ? ' active' : ''}`}>블랙홀</div>
          </div>
        </div>

        <div className="lobby-option">
          <span className="lobby-label">난이도</span>
          <div className="mode-toggle diff-toggle">
            {(['any', 'easy', 'normal', 'hard'] as const).map(d => (
              <div key={d}
                className={`toggle-option${d !== 'any' ? ` diff-${d}-opt` : ''}${difficulty === d ? ' active' : ''}`}
                onClick={() => setDifficulty(d)}>
                {{ any: '전체', easy: '쉬움', normal: '보통', hard: '어려움' }[d]}
              </div>
            ))}
          </div>
        </div>

        <div className="lobby-buttons">
          <button
            className="btn btn-finish"
            onClick={() => onGameStart('host', '', playerName.trim())}
          >
            방 생성
          </button>
          <button className="btn" onClick={() => setScreen('menu')}>뒤로</button>
        </div>
      </div>
    </div>
  )
}

interface HostLobbyProps {
  roomState: RoomState
  hostId: string
  onStart: () => void
  onBack: () => void
}

export function HostWaitingRoom({ roomState, hostId, onStart, onBack }: HostLobbyProps) {
  return (
    <div className="lobby">
      <h2>대기실</h2>
      <div className="room-code-display">
        <span className="room-code-label">방 코드</span>
        <span className="room-code">{roomState.roomCode}</span>
      </div>
      <div className="player-list">
        <h3>참가자 ({roomState.players.length}명)</h3>
        {roomState.players.map(p => (
          <div key={p.id} className={`player-item${p.id === hostId ? ' host' : ''}`}>
            {p.name} {p.id === hostId && '(호스트)'}
          </div>
        ))}
      </div>
      <div className="lobby-buttons">
        <button
          className="btn btn-finish"
          disabled={roomState.players.length < 2}
          onClick={onStart}
        >
          게임 시작 ({roomState.players.length < 2 ? '2명 이상 필요' : '준비 완료'})
        </button>
        <button className="btn" onClick={onBack}>나가기</button>
      </div>
    </div>
  )
}

interface ClientWaitingProps {
  roomState: RoomState | null
  connected: boolean
  playerName: string
  onBack: () => void
}

export function ClientWaitingRoom({ roomState, connected, playerName, onBack }: ClientWaitingProps) {
  if (!connected || !roomState) {
    return (
      <div className="lobby">
        <h2>연결 중...</h2>
        <p className="lobby-status">방에 접속하고 있습니다</p>
        <button className="btn" onClick={onBack}>취소</button>
      </div>
    )
  }

  return (
    <div className="lobby">
      <h2>대기실</h2>
      <div className="room-code-display">
        <span className="room-code-label">방 코드</span>
        <span className="room-code">{roomState.roomCode}</span>
      </div>
      <div className="player-list">
        <h3>참가자 ({roomState.players.length}명)</h3>
        {roomState.players.map(p => (
          <div key={p.id} className={`player-item${p.name === playerName ? ' me' : ''}`}>
            {p.name} {p.name === playerName && '(나)'}
          </div>
        ))}
      </div>
      <p className="lobby-status">호스트가 게임을 시작할 때까지 대기 중...</p>
      <button className="btn" onClick={onBack}>나가기</button>
    </div>
  )
}
