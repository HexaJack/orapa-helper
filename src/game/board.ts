import type { Planet, PlanetDef, CellState, GameMode } from './types'
import { GRID_SIZE, PLANET_DEFS, BLACKHOLE_DEFS } from './types'

const ALL_DEFS = [...PLANET_DEFS, ...BLACKHOLE_DEFS]

/**
 * 행성이 차지하는 모든 셀 좌표를 반환
 */
function getOccupiedCells(
  row: number,
  col: number,
  def: PlanetDef,
  orientation: 'horizontal' | 'vertical'
): [number, number][] {
  const w = orientation === 'horizontal' ? def.width : def.height
  const h = orientation === 'horizontal' ? def.height : def.width
  const cells: [number, number][] = []

  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      cells.push([r, c])
    }
  }
  return cells
}

/**
 * 행성이 보드 범위 안에 있는지 확인
 */
function isInBounds(
  row: number,
  col: number,
  def: PlanetDef,
  orientation: 'horizontal' | 'vertical'
): boolean {
  const w = orientation === 'horizontal' ? def.width : def.height
  const h = orientation === 'horizontal' ? def.height : def.width
  return row >= 0 && col >= 0 && row + h <= GRID_SIZE && col + w <= GRID_SIZE
}

/**
 * 행성이 보드 가장자리에 접촉하는지 확인 (large-white 전용)
 * 직선 부분이 보드 가장자리에 닿아야 함
 */
function touchesEdge(
  row: number,
  col: number,
  def: PlanetDef,
  orientation: 'horizontal' | 'vertical'
): boolean {
  const w = orientation === 'horizontal' ? def.width : def.height
  const h = orientation === 'horizontal' ? def.height : def.width
  // 직선 부분(긴 변)이 보드 가장자리에 닿아야 함
  if (orientation === 'horizontal') {
    // 가로 배치: 직선(4칸)이 상단 or 하단 가장자리
    return row === 0 || row + h === GRID_SIZE
  } else {
    // 세로 배치: 직선(4칸)이 좌측 or 우측 가장자리
    return col === 0 || col + w === GRID_SIZE
  }
}

/**
 * 두 행성이 가장자리를 맞대고 있는지 확인 (edge-to-edge 금지)
 * 같은 셀 점유는 물론, 인접 셀도 안 됨
 */
function hasEdgeContact(
  cellsA: [number, number][],
  cellsB: [number, number][]
): boolean {
  const setB = new Set(cellsB.map(([r, c]) => `${r},${c}`))

  for (const [r, c] of cellsA) {
    // 상하좌우 인접 셀이 다른 행성에 속하면 edge-to-edge
    const neighbors: [number, number][] = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]
    for (const [nr, nc] of neighbors) {
      if (setB.has(`${nr},${nc}`)) return true
    }
  }
  return false
}

/**
 * 셀 겹침 확인
 */
function hasOverlap(
  cellsA: [number, number][],
  cellsB: [number, number][]
): boolean {
  const setB = new Set(cellsB.map(([r, c]) => `${r},${c}`))
  return cellsA.some(([r, c]) => setB.has(`${r},${c}`))
}

/**
 * 행성이 다른 조각들에 완전히 둘러싸여 보이지 않는지 확인
 * (가장자리에서 봤을 때 완전히 가려지면 안 됨)
 */
function isCompletelyHidden(
  cells: [number, number][],
  occupiedByOthers: Set<string>
): boolean {
  // 행성의 모든 셀에 대해, 하나라도 보드 가장자리까지 가는
  // 직선 경로(상하좌우)가 막히지 않은 게 있으면 OK
  for (const [r, c] of cells) {
    // 위로
    let blocked = true
    for (let rr = r - 1; rr >= 0; rr--) {
      if (!occupiedByOthers.has(`${rr},${c}`)) { blocked = false; break }
    }
    if (!blocked) return false

    // 아래로
    blocked = true
    for (let rr = r + 1; rr < GRID_SIZE; rr++) {
      if (!occupiedByOthers.has(`${rr},${c}`)) { blocked = false; break }
    }
    if (!blocked) return false

    // 왼쪽
    blocked = true
    for (let cc = c - 1; cc >= 0; cc--) {
      if (!occupiedByOthers.has(`${r},${cc}`)) { blocked = false; break }
    }
    if (!blocked) return false

    // 오른쪽
    blocked = true
    for (let cc = c + 1; cc < GRID_SIZE; cc++) {
      if (!occupiedByOthers.has(`${r},${cc}`)) { blocked = false; break }
    }
    if (!blocked) return false
  }
  return true
}

/**
 * 배치가 유효한지 전체 검증
 */
function isValidPlacement(
  planet: Planet,
  def: PlanetDef,
  existingPlanets: Planet[]
): boolean {
  const orientation = planet.orientation ?? 'horizontal'

  // 1. 보드 범위 체크
  if (!isInBounds(planet.row, planet.col, def, orientation)) return false

  // 2. 가장자리 접촉 필요 체크 (large-white)
  if (def.needsEdge && !touchesEdge(planet.row, planet.col, def, orientation)) {
    return false
  }

  const newCells = getOccupiedCells(planet.row, planet.col, def, orientation)

  // 기존 행성들과 비교
  for (const existing of existingPlanets) {
    const existDef = ALL_DEFS.find((d) => d.type === existing.type)!
    const existCells = getOccupiedCells(
      existing.row,
      existing.col,
      existDef,
      existing.orientation ?? 'horizontal'
    )

    // 3. 겹침 체크
    if (hasOverlap(newCells, existCells)) return false

    // 4. 가장자리 맞대기 금지 체크
    if (hasEdgeContact(newCells, existCells)) return false
  }

  // 5. 완전히 둘러싸여 가려지는지 체크
  const allOtherCells = new Set<string>()
  for (const existing of existingPlanets) {
    const existDef = ALL_DEFS.find((d) => d.type === existing.type)!
    const existCells = getOccupiedCells(
      existing.row,
      existing.col,
      existDef,
      existing.orientation ?? 'horizontal'
    )
    existCells.forEach(([r, c]) => allOtherCells.add(`${r},${c}`))
  }
  if (existingPlanets.length > 0 && isCompletelyHidden(newCells, allOtherCells)) {
    return false
  }

  return true
}

/**
 * 랜덤 행성 배치 생성
 */
export function generateRandomBoard(mode: GameMode = 'basic'): Planet[] {
  const defs = mode === 'blackhole'
    ? [...PLANET_DEFS, ...BLACKHOLE_DEFS]
    : [...PLANET_DEFS]

  const maxAttempts = 1000
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts++
    const planets: Planet[] = []
    let success = true

    // 큰 것부터 배치 (배치 실패 확률 줄이기)
    const sortedDefs = [...defs].sort(
      (a, b) => b.width * b.height - a.width * a.height
    )

    for (const def of sortedDefs) {
      let placed = false
      const placementAttempts = 100

      for (let i = 0; i < placementAttempts; i++) {
        const orientations: ('horizontal' | 'vertical')[] = def.canRotate
          ? [Math.random() < 0.5 ? 'horizontal' : 'vertical']
          : ['horizontal']
        const orientation = orientations[0]

        const w = orientation === 'horizontal' ? def.width : def.height
        const h = orientation === 'horizontal' ? def.height : def.width

        const row = Math.floor(Math.random() * (GRID_SIZE - h + 1))
        const col = Math.floor(Math.random() * (GRID_SIZE - w + 1))

        const planet: Planet = {
          type: def.type,
          color: def.color,
          row,
          col,
          orientation,
        }

        // large-white: 직선 부분이 접하는 가장자리 방향 결정
        if (def.type === 'large-white' && def.needsEdge) {
          if (orientation === 'horizontal') {
            planet.edgeSide = row === 0 ? 'top' : 'bottom'
          } else {
            planet.edgeSide = col === 0 ? 'left' : 'right'
          }
        }

        if (isValidPlacement(planet, def, planets)) {
          planets.push(planet)
          placed = true
          break
        }
      }

      if (!placed) {
        success = false
        break
      }
    }

    if (success) return planets
  }

  // fallback: 최소한의 배치라도 반환 (실패 시)
  throw new Error('Failed to generate valid board after max attempts')
}

/**
 * 보드 격자 상태 생성 (시각화용)
 */
export function createBoardGrid(planets: Planet[]): CellState[][] {
  const grid: CellState[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  )

  for (const planet of planets) {
    const def = ALL_DEFS.find((d) => d.type === planet.type)!
    const cells = getOccupiedCells(
      planet.row,
      planet.col,
      def,
      planet.orientation ?? 'horizontal'
    )
    for (const [r, c] of cells) {
      grid[r][c] = planet.type
    }
  }

  return grid
}
