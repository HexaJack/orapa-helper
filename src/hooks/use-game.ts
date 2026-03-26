import { useState, useCallback, useEffect } from 'react'
import type { GameMode, Planet, PlanetDef } from '../game/types'
import { PLANET_DEFS, BLACKHOLE_DEFS } from '../game/types'
import type { LaserResult } from '../game/laser'
import { fireLaser } from '../game/laser'
import { saveGameRecord, generateId } from '../game/storage'
import { isPassthrough, getPassthroughCells } from '../game/helpers'
import type { DifficultyResult, DifficultyLevel } from '../game/difficulty'
import { analyzeDifficulty, generateBoardWithDifficulty } from '../game/difficulty'

export type PlayMode = 'solo' | 'multi'
export interface HistoryEntry { label: string; result: LaserResult }

function getAvailablePieces(mode: GameMode): PlanetDef[] {
  return mode === 'blackhole' ? [...PLANET_DEFS, ...BLACKHOLE_DEFS] : [...PLANET_DEFS]
}

export function useGame() {
  const [playMode, setPlayMode] = useState<PlayMode>('solo')
  const [gameMode, setGameMode] = useState<GameMode>('basic')
  const [targetDifficulty, setTargetDifficulty] = useState<DifficultyLevel | 'any'>('any')
  const [planets, setPlanets] = useState(() => generateBoardWithDifficulty('basic', 'any').planets)
  const [difficulty, setDifficulty] = useState<DifficultyResult | null>(null)
  const [showPlanets, setShowPlanets] = useState(false)
  const [showRevealConfirm, setShowRevealConfirm] = useState(false)
  const [lastResult, setLastResult] = useState<LaserResult | null>(null)
  const [laserPath, setLaserPath] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [gameFinished, setGameFinished] = useState(false)
  const [firedLabels, setFiredLabels] = useState<Set<string>>(new Set())
  const [emptyCells, setEmptyCells] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null)

  // 배치 상태
  const [placingMode, setPlacingMode] = useState(false)
  const [placedPlanets, setPlacedPlanets] = useState<Planet[]>([])
  const [selectedPiece, setSelectedPiece] = useState<PlanetDef | null>(null)
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')

  // UI 상태
  const [winnerName, setWinnerName] = useState('')
  const [showFinishForm, setShowFinishForm] = useState<'success' | 'fail' | null>(null)
  const [showConfirmNew, setShowConfirmNew] = useState(false)
  const [pendingMode, setPendingMode] = useState<GameMode | null>(null)

  const isSolo = playMode === 'solo'
  const isPlacing = isSolo || placingMode
  const availablePieces = getAvailablePieces(gameMode)

  const placedCounts = placedPlanets.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1; return acc
  }, {} as Record<string, number>)
  const availableCounts = availablePieces.reduce((acc, def) => {
    acc[def.type] = (acc[def.type] || 0) + 1; return acc
  }, {} as Record<string, number>)
  const allPlaced = placedPlanets.length === availablePieces.length

  useEffect(() => {
    setDifficulty(analyzeDifficulty(planets))
  }, [planets])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }, [])

  const handleFire = useCallback((label: string) => {
    if (gameFinished) return
    if (!isSolo && placingMode) return
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

    if (
      result.color === 'transparent' && result.exitPoint &&
      result.exitPoint !== '소멸' && result.exitPoint !== '갇힘' &&
      isPassthrough(label, result.exitPoint)
    ) {
      const cells = getPassthroughCells(label)
      setEmptyCells((prev) => {
        const next = new Set(prev)
        cells.forEach(([r, c]) => next.add(`${r},${c}`))
        return next
      })
    }
  }, [planets, gameFinished, placingMode, firedLabels, history, showToast, isSolo])

  const startNewGame = useCallback((mode: GameMode) => {
    setGameMode(mode)
    const { planets: np, difficulty: nd } = generateBoardWithDifficulty(mode, targetDifficulty)
    setPlanets(np); setDifficulty(nd)
    setLastResult(null); setLaserPath(new Set()); setHistory([])
    setGameFinished(false); setShowPlanets(false)
    setFiredLabels(new Set()); setEmptyCells(new Set())
    setWinnerName(''); setShowFinishForm(null); setShowConfirmNew(false)
    setPlacingMode(false); setPlacedPlanets([]); setSelectedPiece(null)
  }, [targetDifficulty])

  const handleNewGameRequest = useCallback(() => {
    if (history.length > 0 && !gameFinished) {
      setPendingMode(gameMode); setShowConfirmNew(true)
    } else { startNewGame(gameMode) }
  }, [history.length, gameFinished, gameMode, startNewGame])

  const handleToggleMode = useCallback(() => {
    const newMode = gameMode === 'basic' ? 'blackhole' : 'basic'
    if (history.length > 0 && !gameFinished) {
      setPendingMode(newMode); setShowConfirmNew(true)
    } else { startNewGame(newMode) }
  }, [gameMode, history.length, gameFinished, startNewGame])

  const handleHistoryClick = useCallback((idx: number) => {
    const entry = history[idx]
    if (!entry) return
    if (selectedHistoryIdx === idx) {
      setSelectedHistoryIdx(null)
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

  const handleSubmitAnswer = useCallback(() => {
    if (comparePlacements(placedPlanets, planets)) {
      setShowFinishForm('success'); setPlacingMode(false); setShowPlanets(true)
    } else {
      showToast('틀렸습니다! 다시 시도하세요.')
      setPlacedPlanets([]); setSelectedPiece(null)
    }
  }, [placedPlanets, planets, showToast])

  const handleConfirmFinish = useCallback(() => {
    const solved = showFinishForm === 'success'
    saveGameRecord({
      id: generateId(), date: new Date().toISOString(),
      mode: gameMode, winner: winnerName.trim() || (solved ? '승리자' : ''),
      planets, history, totalShots: history.length, solved,
    })
    setGameFinished(true); setShowPlanets(true); setShowFinishForm(null)
  }, [showFinishForm, winnerName, gameMode, planets, history])

  const activeLabel = selectedHistoryIdx !== null
    ? history[selectedHistoryIdx]?.label
    : history.length > 0 ? history[history.length - 1]?.label : null
  const lastExit = lastResult?.exitPoint
  const getEdgeClass = (label: string) => {
    const classes = ['edge-label']
    if (firedLabels.has(label)) classes.push('edge-fired')
    if (label === lastExit) classes.push('edge-exit')
    if (label === activeLabel) classes.push('edge-active')
    return classes.join(' ')
  }

  return {
    // 모드
    playMode, setPlayMode, gameMode, isSolo, isPlacing,
    targetDifficulty, setTargetDifficulty,
    // 보드 상태
    planets, difficulty, showPlanets, setShowPlanets,
    showRevealConfirm, setShowRevealConfirm,
    lastResult, laserPath, history, gameFinished,
    firedLabels, emptyCells, toast, selectedHistoryIdx,
    // 배치
    placingMode, setPlacingMode, placedPlanets, setPlacedPlanets,
    selectedPiece, setSelectedPiece, orientation, setOrientation,
    availablePieces, placedCounts, availableCounts, allPlaced,
    // UI
    winnerName, setWinnerName, showFinishForm, setShowFinishForm,
    showConfirmNew, setShowConfirmNew, pendingMode, setPendingMode,
    // 액션
    handleFire, startNewGame, handleNewGameRequest, handleToggleMode,
    handleHistoryClick, handleSubmitAnswer, handleConfirmFinish,
    showToast, getEdgeClass,
  }
}

function comparePlacements(answer: Planet[], actual: Planet[]): boolean {
  if (answer.length !== actual.length) return false
  const normalize = (planets: Planet[]) =>
    planets.map(p => ({
      type: p.type, row: p.row, col: p.col, orientation: p.orientation ?? 'horizontal',
    })).sort((a, b) => a.type.localeCompare(b.type) || a.row - b.row || a.col - b.col)
  const a = normalize(answer), b = normalize(actual)
  return a.every((p, i) =>
    p.type === b[i].type && p.row === b[i].row && p.col === b[i].col && p.orientation === b[i].orientation
  )
}
