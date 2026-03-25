import { GRID_SIZE } from './types'

/**
 * 발사 지점과 나간 지점이 정반대(직선 관통)인지 판별
 * 정반대 = 같은 행/열의 반대쪽 변
 */
export function isPassthrough(firedLabel: string, exitLabel: string): boolean {
  // 상단(1-9) ↔ 하단(J-R)
  const topNum = parseInt(firedLabel)
  if (topNum >= 1 && topNum <= GRID_SIZE) {
    const expectedExit = String.fromCharCode(73 + topNum) // J=74, col=topNum-1 → J+col
    return exitLabel === expectedExit
  }
  // 하단(J-R) ↔ 상단(1-9)
  const bottomCode = firedLabel.charCodeAt(0)
  if (bottomCode >= 74 && bottomCode <= 82) {
    const expectedExit = String(bottomCode - 73) // J=74→1, K=75→2...
    return exitLabel === expectedExit
  }
  // 좌측(A-I) ↔ 우측(10-18)
  const leftCode = firedLabel.charCodeAt(0)
  if (leftCode >= 65 && leftCode <= 73) {
    const expectedExit = String(leftCode - 55) // A=65→10, B=66→11...
    return exitLabel === expectedExit
  }
  // 우측(10-18) ↔ 좌측(A-I)
  const rightNum = parseInt(firedLabel)
  if (rightNum >= 10 && rightNum <= 18) {
    const expectedExit = String.fromCharCode(55 + rightNum) // 10→A(65), 11→B(66)...
    return exitLabel === expectedExit
  }
  return false
}

/**
 * 발사 라벨로부터 관통 시 빈 칸 좌표 리스트 반환
 * 상단/하단 발사 → 해당 열 전체 (col 고정, row 0-8)
 * 좌측/우측 발사 → 해당 행 전체 (row 고정, col 0-8)
 */
export function getPassthroughCells(firedLabel: string): [number, number][] {
  const cells: [number, number][] = []
  const topNum = parseInt(firedLabel)
  if (topNum >= 1 && topNum <= GRID_SIZE) {
    // 상단: col = topNum - 1
    for (let r = 0; r < GRID_SIZE; r++) cells.push([r, topNum - 1])
    return cells
  }
  const code = firedLabel.charCodeAt(0)
  if (code >= 74 && code <= 82) {
    // 하단 J-R: col = code - 74
    for (let r = 0; r < GRID_SIZE; r++) cells.push([r, code - 74])
    return cells
  }
  if (code >= 65 && code <= 73) {
    // 좌측 A-I: row = code - 65
    for (let c = 0; c < GRID_SIZE; c++) cells.push([code - 65, c])
    return cells
  }
  const rightNum = parseInt(firedLabel)
  if (rightNum >= 10 && rightNum <= 18) {
    // 우측 10-18: row = rightNum - 10
    for (let c = 0; c < GRID_SIZE; c++) cells.push([rightNum - 10, c])
    return cells
  }
  return cells
}
