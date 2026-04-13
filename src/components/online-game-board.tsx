import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import './game-board.css'
import './online-game-board.css'
import type { Planet } from '../game/types'
import { GRID_SIZE } from '../game/types'
import { isPassthrough, getPassthroughCells } from '../game/helpers'
import type { RoomState, PlayerInfo } from '../game/multiplayer-types'
import PlanetOverlay from './planet-overlay'
import { TopLabels, BottomLabels, LeftLabels, RightLabels } from './edge-labels'
import PieceTray from './piece-tray'
import ResultPanel from './result-panel'
import { PLANET_DEFS, BLACKHOLE_DEFS } from '../game/types'
import type { PlanetDef } from '../game/types'

function getAvailablePieces(mode: string): PlanetDef[] {
  return mode === 'blackhole' ? [...PLANET_DEFS, ...BLACKHOLE_DEFS] : [...PLANET_DEFS]
}

interface Props {
  roomState: RoomState
  playerId: string
  isHost: boolean
  planets?: Planet[] // 호스트만 가지고 있음
  isMyTurn: boolean
  isEliminated: boolean
  toast: string | null
  onFire: (label: string) => void
  onSubmitAnswer: (planets: Planet[]) => void
  onLeave: () => void
}

export default function OnlineGameBoard({
  roomState, playerId, isHost, planets,
  isMyTurn, isEliminated, toast,
  onFire, onSubmitAnswer, onLeave,
}: Props) {
  const [cellSize, setCellSize] = useState(30)
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null)

  // 배치
  const [placedPlanets, setPlacedPlanets] = useState<Planet[]>([])
  const [selectedPiece, setSelectedPiece] = useState<PlanetDef | null>(null)
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')

  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--cell-size').trim()
      const num = parseInt(val)
      if (num && num !== cellSize) setCellSize(num)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [cellSize])

  // 히스토리에서 파생 (useMemo)
  const activeIdx = selectedHistoryIdx ?? (roomState.history.length > 0 ? roomState.history.length - 1 : null)
  const lastResult = useMemo(() => {
    if (activeIdx === null) return null
    return roomState.history[activeIdx]?.result ?? null
  }, [roomState.history, activeIdx])

  const emptyCells = useMemo(() => {
    const cells = new Set<string>()
    for (const h of roomState.history) {
      if (
        h.result.color === 'transparent' && h.result.exitPoint &&
        h.result.exitPoint !== '소멸' && h.result.exitPoint !== '갇힘' &&
        isPassthrough(h.label, h.result.exitPoint)
      ) {
        getPassthroughCells(h.label).forEach(([r, c]) => cells.add(`${r},${c}`))
      }
    }
    return cells
  }, [roomState.history])

  const firedLabels = useMemo(() => new Set(roomState.firedLabels), [roomState.firedLabels])

  const handleFire = useCallback((label: string) => {
    if (isEliminated || !isMyTurn) return
    if (firedLabels.has(label)) {
      // 중복이면 해당 기록 선택
      const idx = roomState.history.findIndex(h => h.label === label)
      if (idx !== -1) setSelectedHistoryIdx(idx)
      return
    }
    onFire(label)
  }, [isEliminated, isMyTurn, firedLabels, roomState.history, onFire])

  // 히스토리 클릭
  const handleHistoryClick = useCallback((idx: number) => {
    if (selectedHistoryIdx === idx) {
      setSelectedHistoryIdx(null)
    } else {
      setSelectedHistoryIdx(idx)
    }
  }, [selectedHistoryIdx])

  // 배치 로직 (game-board.tsx와 동일)
  const availablePieces = getAvailablePieces(roomState.gameMode)
  const placedCounts = placedPlanets.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1; return acc
  }, {} as Record<string, number>)
  const availableCounts = availablePieces.reduce((acc, def) => {
    acc[def.type] = (acc[def.type] || 0) + 1; return acc
  }, {} as Record<string, number>)

  const findPlacedPlanetAt = useCallback((row: number, col: number): number => {
    return placedPlanets.findIndex(p => {
      const def = availablePieces.find(d => d.type === p.type)!
      const o = p.orientation ?? 'horizontal'
      const w = o === 'horizontal' ? def.width : def.height
      const h = o === 'horizontal' ? def.height : def.width
      return row >= p.row && row < p.row + h && col >= p.col && col < p.col + w
    })
  }, [placedPlanets, availablePieces])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (isEliminated || roomState.phase !== 'playing') return
    const existingIdx = findPlacedPlanetAt(row, col)
    if (existingIdx !== -1) {
      const existing = placedPlanets[existingIdx]
      const def = availablePieces.find(d => d.type === existing.type)!
      if (def.canRotate) {
        let newO = existing.orientation ?? 'horizontal'
        let newEdge = existing.edgeSide
        if (existing.type === 'large-white') {
          const cycle: { o: 'horizontal' | 'vertical'; e: 'top' | 'bottom' | 'left' | 'right' }[] = [
            { o: 'horizontal', e: 'top' }, { o: 'horizontal', e: 'bottom' },
            { o: 'vertical', e: 'left' }, { o: 'vertical', e: 'right' },
          ]
          const curIdx = cycle.findIndex(c => c.o === newO && c.e === (newEdge ?? 'top'))
          const next = cycle[(curIdx + 1) % cycle.length]
          newO = next.o; newEdge = next.e
        } else {
          newO = newO === 'horizontal' ? 'vertical' : 'horizontal'
        }
        const newW = newO === 'horizontal' ? def.width : def.height
        const newH = newO === 'horizontal' ? def.height : def.width
        let newRow = existing.row, newCol = existing.col
        if (newRow + newH > GRID_SIZE) newRow = GRID_SIZE - newH
        if (newCol + newW > GRID_SIZE) newCol = GRID_SIZE - newW
        const updated = [...placedPlanets]
        updated[existingIdx] = { ...existing, orientation: newO, edgeSide: newEdge, row: newRow, col: newCol }
        setPlacedPlanets(updated)
      }
      return
    }
    if (!selectedPiece) return
    const usedCount = placedCounts[selectedPiece.type] || 0
    const maxCount = availableCounts[selectedPiece.type] || 0
    if (usedCount >= maxCount) return
    const o = selectedPiece.canRotate ? orientation : 'horizontal'
    const w = o === 'horizontal' ? selectedPiece.width : selectedPiece.height
    const h = o === 'horizontal' ? selectedPiece.height : selectedPiece.width
    if (row + h > GRID_SIZE || col + w > GRID_SIZE) return
    const newPlanet: Planet = { type: selectedPiece.type, color: selectedPiece.color, row, col, orientation: o }
    if (selectedPiece.type === 'large-white') newPlanet.edgeSide = o === 'horizontal' ? 'top' : 'left'
    setPlacedPlanets([...placedPlanets, newPlanet])
    if (usedCount + 1 >= maxCount) setSelectedPiece(null)
  }, [isEliminated, roomState.phase, placedPlanets, selectedPiece, orientation, availablePieces, placedCounts, availableCounts, findPlacedPlanetAt])

  const allPlaced = placedPlanets.length === availablePieces.length

  // 엣지 클래스
  const activeLabel = selectedHistoryIdx !== null
    ? roomState.history[selectedHistoryIdx]?.label
    : roomState.history.length > 0 ? roomState.history[roomState.history.length - 1]?.label : null
  const lastExit = lastResult?.exitPoint
  const getEdgeClass = (label: string) => {
    const classes = ['edge-label']
    if (firedLabels.has(label)) classes.push('edge-fired')
    if (label === lastExit) classes.push('edge-exit')
    if (label === activeLabel) classes.push('edge-active')
    return classes.join(' ')
  }

  const currentTurnPlayer = roomState.players.find(p => p.id === roomState.currentTurnPlayerId)

  return (
    <div className="board-container">
      {/* 플레이어 & 턴 정보 */}
      <div className="online-header">
        <div className="room-info">
          <span className="room-code-sm">{roomState.roomCode}</span>
          <span className="turn-info">
            {roomState.phase === 'finished'
              ? (roomState.winnerId
                ? `${roomState.players.find(p => p.id === roomState.winnerId)?.name} 승리!`
                : '전원 탈락')
              : isMyTurn
                ? '내 차례!'
                : `${currentTurnPlayer?.name ?? '?'}의 차례`}
          </span>
        </div>
        <div className="player-chips">
          {roomState.players.map(p => (
            <PlayerChip key={p.id} player={p} isMe={p.id === playerId} isTurn={p.id === roomState.currentTurnPlayerId} />
          ))}
        </div>
      </div>

      {/* 배치 트레이 (항상 표시) */}
      {roomState.phase === 'playing' && !isEliminated && (
        <PieceTray
          availableCounts={availableCounts} placedCounts={placedCounts}
          availablePieces={availablePieces} selectedPiece={selectedPiece}
          orientation={orientation} onSelectPiece={setSelectedPiece}
          onRemovePlaced={(type) => {
            const idx = placedPlanets.findLastIndex(p => p.type === type)
            if (idx !== -1) setPlacedPlanets(placedPlanets.filter((_, i) => i !== idx))
          }}
          onToggleOrientation={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
        />
      )}

      {/* 보드 */}
      <div className="board-wrapper">
        <TopLabels onFire={handleFire} getEdgeClass={getEdgeClass} />
        <div className="board-middle">
          <LeftLabels onFire={handleFire} getEdgeClass={getEdgeClass} />
          <div ref={gridRef} className="grid"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
              const row = Math.floor(i / GRID_SIZE), col = i % GRID_SIZE
              const isEmpty = emptyCells.has(`${row},${col}`)
              const classes = ['cell']
              if (isEmpty) classes.push('cell-empty')
              classes.push('cell-placeable')
              return (
                <div key={`${row}-${col}`} className={classes.join(' ')}
                  onClick={() => handleCellClick(row, col)} />
              )
            })}
            {/* 호스트만 행성 보임 (게임 종료 시) */}
            {isHost && planets && roomState.phase === 'finished' && (
              <PlanetOverlay planets={planets} visible cellSize={cellSize} />
            )}
            {placedPlanets.length > 0 && <PlanetOverlay planets={placedPlanets} visible cellSize={cellSize} />}
          </div>
          <RightLabels onFire={handleFire} getEdgeClass={getEdgeClass} />
        </div>
        <BottomLabels onFire={handleFire} getEdgeClass={getEdgeClass} />
      </div>

      {/* 결과 */}
      <div className="result-panel">
        <ResultPanel
          lastResult={lastResult}
          history={roomState.history.map(h => ({ label: h.label, result: h.result }))}
          selectedHistoryIdx={selectedHistoryIdx}
          placingMode={false}
          onHistoryClick={handleHistoryClick}
        />

        <div className="controls">
          {roomState.phase === 'playing' && !isEliminated && (
            <>
              <button className="btn btn-finish" disabled={!allPlaced}
                onClick={() => { onSubmitAnswer(placedPlanets); setPlacedPlanets([]); setSelectedPiece(null) }}>
                정답 확인
              </button>
              {placedPlanets.length > 0 && (
                <button className="btn" onClick={() => { setPlacedPlanets([]); setSelectedPiece(null) }}>초기화</button>
              )}
            </>
          )}
          {isEliminated && <div className="eliminated-badge">탈락 (관전 중)</div>}
          <button className="btn btn-back" onClick={onLeave}>나가기</button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function PlayerChip({ player, isMe, isTurn }: { player: PlayerInfo; isMe: boolean; isTurn: boolean }) {
  return (
    <div className={`player-chip${isTurn ? ' turn' : ''}${player.eliminated ? ' eliminated' : ''}${isMe ? ' me' : ''}`}>
      <span className="player-chip-name">{player.name}</span>
      {player.wrongAnswers > 0 && (
        <span className="player-chip-strikes">{'X'.repeat(player.wrongAnswers)}</span>
      )}
    </div>
  )
}
