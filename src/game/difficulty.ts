import type { Planet, GameMode } from './types'
import { GRID_SIZE } from './types'
import { generateRandomBoard } from './board'
import { fireLaser } from './laser'
import { isPassthrough } from './helpers'

export type DifficultyLevel = 'easy' | 'normal' | 'hard'

export interface DifficultyResult {
  level: DifficultyLevel
  score: number // 0~10, 높을수록 어려움
  details: {
    emptyLines: number      // 빈 라인 수
    nearReflections: number // 인접 탈출 수
    avgPathLength: number   // 평균 레이저 경로 길이
    planetSpread: number    // 행성 분산도 (0~1)
    colorVariety: number    // 색상 변화 다양성
    infoRedundancy: number  // 정보 중복도 (0~1, 높을수록 중복 많음)
  }
}

// 모든 발사 라벨
const ALL_LABELS: string[] = [
  ...Array.from({ length: GRID_SIZE }, (_, i) => String(i + 1)),         // 1-9
  ...Array.from({ length: GRID_SIZE }, (_, i) => String(i + 10)),        // 10-18
  ...Array.from({ length: GRID_SIZE }, (_, i) => String.fromCharCode(65 + i)), // A-I
  ...Array.from({ length: GRID_SIZE }, (_, i) => String.fromCharCode(74 + i)), // J-R
]

/**
 * 두 발사 지점이 인접한지 판별
 * 같은 변에서 번호/알파벳이 1 차이이거나, 꼭짓점을 공유하는 두 변
 */
function isNearExit(fired: string, exit: string): boolean {
  // 같은 변에서 인접
  const fNum = parseInt(fired)
  const eNum = parseInt(exit)
  const fCode = fired.charCodeAt(0)
  const eCode = exit.charCodeAt(0)

  // 둘 다 상단 (1-9)
  if (fNum >= 1 && fNum <= 9 && eNum >= 1 && eNum <= 9) {
    return Math.abs(fNum - eNum) <= 1 && fired !== exit
  }
  // 둘 다 우측 (10-18)
  if (fNum >= 10 && fNum <= 18 && eNum >= 10 && eNum <= 18) {
    return Math.abs(fNum - eNum) <= 1 && fired !== exit
  }
  // 둘 다 좌측 (A-I)
  if (fCode >= 65 && fCode <= 73 && eCode >= 65 && eCode <= 73) {
    return Math.abs(fCode - eCode) <= 1 && fired !== exit
  }
  // 둘 다 하단 (J-R)
  if (fCode >= 74 && fCode <= 82 && eCode >= 74 && eCode <= 82) {
    return Math.abs(fCode - eCode) <= 1 && fired !== exit
  }

  // 꼭짓점 인접: 1과 A, 9와 10, I와 J, 18과 R
  const cornerPairs = [
    ['1', 'A'], ['9', '10'], ['I', 'J'], ['18', 'R'],
  ]
  for (const [a, b] of cornerPairs) {
    if ((fired === a && exit === b) || (fired === b && exit === a)) return true
  }

  return false
}

/**
 * 행성 분산도 계산 (0=한곳에 밀집, 1=고르게 분산)
 */
function calcSpread(planets: Planet[]): number {
  if (planets.length <= 1) return 0
  const centers = planets.map((p) => ({ r: p.row + 0.5, c: p.col + 0.5 }))

  // 평균 중심 간 거리
  let totalDist = 0
  let count = 0
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      totalDist += Math.sqrt(
        (centers[i].r - centers[j].r) ** 2 + (centers[i].c - centers[j].c) ** 2
      )
      count++
    }
  }
  const avgDist = totalDist / count
  // 최대 가능 거리 (대각선) 기준 정규화
  const maxDist = Math.sqrt(GRID_SIZE ** 2 + GRID_SIZE ** 2)
  return Math.min(avgDist / (maxDist * 0.4), 1)
}

/**
 * 난이도 분석
 */
export function analyzeDifficulty(planets: Planet[]): DifficultyResult {
  let emptyLines = 0
  let nearReflections = 0
  let totalPathLength = 0
  const colorSet = new Set<string>()
  let validShots = 0
  const signatures = new Map<string, number>() // "탈출점:색상" → 횟수

  for (const label of ALL_LABELS) {
    const result = fireLaser(label, planets)

    // 빈 라인
    if (
      result.color === 'transparent' &&
      result.exitPoint &&
      result.exitPoint !== '소멸' &&
      result.exitPoint !== '갇힘' &&
      isPassthrough(label, result.exitPoint)
    ) {
      emptyLines++
    }

    // 인접 탈출
    if (result.exitPoint && result.exitPoint !== '소멸' && result.exitPoint !== '갇힘') {
      validShots++
      totalPathLength += result.path.length

      if (isNearExit(label, result.exitPoint)) {
        nearReflections++
      }
    }

    // 색상 다양성
    if (result.color !== 'transparent') {
      colorSet.add(result.color)
    }

    // 결과 시그니처 (탈출점+색상)
    const sig = `${result.exitPoint}:${result.color}`
    signatures.set(sig, (signatures.get(sig) || 0) + 1)
  }

  const avgPathLength = validShots > 0 ? totalPathLength / validShots : 0
  const planetSpread = calcSpread(planets)
  const colorVariety = colorSet.size

  // 정보 유일성: 고유 시그니처 비율 (높을수록 각 발사가 고유한 정보 → 쉬움)
  const uniqueSignatures = signatures.size
  const uniqueRatio = uniqueSignatures / ALL_LABELS.length // 0~1

  // 점수 계산 (0~10)
  const totalLabels = ALL_LABELS.length // 36
  const emptyRatio = emptyLines / totalLabels
  const nearRatio = validShots > 0 ? nearReflections / validShots : 0

  let score = 5

  // 빈 라인 비율 → 많으면 쉬움
  score -= emptyRatio * 5

  // 인접 탈출 비율 → 많으면 쉬움
  score -= nearRatio * 3

  // 평균 경로 길이 → 길면 어려움
  score += (avgPathLength - 3) * 0.3

  // 분산 낮으면(밀집) → 어려움
  score += (1 - planetSpread) * 2

  // 정보 중복도 → 유일 비율 높으면 쉬움, 낮으면 어려움
  // uniqueRatio 1.0 = 모든 발사 결과 고유 (쉬움), 0.5 = 절반 중복 (어려움)
  score -= (uniqueRatio - 0.5) * 3

  // 색상 다양성
  const threeColorMixes = new Set(['light-orange', 'light-purple', 'light-green', 'black', 'gray'])
  let threeColorCount = 0
  for (const c of colorSet) {
    if (threeColorMixes.has(c)) threeColorCount++
  }
  const twoColorMixes = new Set(['orange', 'purple', 'green', 'pink', 'lemon', 'skyblue'])
  let twoColorCount = 0
  for (const c of colorSet) {
    if (twoColorMixes.has(c)) twoColorCount++
  }
  score += Math.min(twoColorCount, 3) * 0.1
  score += threeColorCount * 0.5

  // 범위 제한
  score = Math.max(0, Math.min(10, score))

  const level: DifficultyLevel =
    score <= 3 ? 'easy' : score <= 6 ? 'normal' : 'hard'

  return {
    level,
    score: Math.round(score * 10) / 10,
    details: {
      emptyLines,
      nearReflections,
      avgPathLength: Math.round(avgPathLength * 10) / 10,
      planetSpread: Math.round(planetSpread * 100) / 100,
      colorVariety,
      infoRedundancy: Math.round((1 - uniqueRatio) * 100) / 100,
    },
  }
}

/**
 * 지정 난이도에 맞는 보드 생성
 * 최대 50번 시도 후 가장 가까운 결과 반환
 */
export function generateBoardWithDifficulty(
  mode: GameMode,
  targetLevel: DifficultyLevel | 'any'
): { planets: Planet[]; difficulty: DifficultyResult } {
  if (targetLevel === 'any') {
    const planets = generateRandomBoard(mode)
    return { planets, difficulty: analyzeDifficulty(planets) }
  }

  // 난이도별 최소 점수 보장
  const minScore = targetLevel === 'easy' ? 0 : targetLevel === 'normal' ? 3 : 6
  const maxScore = targetLevel === 'easy' ? 3 : targetLevel === 'normal' ? 6 : 10

  let bestPlanets = generateRandomBoard(mode)
  let bestDiff = analyzeDifficulty(bestPlanets)

  if (bestDiff.score >= minScore && bestDiff.score <= maxScore) {
    return { planets: bestPlanets, difficulty: bestDiff }
  }

  for (let i = 0; i < 200; i++) {
    const planets = generateRandomBoard(mode)
    const diff = analyzeDifficulty(planets)
    if (diff.score >= minScore && diff.score <= maxScore) {
      return { planets, difficulty: diff }
    }
    // 범위에 가장 가까운 점수 저장
    const bestGap = bestDiff.score < minScore ? minScore - bestDiff.score : bestDiff.score - maxScore
    const curGap = diff.score < minScore ? minScore - diff.score : diff.score - maxScore
    if (curGap < bestGap) {
      bestPlanets = planets
      bestDiff = diff
    }
  }

  return { planets: bestPlanets, difficulty: bestDiff }
}
