export const GRID_SIZE = 9

export type GameMode = 'basic' | 'blackhole'

export type PlanetColor = 'white' | 'red' | 'blue' | 'yellow' | 'black'

export type PlanetType =
  | 'large-white'   // 4x2, 팔각형 반, 보드 가장자리에 직선부분 접해야 함
  | 'small-red'     // 1x1, 정사각형
  | 'large-red'     // 2x2, 다이아몬드
  | 'large-blue'    // 2x2, 다이아몬드
  | 'yellow'        // 3x3, 팔각형
  | 'white-ring'    // 4x2, 고리형, 수평/수직만 배치 가능
  | 'blackhole'     // 1x1, 블랙홀 (반사X, 직접맞으면 소멸, 인접시 굴절)

export interface Planet {
  type: PlanetType
  color: PlanetColor
  // 행성이 차지하는 영역의 좌상단 좌표
  row: number
  col: number
  // white-ring과 large-white의 방향
  orientation?: 'horizontal' | 'vertical'
  // large-white의 직선 부분이 접하는 보드 가장자리 방향
  edgeSide?: 'top' | 'bottom' | 'left' | 'right'
}

export interface PlanetDef {
  type: PlanetType
  color: PlanetColor
  width: number
  height: number
  // 보드 가장자리 접촉 필요 여부
  needsEdge: boolean
  // 방향 전환 가능 여부
  canRotate: boolean
}

// 기본 행성 6개
export const PLANET_DEFS: PlanetDef[] = [
  { type: 'large-white', color: 'white', width: 4, height: 2, needsEdge: true, canRotate: true },
  { type: 'small-red', color: 'red', width: 1, height: 1, needsEdge: false, canRotate: false },
  { type: 'large-red', color: 'red', width: 2, height: 2, needsEdge: false, canRotate: false },
  { type: 'large-blue', color: 'blue', width: 2, height: 2, needsEdge: false, canRotate: false },
  { type: 'yellow', color: 'yellow', width: 3, height: 3, needsEdge: false, canRotate: false },
  { type: 'white-ring', color: 'white', width: 4, height: 2, needsEdge: false, canRotate: true },
]

// 블랙홀 확장 시 추가되는 조각
export const BLACKHOLE_DEFS: PlanetDef[] = [
  { type: 'blackhole', color: 'black', width: 1, height: 1, needsEdge: false, canRotate: false },
]

// 보드의 각 셀 상태
export type CellState = null | PlanetType
