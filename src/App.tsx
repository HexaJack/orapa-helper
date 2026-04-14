import { useState, useCallback, useEffect } from 'react'
import './App.css'
import GameBoard from './components/game-board'
import ColorTable from './components/color-table'
import OnlineLobby, { HostWaitingRoom, ClientWaitingRoom } from './components/online-lobby'
import OnlineGameBoard from './components/online-game-board'
import { useOnlineHost } from './hooks/use-online-host'
import { useOnlineClient } from './hooks/use-online-client'
import { saveSession, loadSession, clearSession } from './game/session'

type AppMode = 'local' | 'online-menu' | 'host-lobby' | 'host-game' | 'client-lobby' | 'client-game'

function App() {
  const [appMode, setAppMode] = useState<AppMode>(() => {
    const session = loadSession()
    if (!session) return 'local'
    return session.role === 'host' ? 'host-game' : 'client-game'
  })
  const [onlineConfig, setOnlineConfig] = useState(() => {
    const session = loadSession()
    return {
      roomCode: session?.roomCode ?? '',
      playerName: session?.playerName ?? '',
    }
  })

  const handleGameStart = useCallback((mode: 'host' | 'client', roomCode: string, playerName: string) => {
    setOnlineConfig({ roomCode, playerName })
    const newMode: AppMode = mode === 'host' ? 'host-lobby' : 'client-lobby'
    setAppMode(newMode)
    saveSession({ role: mode, roomCode, playerName })
  }, [])

  const handleBack = useCallback(() => {
    setAppMode('local')
    setOnlineConfig({ roomCode: '', playerName: '' })
    clearSession()
  }, [])

  if (appMode === 'local') {
    return (
      <div className="app">
        <h1>Orapa Space</h1>
        <button className="btn btn-online" onClick={() => setAppMode('online-menu')}>
          온라인 플레이
        </button>
        <div className="app-layout">
          <GameBoard />
          <ColorTable />
        </div>
      </div>
    )
  }

  if (appMode === 'online-menu') {
    return (
      <div className="app">
        <h1>Orapa Space</h1>
        <OnlineLobby onBack={handleBack} onGameStart={handleGameStart} />
      </div>
    )
  }

  if (appMode === 'host-lobby' || appMode === 'host-game') {
    return <HostSession
      playerName={onlineConfig.playerName}
      appMode={appMode}
      setAppMode={setAppMode}
      onBack={handleBack}
    />
  }

  if (appMode === 'client-lobby' || appMode === 'client-game') {
    return <ClientSession
      roomCode={onlineConfig.roomCode}
      playerName={onlineConfig.playerName}
      appMode={appMode}
      setAppMode={setAppMode}
      onBack={handleBack}
    />
  }

  return null
}

function HostSession({ playerName, appMode, setAppMode, onBack }: {
  playerName: string
  appMode: AppMode
  setAppMode: (m: AppMode) => void
  onBack: () => void
}) {
  const host = useOnlineHost(playerName, 'basic', 'any')

  // 세션에 roomCode 저장 (호스트는 코드가 동적 생성됨)
  useEffect(() => {
    if (host.roomCode) {
      saveSession({ role: 'host', roomCode: host.roomCode, playerName })
    }
  }, [host.roomCode, playerName])

  const handleStart = useCallback(() => {
    host.startGame()
    setAppMode('host-game')
  }, [host, setAppMode])

  if (appMode === 'host-lobby') {
    return (
      <div className="app">
        <h1>Orapa Space</h1>
        <HostWaitingRoom
          roomState={host.roomState}
          hostId={host.hostId}
          onStart={handleStart}
          onBack={onBack}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <OnlineGameBoard
        roomState={host.roomState}
        playerId={host.hostId}
        isHost
        planets={host.planets}
        isMyTurn={host.roomState.currentTurnPlayerId === host.hostId}
        isEliminated={host.roomState.players.find(p => p.id === host.hostId)?.eliminated ?? false}
        toast={null}
        onFire={host.hostFire}
        onSubmitAnswer={host.hostSubmitAnswer}
        onSkipTurn={host.skipTurn}
        onKickPlayer={host.kickPlayer}
        onLeave={onBack}
      />
    </div>
  )
}

function ClientSession({ roomCode, playerName, appMode, setAppMode, onBack }: {
  roomCode: string
  playerName: string
  appMode: AppMode
  setAppMode: (m: AppMode) => void
  onBack: () => void
}) {
  const client = useOnlineClient(roomCode, playerName)

  // 게임 시작 감지
  useEffect(() => {
    if (appMode === 'client-lobby' && client.roomState?.phase === 'playing') {
      setAppMode('client-game')
    }
  }, [appMode, client.roomState?.phase, setAppMode])

  if (appMode === 'client-lobby') {
    return (
      <div className="app">
        <h1>Orapa Space</h1>
        <ClientWaitingRoom
          roomState={client.roomState}
          connected={client.connected}
          playerName={playerName}
          onBack={onBack}
        />
      </div>
    )
  }

  if (!client.roomState) {
    return <div className="app"><h1>연결 중...</h1></div>
  }

  return (
    <div className="app">
      <OnlineGameBoard
        roomState={client.roomState}
        playerId={client.playerId}
        isHost={false}
        isMyTurn={client.isMyTurn}
        isEliminated={client.isEliminated}
        toast={client.toast}
        onFire={client.requestFire}
        onSubmitAnswer={client.submitAnswer}
        onLeave={onBack}
      />
    </div>
  )
}

export default App
