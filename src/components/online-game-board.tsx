import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import './game-board.css'
import './online-game-board.css'
import type { Planet } from '../game/types'
import { GRID_SIZE } from '../game/types'
import { isPassthrough, getPassthroughCells } from '../game/helpers'
import { getPlanetSvgPath } from '../game/planetSvg'
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
  onSkipTurn?: (targetPlayerId: string) => void
  onKickPlayer?: (targetPlayerId: string) => void
  onLeave: () => void
}

export default function OnlineGameBoard({
  roomState, playerId, isHost, planets,
  isMyTurn, isEliminated, toast,
  onFire, onSubmitAnswer, onSkipTurn, onKickPlayer, onLeave,
}: Props) {
  const [cellSize, setCellSize] = useState(30)
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null)

  // 배치
  const [placedPlanets, setPlacedPlanets] = useState<Planet[]>([])
  const [selectedPiece, setSelectedPiece] = useState<PlanetDef | null>(null)
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')

  // 드래그
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const gridRef = useRef<HTMLDivElement>(null)
  const touchMoved = useRef(false)

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

  // 드래그 핸들러
  const isPlacing = roomState.phase === 'playing' && !isEliminated

  const getCellFromPoint = useCallback((cx: number, cy: number): [number, number] | null => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const col = Math.floor((cx - rect.left) / cellSize)
    const row = Math.floor((cy - rect.top) / cellSize)
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null
    return [row, col]
  }, [cellSize])

  const endDrag = useCallback((cx: number, cy: number) => {
    if (draggingIdx === null) return
    const cell = getCellFromPoint(cx - dragOffset.x + cellSize / 2, cy - dragOffset.y + cellSize / 2)
    if (cell) {
      const p = placedPlanets[draggingIdx]
      const def = availablePieces.find(d => d.type === p.type)!
      const o = p.orientation ?? 'horizontal'
      const w = o === 'horizontal' ? def.width : def.height
      const h = o === 'horizontal' ? def.height : def.width
      if (cell[0] + h <= GRID_SIZE && cell[1] + w <= GRID_SIZE) {
        const updated = [...placedPlanets]
        updated[draggingIdx] = { ...p, row: cell[0], col: cell[1] }
        setPlacedPlanets(updated)
      }
    }
    setDraggingIdx(null)
  }, [draggingIdx, dragOffset, placedPlanets, availablePieces, getCellFromPoint, cellSize])

  const onGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isPlacing) return
    const cell = getCellFromPoint(e.clientX, e.clientY)
    if (!cell) return
    const idx = findPlacedPlanetAt(cell[0], cell[1])
    if (idx === -1) return
    const p = placedPlanets[idx]
    setDraggingIdx(idx)
    setDragOffset({ x: (cell[1] - p.col) * cellSize, y: (cell[0] - p.row) * cellSize })
    setDragPos({ x: e.clientX, y: e.clientY })
  }, [isPlacing, getCellFromPoint, findPlacedPlanetAt, placedPlanets, cellSize])

  const onGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null) setDragPos({ x: e.clientX, y: e.clientY })
  }, [draggingIdx])

  const onGridMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null) endDrag(e.clientX, e.clientY)
  }, [draggingIdx, endDrag])

  // 터치: non-passive 리스너
  const DRAG_THRESHOLD = 8
  const touchStartPos = useRef({ x: 0, y: 0 })
  const pendingDragIdx = useRef<number | null>(null)
  const stateRef = useRef({ isPlacing, placedPlanets, draggingIdx, cellSize })
  useEffect(() => {
    stateRef.current = { isPlacing, placedPlanets, draggingIdx, cellSize }
  })

  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      if (!stateRef.current.isPlacing) return
      const t = e.touches[0]
      touchMoved.current = false
      touchStartPos.current = { x: t.clientX, y: t.clientY }
      const cell = getCellFromPoint(t.clientX, t.clientY)
      pendingDragIdx.current = cell ? findPlacedPlanetAt(cell[0], cell[1]) : null
    }

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      const dx = t.clientX - touchStartPos.current.x
      const dy = t.clientY - touchStartPos.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (!touchMoved.current && dist > DRAG_THRESHOLD && pendingDragIdx.current !== null && pendingDragIdx.current !== -1) {
        touchMoved.current = true
        const p = stateRef.current.placedPlanets[pendingDragIdx.current]
        setDraggingIdx(pendingDragIdx.current)
        const startCell = getCellFromPoint(touchStartPos.current.x, touchStartPos.current.y)
        if (startCell && p) {
          setDragOffset({
            x: (startCell[1] - p.col) * stateRef.current.cellSize,
            y: (startCell[0] - p.row) * stateRef.current.cellSize,
          })
        }
      }

      if (stateRef.current.draggingIdx !== null || touchMoved.current) {
        e.preventDefault()
        setDragPos({ x: t.clientX, y: t.clientY })
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (stateRef.current.draggingIdx !== null) {
        endDrag(t.clientX, t.clientY)
      } else if (!touchMoved.current) {
        const cell = getCellFromPoint(t.clientX, t.clientY)
        if (cell) handleCellClick(cell[0], cell[1])
      }
      pendingDragIdx.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [getCellFromPoint, findPlacedPlanetAt, endDrag, handleCellClick])

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
            <PlayerChip key={p.id} player={p} isMe={p.id === playerId}
              isTurn={p.id === roomState.currentTurnPlayerId}
              isHost={isHost} canManage={isHost && p.id !== playerId && !p.eliminated}
              onSkip={() => onSkipTurn?.(p.id)}
              onKick={() => onKickPlayer?.(p.id)} />
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
            onMouseDown={onGridMouseDown} onMouseMove={onGridMouseMove}
            onMouseUp={onGridMouseUp} onMouseLeave={onGridMouseUp}
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

          {draggingIdx !== null && (() => {
            const p = placedPlanets[draggingIdx]
            const def = availablePieces.find(d => d.type === p.type)!
            const o = p.orientation ?? 'horizontal'
            const w = (o === 'horizontal' ? def.width : def.height) * cellSize
            const h = (o === 'horizontal' ? def.height : def.width) * cellSize
            return (
              <img src={getPlanetSvgPath(p.type, o, p.edgeSide)} alt=""
                style={{ position: 'fixed', left: dragPos.x - dragOffset.x, top: dragPos.y - dragOffset.y,
                  width: w, height: h, opacity: 0.6, pointerEvents: 'none', zIndex: 100 }} />
            )
          })()}

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

function PlayerChip({ player, isMe, isTurn, canManage, onSkip, onKick }: {
  player: PlayerInfo; isMe: boolean; isTurn: boolean
  isHost: boolean; canManage: boolean
  onSkip: () => void; onKick: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  return (
    <div className={`player-chip${isTurn ? ' turn' : ''}${player.eliminated ? ' eliminated' : ''}${!player.online ? ' offline' : ''}${isMe ? ' me' : ''}`}
      onClick={() => canManage && setShowMenu(v => !v)}>
      <span className="player-chip-name">{player.name}</span>
      {!player.online && <span className="player-chip-offline">끊김</span>}
      {player.wrongAnswers > 0 && (
        <span className="player-chip-strikes">{'X'.repeat(player.wrongAnswers)}</span>
      )}
      {showMenu && canManage && (
        <div className="player-menu">
          {isTurn && <button onClick={(e) => { e.stopPropagation(); onSkip(); setShowMenu(false) }}>턴 넘기기</button>}
          <button onClick={(e) => { e.stopPropagation(); onKick(); setShowMenu(false) }}>추방</button>
        </div>
      )}
    </div>
  )
}
