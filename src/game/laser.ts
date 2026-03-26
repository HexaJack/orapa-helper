import type { Planet } from './types'
import { GRID_SIZE, PLANET_DEFS, BLACKHOLE_DEFS } from './types'

const ALL_DEFS = [...PLANET_DEFS, ...BLACKHOLE_DEFS]

// 레이저 방향
type Direction = 'up' | 'down' | 'left' | 'right'

// 레이저 색상 (투명에서 시작)
export type LaserColor =
  | 'transparent'
  | 'white' | 'red' | 'blue' | 'yellow'
  | 'orange' | 'purple' | 'green'
  | 'pink' | 'lemon' | 'skyblue'
  | 'light-orange' | 'light-purple' | 'light-green'
  | 'black' | 'gray'

// 레이저 경로의 각 지점
export interface LaserStep {
  row: number
  col: number
  direction: Direction
}

// 레이저 발사 결과
export interface LaserResult {
  exitPoint: string | null    // 나간 지점 라벨 (null이면 갇힘)
  color: LaserColor
  path: LaserStep[]
}

/**
 * 발사 지점 라벨 → 좌표 + 방향 변환
 * 상단 1-9: (row=-1, col=0-8), 방향 down
 * 우측 10-18: (row=0-8, col=9), 방향 left
 * 좌측 A-I: (row=0-8, col=-1), 방향 right
 * 하단 J-R: (row=9, col=0-8), 방향 up
 */
export function parseFirePoint(label: string): { row: number; col: number; direction: Direction } | null {
  // 숫자 1-18
  const num = parseInt(label)
  if (!isNaN(num)) {
    if (num >= 1 && num <= 9) {
      return { row: -1, col: num - 1, direction: 'down' }
    }
    if (num >= 10 && num <= 18) {
      return { row: num - 10, col: GRID_SIZE, direction: 'left' }
    }
  }

  // 알파벳 A-R
  const code = label.toUpperCase().charCodeAt(0)
  if (code >= 65 && code <= 73) { // A-I
    return { row: code - 65, col: -1, direction: 'right' }
  }
  if (code >= 74 && code <= 82) { // J-R
    return { row: GRID_SIZE, col: code - 74, direction: 'up' }
  }

  return null
}

/**
 * 좌표 → 발사 지점 라벨 변환 (레이저가 나갈 때)
 */
function toExitLabel(row: number, col: number, direction: Direction): string | null {
  if (direction === 'up' && row < 0) {
    return String(col + 1) // 상단 1-9
  }
  if (direction === 'down' && row >= GRID_SIZE) {
    return String.fromCharCode(74 + col) // 하단 J-R
  }
  if (direction === 'left' && col < 0) {
    return String.fromCharCode(65 + row) // 좌측 A-I
  }
  if (direction === 'right' && col >= GRID_SIZE) {
    return String(row + 10) // 우측 10-18
  }
  return null
}

/**
 * 행성이 차지하는 셀 맵 생성
 */
function buildPlanetMap(planets: Planet[]): Map<string, Planet> {
  const map = new Map<string, Planet>()
  for (const planet of planets) {
    const def = ALL_DEFS.find((d) => d.type === planet.type)!
    const orientation = planet.orientation ?? 'horizontal'
    const w = orientation === 'horizontal' ? def.width : def.height
    const h = orientation === 'horizontal' ? def.height : def.width
    for (let r = planet.row; r < planet.row + h; r++) {
      for (let c = planet.col; c < planet.col + w; c++) {
        map.set(`${r},${c}`, planet)
      }
    }
  }
  return map
}

/**
 * 방향에 따른 이동 벡터
 */
function directionDelta(dir: Direction): [number, number] {
  switch (dir) {
    case 'up': return [-1, 0]
    case 'down': return [1, 0]
    case 'left': return [0, -1]
    case 'right': return [0, 1]
  }
}

/**
 * 행성 내에서 레이저가 어느 면에 부딪히는지에 따른 반사 방향 계산
 *
 * 각 행성 타입별 반사 규칙:
 * - small-red (1x1): 정사각형, 수직/수평 반사 (들어온 방향 반대로)
 * - large-red, large-blue (2x2): 다이아몬드, 직각 방향으로 반사
 * - yellow (3x3): 팔각형, 네 귀퉁이만 직각 반사
 * - large-white (4x2): 팔각형 반, 가장자리 두 귀퉁이만 직각 반사
 * - white-ring (4x2): 고리 부분은 직각 반사, 원 부분은 수직만 반사
 */
function reflect(
  row: number,
  col: number,
  direction: Direction,
  planet: Planet
): Direction | 'absorb' | 'pass' {
  const pr = row - planet.row
  const pc = col - planet.col
  const orientation = planet.orientation ?? 'horizontal'

  switch (planet.type) {
    case 'small-red':
      // 1x1 정사각형: 들어온 방향의 반대로 반사
      return reverseDirection(direction)

    case 'large-red':
    case 'large-blue':
      // 2x2 다이아몬드: 직각 방향으로 반사
      // 다이아몬드의 각 셀에 진입하는 방향에 따라 90도 꺾임
      return reflectDiamond(pr, pc, direction)

    case 'yellow':
      // 3x3 팔각형: 귀퉁이 셀만 반사, 나머지는 정면 반사
      return reflectOctagon3x3(pr, pc, direction)

    case 'large-white':
      // 4x2 팔각형 반: 곡면 쪽 두 귀퉁이만 직각 반사
      return reflectHalfOctagon(pr, pc, direction, orientation, planet.edgeSide)

    case 'white-ring':
      // 4x2 고리형
      return reflectRing(pr, pc, direction, orientation)

    default:
      return reverseDirection(direction)
  }
}

function reverseDirection(dir: Direction): Direction {
  switch (dir) {
    case 'up': return 'down'
    case 'down': return 'up'
    case 'left': return 'right'
    case 'right': return 'left'
  }
}

/**
 * 2x2 다이아몬드 반사
 * 다이아몬드 꼭짓점: 상(0,1), 우(1,2), 하(2,1), 좌(1,0) (2x2 좌표계)
 *
 *   [0,0] [0,1]
 *   [1,0] [1,1]
 *
 * 각 셀의 대각선 거울 방향:
 * - (0,0): 좌→상 면 = / 거울 → right→up, down→left
 * - (0,1): 상→우 면 = \ 거울 → left→up, down→right
 * - (1,0): 하→좌 면 = \ 거울 → right→down, up→left
 * - (1,1): 우→하 면 = / 거울 → left→down, up→right
 */
function reflectDiamond(pr: number, pc: number, direction: Direction): Direction | 'absorb' | 'pass' {
  if (pr === 0 && pc === 0) {
    // / 거울: right→up, down→left
    switch (direction) {
      case 'right': return 'up'
      case 'down': return 'left'
      case 'up': return 'pass'
      case 'left': return 'pass'
    }
  }
  if (pr === 0 && pc === 1) {
    // \ 거울: left→up, down→right
    switch (direction) {
      case 'left': return 'up'
      case 'down': return 'right'
      case 'up': return 'pass'
      case 'right': return 'pass'
    }
  }
  if (pr === 1 && pc === 0) {
    // \ 거울: right→down, up→left
    switch (direction) {
      case 'right': return 'down'
      case 'up': return 'left'
      case 'down': return 'pass'
      case 'left': return 'pass'
    }
  }
  if (pr === 1 && pc === 1) {
    // / 거울: left→down, up→right
    switch (direction) {
      case 'left': return 'down'
      case 'up': return 'right'
      case 'down': return 'pass'
      case 'right': return 'pass'
    }
  }
  return reverseDirection(direction)
}

/**
 * 3x3 팔각형 반사
 * 가운데 + 가장자리는 정면 반사, 네 귀퉁이만 직각 반사
 *
 *   [0,0]* [0,1] [0,2]*
 *   [1,0]  [1,1] [1,2]
 *   [2,0]* [2,1] [2,2]*
 *
 * 귀퉁이(*) 셀은 다이아몬드와 같은 방식으로 직각 반사
 * 비귀퉁이 셀은 정면 반사
 */
function reflectOctagon3x3(pr: number, pc: number, direction: Direction): Direction | 'absorb' | 'pass' {
  const isCorner =
    (pr === 0 && pc === 0) ||
    (pr === 0 && pc === 2) ||
    (pr === 2 && pc === 0) ||
    (pr === 2 && pc === 2)

  if (!isCorner) {
    return reverseDirection(direction)
  }

  // 귀퉁이 반사 (/ 또는 \ 거울)
  if (pr === 0 && pc === 0) {
    // / 거울: right→up, down→left
    switch (direction) {
      case 'right': return 'up'
      case 'down': return 'left'
      default: return 'pass'
    }
  }
  if (pr === 0 && pc === 2) {
    // \ 거울: left→up, down→right
    switch (direction) {
      case 'left': return 'up'
      case 'down': return 'right'
      default: return 'pass'
    }
  }
  if (pr === 2 && pc === 0) {
    // \ 거울: right→down, up→left
    switch (direction) {
      case 'right': return 'down'
      case 'up': return 'left'
      default: return 'pass'
    }
  }
  if (pr === 2 && pc === 2) {
    // / 거울: left→down, up→right
    switch (direction) {
      case 'left': return 'down'
      case 'up': return 'right'
      default: return 'pass'
    }
  }

  return reverseDirection(direction)
}

/**
 * 4x2 대형 흰색 행성 (팔각형 반) 반사
 * 직선 부분이 보드 가장자리에 접해야 함
 * 가장자리 두 귀퉁이만 직각 반사, 직선 부분은 정면 반사
 *
 * horizontal (4x2):
 *   [0,0]* [0,1] [0,2] [0,3]*
 *   [1,0]  [1,1] [1,2] [1,3]
 * 직선: row=0 또는 row=1 (보드 가장자리에 접하는 쪽)
 * 귀퉁이: 직선의 반대쪽 양 끝
 */
function reflectHalfOctagon(
  pr: number,
  pc: number,
  direction: Direction,
  orientation: 'horizontal' | 'vertical',
  edgeSide?: 'top' | 'bottom' | 'left' | 'right'
): Direction | 'absorb' | 'pass' {
  if (orientation === 'horizontal') {
    // 4열 x 2행
    // 곡면 쪽 양 끝 귀퉁이만 직각 반사, 직선(평면) 쪽은 정면 반사
    // edgeSide='top' → 직선이 row=0, 곡면이 row=1 → (1,0), (1,3)만 귀퉁이
    // edgeSide='bottom' → 직선이 row=1, 곡면이 row=0 → (0,0), (0,3)만 귀퉁이
    const curvedRow = edgeSide === 'top' ? 1 : 0

    if (pr === curvedRow && pc === 0) {
      // 곡면 왼쪽 귀퉁이
      if (curvedRow === 1) {
        // \ 거울 → right→down, up→left
        if (direction === 'right') return 'down'
        if (direction === 'up') return 'left'
      } else {
        // / 거울 → right→up, down→left
        if (direction === 'right') return 'up'
        if (direction === 'down') return 'left'
      }
    }
    if (pr === curvedRow && pc === 3) {
      // 곡면 오른쪽 귀퉁이
      if (curvedRow === 1) {
        // / 거울 → left→down, up→right
        if (direction === 'left') return 'down'
        if (direction === 'up') return 'right'
      } else {
        // \ 거울 → left→up, down→right
        if (direction === 'left') return 'up'
        if (direction === 'down') return 'right'
      }
    }

    return reverseDirection(direction)
  } else {
    // vertical: 2열 x 4행
    // edgeSide='left' → 직선이 col=0, 곡면이 col=1 → (0,1), (3,1)만 귀퉁이
    // edgeSide='right' → 직선이 col=1, 곡면이 col=0 → (0,0), (3,0)만 귀퉁이
    const curvedCol = edgeSide === 'left' ? 1 : 0

    if (pr === 0 && pc === curvedCol) {
      // 곡면 위쪽 귀퉁이
      if (curvedCol === 1) {
        // \ 거울 → down→right, left→up
        if (direction === 'down') return 'right'
        if (direction === 'left') return 'up'
      } else {
        // / 거울 → right→up, down→left
        if (direction === 'right') return 'up'
        if (direction === 'down') return 'left'
      }
    }
    if (pr === 3 && pc === curvedCol) {
      // 곡면 아래쪽 귀퉁이
      if (curvedCol === 1) {
        // / 거울 → up→right, left→down
        if (direction === 'up') return 'right'
        if (direction === 'left') return 'down'
      } else {
        // \ 거울 → right→down, up→left
        if (direction === 'right') return 'down'
        if (direction === 'up') return 'left'
      }
    }

    return reverseDirection(direction)
  }
}

/**
 * 4x2 흰색 고리 행성 반사
 * 고리 부분은 다이아몬드처럼 직각 반사
 * 원 부분은 수직 방향으로만 반사, 수평은 통과
 *
 * horizontal (4x2):
 *   [0,0]ring [0,1]circle [0,2]circle [0,3]ring
 *   [1,0]ring [1,1]circle [1,2]circle [1,3]ring
 *
 * 원 부분(가운데 2x2): 정마름모꼴 = 다이아몬드처럼 직각 반사
 * 고리 부분(양 끝): 수직→반사, 수평→통과 (horizontal 기준)
 */
function reflectRing(
  pr: number,
  pc: number,
  direction: Direction,
  orientation: 'horizontal' | 'vertical'
): Direction | 'absorb' | 'pass' {
  if (orientation === 'horizontal') {
    // 고리: pc=0, pc=3 / 원: pc=1, pc=2
    const isRing = pc === 0 || pc === 3

    if (isRing) {
      // 고리 부분: 세로(up/down) → 정면 반사, 가로(left/right) → 통과
      if (direction === 'up' || direction === 'down') {
        return reverseDirection(direction)
      }
      return 'pass'
    } else {
      // 원 부분: 다이아몬드 반사 (2x2 다이아몬드와 동일)
      // pc=1,2 → 다이아몬드 내 dc=0,1
      const dc = pc - 1
      return reflectDiamond(pr, dc, direction)
    }
  } else {
    // vertical: 2x4, 고리: pr=0, pr=3 / 원: pr=1, pr=2
    const isRing = pr === 0 || pr === 3

    if (isRing) {
      // 고리 부분: 가로(left/right) → 정면 반사, 세로(up/down) → 통과
      if (direction === 'left' || direction === 'right') {
        return reverseDirection(direction)
      }
      return 'pass'
    } else {
      // 원 부분: 다이아몬드 반사
      // pr=1,2 → 다이아몬드 내 dr=0,1
      const dr = pr - 1
      return reflectDiamond(dr, pc, direction)
    }
  }
}

/**
 * 레이저 색상 혼합
 * 같은 색을 여러 번 만나도 1번만 카운트
 */
export function mixColors(hitColors: Set<string>): LaserColor {
  if (hitColors.size === 0) return 'transparent'

  const hasRed = hitColors.has('red')
  const hasBlue = hitColors.has('blue')
  const hasYellow = hitColors.has('yellow')
  const hasWhite = hitColors.has('white')

  const colorCount = (hasRed ? 1 : 0) + (hasBlue ? 1 : 0) + (hasYellow ? 1 : 0)

  // 4색 전부
  if (colorCount === 3 && hasWhite) return 'gray'

  // 3색
  if (hasRed && hasYellow && hasBlue) return 'black'

  // 2색 + 흰색
  if (hasRed && hasYellow && hasWhite) return 'light-orange'
  if (hasRed && hasBlue && hasWhite) return 'light-purple'
  if (hasYellow && hasBlue && hasWhite) return 'light-green'

  // 2색
  if (hasRed && hasYellow) return 'orange'
  if (hasRed && hasBlue) return 'purple'
  if (hasYellow && hasBlue) return 'green'

  // 1색 + 흰색
  if (hasRed && hasWhite) return 'pink'
  if (hasYellow && hasWhite) return 'lemon'
  if (hasBlue && hasWhite) return 'skyblue'

  // 1색만
  if (hasRed) return 'red'
  if (hasBlue) return 'blue'
  if (hasYellow) return 'yellow'
  if (hasWhite) return 'white'

  return 'transparent'
}

/**
 * 블랙홀 인접 감지
 * 현재 셀의 수직 방향(이동 방향에 대해)에 블랙홀이 있는지 확인
 * 있으면 블랙홀 방향을 반환 (아직 꺾지 않음 - 다음 칸에서 꺾어야 함)
 */
function detectAdjacentBlackhole(
  row: number,
  col: number,
  direction: Direction,
  planetMap: Map<string, Planet>,
  refractedBy: Set<string>
): Direction | null {
  const perpendiculars: [number, number][] =
    direction === 'up' || direction === 'down'
      ? [[row, col - 1], [row, col + 1]]
      : [[row - 1, col], [row + 1, col]]

  for (const [nr, nc] of perpendiculars) {
    if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue
    const neighbor = planetMap.get(`${nr},${nc}`)
    if (neighbor?.type === 'blackhole') {
      const bhKey = `${nr},${nc}`
      if (refractedBy.has(bhKey)) continue
      refractedBy.add(bhKey)
      if (nr < row) return 'up'
      if (nr > row) return 'down'
      if (nc < col) return 'left'
      if (nc > col) return 'right'
    }
  }
  return null
}

/**
 * 레이저 발사 시뮬레이션
 *
 * 블랙홀 굴절: 블랙홀 옆을 "지난 후" 꺾임
 * 1. 블랙홀 옆 셀 진입 → 감지하지만 아직 안 꺾음 (pendingRefraction에 저장)
 * 2. 다음 칸으로 이동 → 이동 후 pendingRefraction 적용하여 방향 변경
 */
export function fireLaser(label: string, planets: Planet[]): LaserResult {
  const entry = parseFirePoint(label)
  if (!entry) {
    return { exitPoint: null, color: 'transparent', path: [] }
  }

  const planetMap = buildPlanetMap(planets)
  const hitColors = new Set<string>()
  const path: LaserStep[] = []
  const refractedBy = new Set<string>()
  const maxSteps = 200

  let { row, col, direction } = entry
  let pendingRefraction: Direction | null = null

  for (let step = 0; step < maxSteps; step++) {
    const [dr, dc] = directionDelta(direction)
    row += dr
    col += dc

    // 보드 밖으로 나감
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      const exitLabel = toExitLabel(row, col, direction)
      return { exitPoint: exitLabel, color: mixColors(hitColors), path }
    }

    path.push({ row, col, direction })

    // 지난 칸에서 감지한 블랙홀 굴절 적용 (지나간 후 꺾기)
    if (pendingRefraction) {
      direction = pendingRefraction
      pendingRefraction = null
    }

    // 행성/블랙홀 직접 충돌 체크
    const planet = planetMap.get(`${row},${col}`)
    if (planet) {
      if (planet.type === 'blackhole') {
        return { exitPoint: '소멸', color: mixColors(hitColors), path }
      }

      hitColors.add(planet.color)

      const result = reflect(row, col, direction, planet)
      if (result === 'absorb') {
        return { exitPoint: null, color: mixColors(hitColors), path }
      }
      if (result === 'pass') {
        // 통과 후 블랙홀 인접 감지 (다음 칸에서 꺾임)
        pendingRefraction = detectAdjacentBlackhole(row, col, direction, planetMap, refractedBy)
        continue
      }
      // 반사로 방향 바뀌면 pending 초기화
      direction = result
      pendingRefraction = null
    } else {
      // 빈 칸: 블랙홀 인접 감지 (다음 칸에서 꺾임)
      pendingRefraction = detectAdjacentBlackhole(row, col, direction, planetMap, refractedBy)
    }
  }

  return { exitPoint: '갇힘', color: mixColors(hitColors), path }
}
