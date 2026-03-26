import { useState, useCallback, useEffect, useRef } from 'react'
import './game-board.css'
import type { Planet } from '../game/types'
import { GRID_SIZE } from '../game/types'
import type { DifficultyLevel } from '../game/difficulty'
import { getPlanetSvgPath } from '../game/planetSvg'
import { LASER_COLOR_MAP } from '../game/constants'
import { useGame } from '../hooks/use-game'
import PlanetOverlay from './planet-overlay'
import { TopLabels, BottomLabels, LeftLabels, RightLabels } from './edge-labels'
import PieceTray from './piece-tray'
import ResultPanel from './result-panel'
import { ConfirmNewGameModal, ConfirmRevealModal, FinishForm } from './game-modals'

export default function GameBoard() {
  const game = useGame()
  const [cellSize, setCellSize] = useState(30)

  // 드래그 상태
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

  // 배치 셀 클릭
  const findPlacedPlanetAt = useCallback((row: number, col: number): number => {
    return game.placedPlanets.findIndex((p) => {
      const def = game.availablePieces.find((d) => d.type === p.type)!
      const o = p.orientation ?? 'horizontal'
      const w = o === 'horizontal' ? def.width : def.height
      const h = o === 'horizontal' ? def.height : def.width
      return row >= p.row && row < p.row + h && col >= p.col && col < p.col + w
    })
  }, [game.placedPlanets, game.availablePieces])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!game.isPlacing) return
    const existingIdx = findPlacedPlanetAt(row, col)
    if (existingIdx !== -1) {
      const existing = game.placedPlanets[existingIdx]
      const def = game.availablePieces.find((d) => d.type === existing.type)!
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
        const updated = [...game.placedPlanets]
        updated[existingIdx] = { ...existing, orientation: newO, edgeSide: newEdge, row: newRow, col: newCol }
        game.setPlacedPlanets(updated)
      }
      // 회전 불가 행성은 그리드에서 탭해도 아무 동작 없음 (트레이에서 제거)
      return
    }
    if (!game.selectedPiece) return
    const usedCount = game.placedCounts[game.selectedPiece.type] || 0
    const maxCount = game.availableCounts[game.selectedPiece.type] || 0
    if (usedCount >= maxCount) return
    const o = game.selectedPiece.canRotate ? game.orientation : 'horizontal'
    const w = o === 'horizontal' ? game.selectedPiece.width : game.selectedPiece.height
    const h = o === 'horizontal' ? game.selectedPiece.height : game.selectedPiece.width
    if (row + h > GRID_SIZE || col + w > GRID_SIZE) return
    const newPlanet: Planet = { type: game.selectedPiece.type, color: game.selectedPiece.color, row, col, orientation: o }
    if (game.selectedPiece.type === 'large-white') newPlanet.edgeSide = o === 'horizontal' ? 'top' : 'left'
    game.setPlacedPlanets([...game.placedPlanets, newPlanet])
    if (usedCount + 1 >= maxCount) game.setSelectedPiece(null)
  }, [game, findPlacedPlanetAt])

  // 드래그 핸들러
  const getCellFromPoint = useCallback((cx: number, cy: number): [number, number] | null => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const col = Math.floor((cx - rect.left) / cellSize)
    const row = Math.floor((cy - rect.top) / cellSize)
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null
    return [row, col]
  }, [cellSize])

  const startDrag = useCallback((cx: number, cy: number) => {
    if (!game.isPlacing) return
    const cell = getCellFromPoint(cx, cy)
    if (!cell) return
    const idx = findPlacedPlanetAt(cell[0], cell[1])
    if (idx === -1) return
    const p = game.placedPlanets[idx]
    setDraggingIdx(idx)
    setDragOffset({ x: (cell[1] - p.col) * cellSize, y: (cell[0] - p.row) * cellSize })
    setDragPos({ x: cx, y: cy })
  }, [game.isPlacing, getCellFromPoint, findPlacedPlanetAt, game.placedPlanets, cellSize])

  const endDrag = useCallback((cx: number, cy: number) => {
    if (draggingIdx === null) return
    const cell = getCellFromPoint(cx - dragOffset.x + cellSize / 2, cy - dragOffset.y + cellSize / 2)
    if (cell) {
      const p = game.placedPlanets[draggingIdx]
      const def = game.availablePieces.find(d => d.type === p.type)!
      const o = p.orientation ?? 'horizontal'
      const w = o === 'horizontal' ? def.width : def.height
      const h = o === 'horizontal' ? def.height : def.width
      if (cell[0] + h <= GRID_SIZE && cell[1] + w <= GRID_SIZE) {
        const updated = [...game.placedPlanets]
        updated[draggingIdx] = { ...p, row: cell[0], col: cell[1] }
        game.setPlacedPlanets(updated)
      }
    }
    setDraggingIdx(null)
  }, [draggingIdx, dragOffset, game, getCellFromPoint, cellSize])

  const onGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (game.isPlacing) startDrag(e.clientX, e.clientY)
  }, [game.isPlacing, startDrag])
  const onGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null) setDragPos({ x: e.clientX, y: e.clientY })
  }, [draggingIdx])
  const onGridMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null) endDrag(e.clientX, e.clientY)
  }, [draggingIdx, endDrag])
  // 터치: 롱프레스 대신 이동 거리로 드래그/탭 구분
  const DRAG_THRESHOLD = 8
  const touchStartPos = useRef({ x: 0, y: 0 })
  const pendingDragIdx = useRef<number | null>(null)

  const onGridTouchStart = useCallback((e: React.TouchEvent) => {
    if (!game.isPlacing) return
    const t = e.touches[0]
    touchMoved.current = false
    touchStartPos.current = { x: t.clientX, y: t.clientY }
    // 배치된 행성 위에 터치했는지 미리 확인
    const cell = getCellFromPoint(t.clientX, t.clientY)
    if (cell) {
      pendingDragIdx.current = findPlacedPlanetAt(cell[0], cell[1])
    } else {
      pendingDragIdx.current = null
    }
  }, [game.isPlacing, getCellFromPoint, findPlacedPlanetAt])

  const onGridTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    const dx = t.clientX - touchStartPos.current.x
    const dy = t.clientY - touchStartPos.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (!touchMoved.current && dist > DRAG_THRESHOLD && pendingDragIdx.current !== null && pendingDragIdx.current !== -1) {
      // 드래그 시작
      touchMoved.current = true
      const p = game.placedPlanets[pendingDragIdx.current]
      setDraggingIdx(pendingDragIdx.current)
      const startCell = getCellFromPoint(touchStartPos.current.x, touchStartPos.current.y)
      if (startCell && p) {
        setDragOffset({ x: (startCell[1] - p.col) * cellSize, y: (startCell[0] - p.row) * cellSize })
      }
    }

    if (draggingIdx !== null || touchMoved.current) {
      e.preventDefault()
      setDragPos({ x: t.clientX, y: t.clientY })
    }
  }, [game.placedPlanets, getCellFromPoint, cellSize, draggingIdx])

  const onGridTouchEnd = useCallback((e: React.TouchEvent) => {
    const t = e.changedTouches[0]
    if (draggingIdx !== null) {
      endDrag(t.clientX, t.clientY)
    } else if (!touchMoved.current) {
      // 이동 없었으면 탭으로 처리
      const cell = getCellFromPoint(t.clientX, t.clientY)
      if (cell) handleCellClick(cell[0], cell[1])
    }
    pendingDragIdx.current = null
  }, [draggingIdx, endDrag, getCellFromPoint, handleCellClick])

  return (
    <div className="board-container">
      <div className="top-bar">
        <div className="mode-toggle" onClick={game.handleToggleMode}>
          <div className={`toggle-option${game.gameMode === 'basic' ? ' active' : ''}`}>기본</div>
          <div className={`toggle-option${game.gameMode === 'blackhole' ? ' active' : ''}`}>블랙홀</div>
        </div>
        <div className="mode-toggle diff-toggle">
          {(['any', 'easy', 'normal', 'hard'] as const).map(d => (
            <div key={d}
              className={`toggle-option${d !== 'any' ? ` diff-${d}-opt` : ''}${game.targetDifficulty === d ? ' active' : ''}`}
              onClick={() => game.setTargetDifficulty(d as DifficultyLevel | 'any')}>
              {{ any: '전체', easy: '쉬움', normal: '보통', hard: '어려움' }[d]}
            </div>
          ))}
        </div>
        {game.difficulty && <span className={`difficulty-badge diff-${game.difficulty.level}`}>{game.difficulty.score}</span>}
        <button className="btn btn-new-sm" onClick={game.handleNewGameRequest}>새 게임</button>
      </div>

      {game.showRevealConfirm && (
        <ConfirmRevealModal
          onCancel={() => game.setShowRevealConfirm(false)}
          onConfirm={() => { game.setShowPlanets(true); game.setShowRevealConfirm(false) }}
        />
      )}
      {game.showConfirmNew && (
        <ConfirmNewGameModal
          onCancel={() => { game.setShowConfirmNew(false); game.setPendingMode(null) }}
          onConfirm={() => game.startNewGame(game.pendingMode ?? game.gameMode)}
        />
      )}

      {game.isPlacing && (
        <PieceTray
          availableCounts={game.availableCounts} placedCounts={game.placedCounts}
          availablePieces={game.availablePieces} selectedPiece={game.selectedPiece}
          orientation={game.orientation} onSelectPiece={game.setSelectedPiece}
          onRemovePlaced={(type) => {
            const idx = game.placedPlanets.findLastIndex(p => p.type === type)
            if (idx !== -1) game.setPlacedPlanets(game.placedPlanets.filter((_, i) => i !== idx))
          }}
          onToggleOrientation={() => game.setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
        />
      )}

      <div className="board-wrapper">
        <TopLabels onFire={game.handleFire} getEdgeClass={game.getEdgeClass} />
        <div className="board-middle">
          <LeftLabels onFire={game.handleFire} getEdgeClass={game.getEdgeClass} />
          <div ref={gridRef} className="grid"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
              ...(game.isPlacing ? { touchAction: 'none' } : {}),
            }}
            onMouseDown={onGridMouseDown} onMouseMove={onGridMouseMove}
            onMouseUp={onGridMouseUp} onMouseLeave={onGridMouseUp}
            onTouchStart={onGridTouchStart} onTouchMove={onGridTouchMove} onTouchEnd={onGridTouchEnd}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
              const row = Math.floor(i / GRID_SIZE), col = i % GRID_SIZE
              const isLaserPath = game.showPlanets && game.laserPath.has(`${row},${col}`)
              const isEmpty = game.emptyCells.has(`${row},${col}`)
              const classes = ['cell']
              if (isLaserPath) classes.push('laser-path')
              if (isEmpty && !game.showPlanets) classes.push('cell-empty')
              if (game.isPlacing) classes.push('cell-placeable')
              return (
                <div key={`${row}-${col}`} className={classes.join(' ')}
                  style={isLaserPath && game.lastResult ? { backgroundColor: LASER_COLOR_MAP[game.lastResult.color] + '33' } : undefined}
                  onClick={() => game.isPlacing && handleCellClick(row, col)} />
              )
            })}
            <PlanetOverlay planets={game.planets} visible={game.showPlanets} cellSize={cellSize} />
            {game.isPlacing && (
              <div style={game.showPlanets ? { opacity: 0.35 } : undefined}>
                <PlanetOverlay planets={game.placedPlanets} visible cellSize={cellSize} />
              </div>
            )}
          </div>

          {draggingIdx !== null && (() => {
            const p = game.placedPlanets[draggingIdx]
            const def = game.availablePieces.find(d => d.type === p.type)!
            const o = p.orientation ?? 'horizontal'
            const w = (o === 'horizontal' ? def.width : def.height) * cellSize
            const h = (o === 'horizontal' ? def.height : def.width) * cellSize
            return (
              <img src={getPlanetSvgPath(p.type, o, p.edgeSide)} alt=""
                style={{ position: 'fixed', left: dragPos.x - dragOffset.x, top: dragPos.y - dragOffset.y,
                  width: w, height: h, opacity: 0.6, pointerEvents: 'none', zIndex: 100 }} />
            )
          })()}

          <RightLabels onFire={game.handleFire} getEdgeClass={game.getEdgeClass} />
        </div>
        <BottomLabels onFire={game.handleFire} getEdgeClass={game.getEdgeClass} />
      </div>

      <div className="result-panel">
        <ResultPanel lastResult={game.lastResult} history={game.history}
          selectedHistoryIdx={game.selectedHistoryIdx} placingMode={game.placingMode}
          onHistoryClick={game.handleHistoryClick} />

        {game.showFinishForm && (
          <FinishForm type={game.showFinishForm} shotCount={game.history.length}
            winnerName={game.winnerName} onNameChange={game.setWinnerName}
            onCancel={() => game.setShowFinishForm(null)} onConfirm={game.handleConfirmFinish} />
        )}

        {game.gameFinished && (
          <div className="game-finished">게임 완료! 기록이 저장되었습니다. ({game.history.length}회 발사)</div>
        )}

        <div className="controls">
          <div className="mode-toggle" onClick={() => game.setPlayMode(m => m === 'solo' ? 'multi' : 'solo')}>
            <div className={`toggle-option${game.playMode === 'solo' ? ' active' : ''}`}>솔로</div>
            <div className={`toggle-option${game.playMode === 'multi' ? ' active' : ''}`}>멀티</div>
          </div>

          {!game.gameFinished && !game.showFinishForm && !game.isSolo && !game.placingMode && (
            <>
              <div className="mode-toggle" onClick={() => game.setShowPlanets(v => !v)}>
                <div className={`toggle-option${!game.showPlanets ? ' active' : ''}`}>숨김</div>
                <div className={`toggle-option${game.showPlanets ? ' active' : ''}`}>보기</div>
              </div>
              <button className="btn btn-finish" disabled={game.history.length === 0}
                onClick={() => { game.setPlacingMode(true); game.setPlacedPlanets([]); game.setSelectedPiece(null) }}>제출</button>
              <button className="btn btn-fail" disabled={game.history.length === 0}
                onClick={() => game.setShowFinishForm('fail')}>포기</button>
            </>
          )}

          {!game.gameFinished && !game.showFinishForm && game.isSolo && (
            <>
              <button className="btn" onClick={() => {
                if (!game.showPlanets) { game.setShowRevealConfirm(true) } else { game.setShowPlanets(false) }
              }}>
                {game.showPlanets ? '숨기기' : '정답 보기'}
              </button>
              <button className="btn btn-finish" onClick={game.handleSubmitAnswer} disabled={!game.allPlaced}>정답 확인</button>
              <button className="btn btn-fail" disabled={game.history.length === 0}
                onClick={() => game.setShowFinishForm('fail')}>포기</button>
            </>
          )}

          {!game.isSolo && game.placingMode && (
            <>
              <button className="btn" onClick={() => game.setPlacingMode(false)}>돌아가기</button>
              <button className="btn btn-finish" onClick={game.handleSubmitAnswer} disabled={!game.allPlaced}>정답 확인</button>
            </>
          )}
        </div>
      </div>

      {game.toast && <div className="toast">{game.toast}</div>}
    </div>
  )
}
