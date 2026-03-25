import { useState, useCallback, useRef, useEffect } from 'react'
import './Board.css'
import type { GameMode, Planet, PlanetType, PlanetDef } from '../game/types'
import { GRID_SIZE, PLANET_DEFS, BLACKHOLE_DEFS } from '../game/types'
import { generateRandomBoard } from '../game/board'
import type { LaserResult, LaserColor } from '../game/laser'
import { fireLaser } from '../game/laser'
import { saveGameRecord, generateId } from '../game/storage'
import { isPassthrough, getPassthroughCells } from '../game/helpers'
import type { DifficultyResult, DifficultyLevel } from '../game/difficulty'
import { analyzeDifficulty, generateBoardWithDifficulty } from '../game/difficulty'
import PlanetOverlay from './PlanetOverlay'

const TOP_LABELS = Array.from({ length: GRID_SIZE }, (_, i) => String(i + 1))
const RIGHT_LABELS = Array.from({ length: GRID_SIZE }, (_, i) => String(i + 10))
const LEFT_LABELS = Array.from({ length: GRID_SIZE }, (_, i) =>
  String.fromCharCode(65 + i)
)
const BOTTOM_LABELS = Array.from({ length: GRID_SIZE }, (_, i) =>
  String.fromCharCode(74 + i)
)

const LASER_COLOR_MAP: Record<LaserColor, string> = {
  'transparent': '#ffffff', 'white': '#ffffff', 'red': '#e94560',
  'blue': '#3b82f6', 'yellow': '#eab308', 'orange': '#f97316',
  'purple': '#a855f7', 'green': '#22c55e', 'pink': '#f9a8d4',
  'lemon': '#fef08a', 'skyblue': '#7dd3fc', 'light-orange': '#fdba74',
  'light-purple': '#d8b4fe', 'light-green': '#bbf7d0',
  'black': '#1f2937', 'gray': '#9ca3af',
}

const LASER_COLOR_NAME_KR: Record<LaserColor, string> = {
  'transparent': '투명', 'white': '흰색', 'red': '빨간색',
  'blue': '파란색', 'yellow': '노란색', 'orange': '주황색',
  'purple': '보라색', 'green': '초록색', 'pink': '핑크색',
  'lemon': '레몬색', 'skyblue': '하늘색', 'light-orange': '연주황색',
  'light-purple': '연보라색', 'light-green': '연초록색',
  'black': '검정색', 'gray': '회색',
}

const PIECE_COLORS: Record<PlanetType, string> = {
  'large-white': '#e8e8e8', 'small-red': '#e94560', 'large-red': '#e94560',
  'large-blue': '#3b82f6', 'yellow': '#eab308', 'white-ring': '#d4d4d4',
  'blackhole': '#333',
}
const PIECE_NAMES: Record<PlanetType, string> = {
  'large-white': '대형 흰색', 'small-red': '소형 빨강', 'large-red': '대형 빨강',
  'large-blue': '대형 파랑', 'yellow': '노랑', 'white-ring': '토성',
  'blackhole': '블랙홀',
}

function getAvailablePieces(mode: GameMode): PlanetDef[] {
  return mode === 'blackhole' ? [...PLANET_DEFS, ...BLACKHOLE_DEFS] : [...PLANET_DEFS]
}

export default function Board() {
  // 게임 상태
  const [gameMode, setGameMode] = useState<GameMode>('basic')
  const [targetDifficulty, setTargetDifficulty] = useState<DifficultyLevel | 'any'>('any')
  const [planets, setPlanets] = useState(() => generateRandomBoard('basic'))
  const [difficulty, setDifficulty] = useState<DifficultyResult | null>(null)
  const [showPlanets, setShowPlanets] = useState(false)
  const [lastResult, setLastResult] = useState<LaserResult | null>(null)
  const [laserPath, setLaserPath] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<{ label: string; result: LaserResult }[]>([])
  const [gameFinished, setGameFinished] = useState(false)
  const [firedLabels, setFiredLabels] = useState<Set<string>>(new Set())
  const [emptyCells, setEmptyCells] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [cellSize, setCellSize] = useState(30)

  // 난이도 계산
  useEffect(() => {
    setDifficulty(analyzeDifficulty(planets))
  }, [planets])

  // CSS 변수에서 셀 크기 읽기
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

  // 배치 모드 상태
  const [placingMode, setPlacingMode] = useState(false)
  const [placedPlanets, setPlacedPlanets] = useState<Planet[]>([])
  const [selectedPiece, setSelectedPiece] = useState<PlanetDef | null>(null)
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')

  // UI 상태
  const [winnerName, setWinnerName] = useState('')
  const [showFinishForm, setShowFinishForm] = useState<'success' | 'fail' | null>(null)
  const [showConfirmNew, setShowConfirmNew] = useState(false)
  const [pendingMode, setPendingMode] = useState<GameMode | null>(null)

  const historyListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (historyListRef.current) {
      historyListRef.current.scrollTop = historyListRef.current.scrollHeight
    }
  }, [history.length])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }, [])

  // 레이저 발사
  const handleFire = useCallback(
    (label: string) => {
      if (gameFinished || placingMode) return
      if (firedLabels.has(label)) {
        showToast(`${label}은(는) 이미 발사한 지점입니다`)
        return
      }
      const result = fireLaser(label, planets)
      setLastResult(result)
      setFiredLabels(new Set(firedLabels).add(label))
      setLaserPath(new Set(result.path.map((s) => `${s.row},${s.col}`)))
      setHistory([...history, { label, result }])
      setSelectedHistoryIdx(null)

      // 관통 판별 → 빈 칸 마킹
      if (
        result.color === 'transparent' &&
        result.exitPoint &&
        result.exitPoint !== '소멸' &&
        result.exitPoint !== '갇힘' &&
        isPassthrough(label, result.exitPoint)
      ) {
        const cells = getPassthroughCells(label)
        setEmptyCells((prev) => {
          const next = new Set(prev)
          cells.forEach(([r, c]) => next.add(`${r},${c}`))
          return next
        })
      }
    },
    [planets, gameFinished, placingMode, firedLabels, history, showToast]
  )

  // 새 게임
  const startNewGame = useCallback((mode: GameMode) => {
    setGameMode(mode)
    const { planets: newPlanets, difficulty: newDiff } = generateBoardWithDifficulty(mode, targetDifficulty)
    setPlanets(newPlanets)
    setDifficulty(newDiff)
    setLastResult(null)
    setLaserPath(new Set())
    setHistory([])
    setGameFinished(false)
    setShowPlanets(false)
    setFiredLabels(new Set())
    setEmptyCells(new Set())
    setWinnerName('')
    setShowFinishForm(null)
    setShowConfirmNew(false)
    setPlacingMode(false)
    setPlacedPlanets([])
    setSelectedPiece(null)
  }, [targetDifficulty])

  const handleNewGameRequest = useCallback(() => {
    if (history.length > 0 && !gameFinished) {
      setPendingMode(gameMode)
      setShowConfirmNew(true)
    } else {
      startNewGame(gameMode)
    }
  }, [history.length, gameFinished, gameMode, startNewGame])

  const handleToggleMode = useCallback(() => {
    const newMode = gameMode === 'basic' ? 'blackhole' : 'basic'
    if (history.length > 0 && !gameFinished) {
      setPendingMode(newMode)
      setShowConfirmNew(true)
    } else {
      startNewGame(newMode)
    }
  }, [gameMode, history.length, gameFinished, startNewGame])

  // 제출 (배치 모드 진입)
  const enterPlacingMode = useCallback(() => {
    setPlacingMode(true)
    setPlacedPlanets([])
    setSelectedPiece(null)
  }, [])

  // 배치 모드에서 셀 클릭
  const availablePieces = getAvailablePieces(gameMode)
  const placedCounts = placedPlanets.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const availableCounts = availablePieces.reduce((acc, def) => {
    acc[def.type] = (acc[def.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const findPlacedPlanetAt = useCallback((row: number, col: number): number => {
    return placedPlanets.findIndex((p) => {
      const def = availablePieces.find((d) => d.type === p.type)!
      const o = p.orientation ?? 'horizontal'
      const w = o === 'horizontal' ? def.width : def.height
      const h = o === 'horizontal' ? def.height : def.width
      return row >= p.row && row < p.row + h && col >= p.col && col < p.col + w
    })
  }, [placedPlanets, availablePieces])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!placingMode) return

    // 이미 배치된 행성 클릭 → 회전 or 제거
    const existingIdx = findPlacedPlanetAt(row, col)
    if (existingIdx !== -1) {
      const existing = placedPlanets[existingIdx]
      const def = availablePieces.find((d) => d.type === existing.type)!
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
          newO = next.o
          newEdge = next.e
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
      } else {
        setPlacedPlanets(placedPlanets.filter((_, i) => i !== existingIdx))
      }
      return
    }

    // 새 조각 배치
    if (!selectedPiece) return
    const usedCount = placedCounts[selectedPiece.type] || 0
    const maxCount = availableCounts[selectedPiece.type] || 0
    if (usedCount >= maxCount) return

    const o = selectedPiece.canRotate ? orientation : 'horizontal'
    const w = o === 'horizontal' ? selectedPiece.width : selectedPiece.height
    const h = o === 'horizontal' ? selectedPiece.height : selectedPiece.width
    if (row + h > GRID_SIZE || col + w > GRID_SIZE) return

    const newPlanet: Planet = {
      type: selectedPiece.type, color: selectedPiece.color,
      row, col, orientation: o,
    }
    if (selectedPiece.type === 'large-white') {
      newPlanet.edgeSide = o === 'horizontal' ? 'top' : 'left'
    }
    setPlacedPlanets([...placedPlanets, newPlanet])
    if (usedCount + 1 >= maxCount) setSelectedPiece(null)
  }, [placingMode, placedPlanets, selectedPiece, orientation,
    availablePieces, placedCounts, availableCounts, findPlacedPlanetAt])

  // 드래그 상태
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const gridRef = useRef<HTMLDivElement>(null)
  const touchTimer = useRef<number | null>(null)
  const touchMoved = useRef(false)
  const CELL_SIZE = cellSize

  const getCellFromPoint = useCallback((cx: number, cy: number): [number, number] | null => {
    if (!gridRef.current) return null
    const rect = gridRef.current.getBoundingClientRect()
    const col = Math.floor((cx - rect.left) / CELL_SIZE)
    const row = Math.floor((cy - rect.top) / CELL_SIZE)
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null
    return [row, col]
  }, [])

  const startDrag = useCallback((cx: number, cy: number) => {
    if (!placingMode) return
    const cell = getCellFromPoint(cx, cy)
    if (!cell) return
    const idx = findPlacedPlanetAt(cell[0], cell[1])
    if (idx === -1) return
    const p = placedPlanets[idx]
    setDraggingIdx(idx)
    setDragOffset({
      x: (cell[1] - p.col) * CELL_SIZE,
      y: (cell[0] - p.row) * CELL_SIZE,
    })
    setDragPos({ x: cx, y: cy })
  }, [placingMode, getCellFromPoint, findPlacedPlanetAt, placedPlanets])

  const endDrag = useCallback((cx: number, cy: number) => {
    if (draggingIdx === null) return
    const cell = getCellFromPoint(
      cx - dragOffset.x + CELL_SIZE / 2,
      cy - dragOffset.y + CELL_SIZE / 2
    )
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
  }, [draggingIdx, dragOffset, placedPlanets, availablePieces, getCellFromPoint])

  const onGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!placingMode) return
    startDrag(e.clientX, e.clientY)
  }, [placingMode, startDrag])
  const onGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null) setDragPos({ x: e.clientX, y: e.clientY })
  }, [draggingIdx])
  const onGridMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null) endDrag(e.clientX, e.clientY)
  }, [draggingIdx, endDrag])

  const onGridTouchStart = useCallback((e: React.TouchEvent) => {
    if (!placingMode) return
    touchMoved.current = false
    const t = e.touches[0]
    touchTimer.current = window.setTimeout(() => {
      startDrag(t.clientX, t.clientY)
    }, 200)
  }, [placingMode, startDrag])
  const onGridTouchMove = useCallback((e: React.TouchEvent) => {
    touchMoved.current = true
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null }
    if (draggingIdx !== null) {
      e.preventDefault()
      setDragPos({ x: e.touches[0].clientX, y: e.touches[0].clientY })
    }
  }, [draggingIdx])
  const onGridTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null }
    if (draggingIdx !== null) {
      endDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
    } else if (!touchMoved.current) {
      const t = e.changedTouches[0]
      const cell = getCellFromPoint(t.clientX, t.clientY)
      if (cell) handleCellClick(cell[0], cell[1])
    }
  }, [draggingIdx, endDrag, getCellFromPoint, handleCellClick])

  // 정답 확인
  const handleSubmitAnswer = useCallback(() => {
    const isCorrect = comparePlacements(placedPlanets, planets)
    if (isCorrect) {
      setShowFinishForm('success')
      setPlacingMode(false)
      setShowPlanets(true)
    } else {
      // 틀리면 토스트만 띄우고 배치 모드 유지
      showToast('틀렸습니다! 다시 시도하세요.')
      setPlacedPlanets([])
      setSelectedPiece(null)
    }
  }, [placedPlanets, planets, showToast])

  // 기록 저장
  const handleConfirmFinish = useCallback(() => {
    const solved = showFinishForm === 'success'
    saveGameRecord({
      id: generateId(),
      date: new Date().toISOString(),
      mode: gameMode, winner: winnerName.trim() || (solved ? '승리자' : ''),
      planets, history, totalShots: history.length, solved,
    })
    setGameFinished(true)
    setShowPlanets(true)
    setShowFinishForm(null)
  }, [showFinishForm, winnerName, gameMode, planets, history])

  // 히스토리 아이템 클릭 → 해당 결과 다시 보기
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null)

  const handleHistoryClick = useCallback((idx: number) => {
    const entry = history[idx]
    if (!entry) return
    if (selectedHistoryIdx === idx) {
      // 같은 거 다시 클릭 → 해제
      setSelectedHistoryIdx(null)
      // 마지막 발사 결과로 복원
      if (history.length > 0) {
        const last = history[history.length - 1]
        setLastResult(last.result)
        setLaserPath(new Set(last.result.path.map((s) => `${s.row},${s.col}`)))
      }
      return
    }
    setSelectedHistoryIdx(idx)
    setLastResult(entry.result)
    setLaserPath(new Set(entry.result.path.map((s) => `${s.row},${s.col}`)))
  }, [history, selectedHistoryIdx])

  // 활성 결과의 발사 라벨
  const activeLabel = selectedHistoryIdx !== null
    ? history[selectedHistoryIdx]?.label
    : history.length > 0 ? history[history.length - 1]?.label : null

  // 엣지 라벨 클래스
  const lastExit = lastResult?.exitPoint
  const getEdgeClass = (label: string) => {
    const classes = ['edge-label']
    if (firedLabels.has(label)) classes.push('edge-fired')
    if (label === lastExit) classes.push('edge-exit')
    if (label === activeLabel) classes.push('edge-active')
    return classes.join(' ')
  }

  const allPlaced = placedPlanets.length === availablePieces.length

  return (
    <div className="board-container">
      <div className="top-bar">
        <div className="mode-toggle" onClick={handleToggleMode}>
          <div className={`toggle-option${gameMode === 'basic' ? ' active' : ''}`}>기본</div>
          <div className={`toggle-option${gameMode === 'blackhole' ? ' active' : ''}`}>블랙홀</div>
        </div>
        <div className="mode-toggle diff-toggle" onClick={() => {
          const cycle: (DifficultyLevel | 'any')[] = ['any', 'easy', 'normal', 'hard']
          const idx = cycle.indexOf(targetDifficulty)
          setTargetDifficulty(cycle[(idx + 1) % cycle.length])
        }}>
          <div className={`toggle-option${targetDifficulty === 'any' ? ' active' : ''}`}>전체</div>
          <div className={`toggle-option diff-easy-opt${targetDifficulty === 'easy' ? ' active' : ''}`}>쉬움</div>
          <div className={`toggle-option diff-normal-opt${targetDifficulty === 'normal' ? ' active' : ''}`}>보통</div>
          <div className={`toggle-option diff-hard-opt${targetDifficulty === 'hard' ? ' active' : ''}`}>어려움</div>
        </div>
        {difficulty && (
          <span className={`difficulty-badge diff-${difficulty.level}`}>
            {difficulty.score}
          </span>
        )}
        <button className="btn btn-new-sm" onClick={handleNewGameRequest}>새 게임</button>
      </div>

      {/* 확인 모달 */}
      {showConfirmNew && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <p>게임이 진행 중입니다. 새 게임을 시작하시겠습니까?</p>
            <div className="confirm-buttons">
              <button className="btn" onClick={() => { setShowConfirmNew(false); setPendingMode(null) }}>취소</button>
              <button className="btn btn-new" onClick={() => startNewGame(pendingMode ?? gameMode)}>새 게임</button>
            </div>
          </div>
        </div>
      )}

      {/* 배치 모드: 조각 트레이 */}
      {placingMode && (
        <div className="piece-tray">
          {Object.entries(availableCounts).map(([type, count]) => {
            const def = availablePieces.find((d) => d.type === type)!
            const used = placedCounts[type] || 0
            const remaining = count - used
            const isSelected = selectedPiece?.type === type
            return (
              <button
                key={type}
                className={`piece-btn${isSelected ? ' selected' : ''}${remaining <= 0 ? ' used' : ''}`}
                onClick={() => remaining > 0 && setSelectedPiece(isSelected ? null : def)}
                disabled={remaining <= 0}
              >
                <span className="piece-color" style={{ backgroundColor: PIECE_COLORS[type as PlanetType] }} />
                <span className="piece-name">{PIECE_NAMES[type as PlanetType]}</span>
                <span className="piece-count">{remaining}/{count}</span>
              </button>
            )
          })}
          {selectedPiece?.canRotate && (
            <button
              className="btn rotate-btn"
              onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
            >
              배치: {orientation === 'horizontal' ? '가로' : '세로'}
            </button>
          )}
        </div>
      )}

      <div className="board-wrapper">
        {/* 상단: 1-9 */}
        <div className="edge-labels top">
          <div className="corner" />
          {TOP_LABELS.map((label) => (
            <button key={`top-${label}`} className={getEdgeClass(label)}
              onClick={() => handleFire(label)}>{label}</button>
          ))}
          <div className="corner" />
        </div>

        <div className="board-middle">
          <div className="edge-labels left">
            {LEFT_LABELS.map((label) => (
              <button key={`left-${label}`} className={getEdgeClass(label)}
                onClick={() => handleFire(label)}>{label}</button>
            ))}
          </div>

          {/* 격자 */}
          <div
            ref={gridRef}
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            }}
            onMouseDown={onGridMouseDown}
            onMouseMove={onGridMouseMove}
            onMouseUp={onGridMouseUp}
            onMouseLeave={onGridMouseUp}
            onTouchStart={onGridTouchStart}
            onTouchMove={onGridTouchMove}
            onTouchEnd={onGridTouchEnd}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
              const row = Math.floor(i / GRID_SIZE)
              const col = i % GRID_SIZE
              const isLaserPath = showPlanets && laserPath.has(`${row},${col}`)
              const isEmpty = emptyCells.has(`${row},${col}`)

              const classes = ['cell']
              if (isLaserPath) classes.push('laser-path')
              if (isEmpty && !showPlanets) classes.push('cell-empty')
              if (placingMode) classes.push('cell-placeable')

              return (
                <div
                  key={`${row}-${col}`}
                  className={classes.join(' ')}
                  style={
                    isLaserPath && lastResult
                      ? { backgroundColor: LASER_COLOR_MAP[lastResult.color] + '33' }
                      : undefined
                  }
                  onClick={() => placingMode && handleCellClick(row, col)}
                />
              )
            })}
            <PlanetOverlay planets={planets} visible={showPlanets} cellSize={cellSize} />
            {placingMode && <PlanetOverlay planets={placedPlanets} visible cellSize={cellSize} />}
          </div>

          {/* 드래그 고스트 */}
          {draggingIdx !== null && (() => {
            const p = placedPlanets[draggingIdx]
            const def = availablePieces.find(d => d.type === p.type)!
            const o = p.orientation ?? 'horizontal'
            const w = (o === 'horizontal' ? def.width : def.height) * CELL_SIZE
            const h = (o === 'horizontal' ? def.height : def.width) * CELL_SIZE
            return (
              <div style={{
                position: 'fixed', left: dragPos.x - dragOffset.x, top: dragPos.y - dragOffset.y,
                width: w, height: h, opacity: 0.5, pointerEvents: 'none', zIndex: 100,
                background: PIECE_COLORS[p.type], borderRadius: 4,
              }} />
            )
          })()}

          <div className="edge-labels right">
            {RIGHT_LABELS.map((label) => (
              <button key={`right-${label}`} className={getEdgeClass(label)}
                onClick={() => handleFire(label)}>{label}</button>
            ))}
          </div>
        </div>

        {/* 하단: J-R */}
        <div className="edge-labels bottom">
          <div className="corner" />
          {BOTTOM_LABELS.map((label) => (
            <button key={`bottom-${label}`} className={getEdgeClass(label)}
              onClick={() => handleFire(label)}>{label}</button>
          ))}
          <div className="corner" />
        </div>
      </div>

      {/* 결과 패널 */}
      <div className="result-panel">
        {lastResult && !placingMode && (
          <div className="last-result">
            <div className="result-row">
              <span className="result-label">결과:</span>
              <span className="result-value">
                {lastResult.exitPoint === '소멸' ? '소멸되었습니다'
                  : lastResult.exitPoint === '갇힘' ? '레이저가 갇혔습니다'
                    : `나간 지점: ${lastResult.exitPoint}`}
              </span>
            </div>
            {lastResult.exitPoint !== '소멸' && (
              <div className="result-row">
                <span className="result-label">레이저 색:</span>
                <span className="result-value">
                  <span className="color-dot" style={{ backgroundColor: LASER_COLOR_MAP[lastResult.color] }} />
                  {LASER_COLOR_NAME_KR[lastResult.color]}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 발사 기록 */}
        {history.length > 0 && (
          <div className="history">
            <h3>발사 기록</h3>
            <div className="history-list" ref={historyListRef}>
              {history.map((entry, i) => {
                const isSomel = entry.result.exitPoint === '소멸'
                const isTrapped = entry.result.exitPoint === '갇힘'
                return (
                  <div key={i}
                    className={`history-item${selectedHistoryIdx === i ? ' history-selected' : ''}`}
                    onClick={() => handleHistoryClick(i)}
                  >
                    <span className="history-number">{i + 1}.</span>
                    <span className="history-label">발사: {entry.label}</span>
                    <span className="history-arrow">→</span>
                    <span className="history-exit">
                      {isSomel ? '소멸' : isTrapped ? '갇힘' : entry.result.exitPoint}
                    </span>
                    {!isSomel && (
                      <>
                        <span className="history-divider">|</span>
                        <span className="color-dot" style={{ backgroundColor: LASER_COLOR_MAP[entry.result.color] }} />
                        <span className="history-color">{LASER_COLOR_NAME_KR[entry.result.color]}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 배치 모드 조각 리스트 */}
        {placingMode && placedPlanets.length > 0 && (
          <div className="placed-list">
            <h3>배치한 조각 (탭→제거)</h3>
            <div className="placed-items">
              {placedPlanets.map((p, i) => (
                <button key={i} className="placed-item" onClick={() => {
                  setPlacedPlanets(placedPlanets.filter((_, j) => j !== i))
                }}>
                  <span className="piece-color" style={{ backgroundColor: PIECE_COLORS[p.type] }} />
                  {PIECE_NAMES[p.type]}
                  {p.orientation === 'vertical' ? '(세로)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {showFinishForm && (
          <div className={`finish-form ${showFinishForm === 'success' ? 'finish-success' : 'finish-fail'}`}>
            <h3>{showFinishForm === 'success' ? '🎉 정답입니다!' : '❌ 틀렸습니다!'}</h3>
            <p className="finish-desc">
              {showFinishForm === 'success'
                ? `${history.length}회 발사로 정답을 맞췄습니다!`
                : '정답이 공개되었습니다.'}
            </p>
            <input type="text" className="winner-input"
              placeholder={showFinishForm === 'success' ? '우승자 이름 입력' : '이름 입력 (선택)'}
              value={winnerName} onChange={(e) => setWinnerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmFinish()} autoFocus />
            <div className="finish-form-buttons">
              <button className="btn" onClick={() => setShowFinishForm(null)}>취소</button>
              <button className="btn btn-finish" onClick={handleConfirmFinish}>저장</button>
            </div>
          </div>
        )}

        {gameFinished && (
          <div className="game-finished">
            게임 완료! 기록이 저장되었습니다. ({history.length}회 발사)
          </div>
        )}

        <div className="controls">
          {!gameFinished && !showFinishForm && !placingMode && (
            <>
              <div className="mode-toggle" onClick={() => setShowPlanets((v) => !v)}>
                <div className={`toggle-option${!showPlanets ? ' active' : ''}`}>숨김</div>
                <div className={`toggle-option${showPlanets ? ' active' : ''}`}>보기</div>
              </div>
              <button className="btn btn-finish" onClick={enterPlacingMode}
                disabled={history.length === 0}>제출</button>
              <button className="btn btn-fail" onClick={() => setShowFinishForm('fail')}
                disabled={history.length === 0}>포기</button>
            </>
          )}
          {placingMode && (
            <>
              <button className="btn" onClick={() => setPlacingMode(false)}>돌아가기</button>
              <button className="btn btn-finish" onClick={handleSubmitAnswer}
                disabled={!allPlaced}>정답 확인</button>
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function comparePlacements(answer: Planet[], actual: Planet[]): boolean {
  if (answer.length !== actual.length) return false
  const normalize = (planets: Planet[]) =>
    planets.map(p => ({
      type: p.type, row: p.row, col: p.col,
      orientation: p.orientation ?? 'horizontal',
    })).sort((a, b) => a.type.localeCompare(b.type) || a.row - b.row || a.col - b.col)
  const a = normalize(answer)
  const b = normalize(actual)
  return a.every((p, i) =>
    p.type === b[i].type && p.row === b[i].row &&
    p.col === b[i].col && p.orientation === b[i].orientation
  )
}
