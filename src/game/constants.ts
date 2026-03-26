import type { LaserColor } from './laser'
import type { PlanetType } from './types'
import { GRID_SIZE } from './types'

export const TOP_LABELS = Array.from({ length: GRID_SIZE }, (_, i) => String(i + 1))
export const RIGHT_LABELS = Array.from({ length: GRID_SIZE }, (_, i) => String(i + 10))
export const LEFT_LABELS = Array.from({ length: GRID_SIZE }, (_, i) =>
  String.fromCharCode(65 + i)
)
export const BOTTOM_LABELS = Array.from({ length: GRID_SIZE }, (_, i) =>
  String.fromCharCode(74 + i)
)

export const LASER_COLOR_MAP: Record<LaserColor, string> = {
  'transparent': '#ffffff', 'white': '#ffffff', 'red': '#e94560',
  'blue': '#3b82f6', 'yellow': '#eab308', 'orange': '#f97316',
  'purple': '#a855f7', 'green': '#22c55e', 'pink': '#f9a8d4',
  'lemon': '#fef08a', 'skyblue': '#7dd3fc', 'light-orange': '#fdba74',
  'light-purple': '#d8b4fe', 'light-green': '#bbf7d0',
  'black': '#1f2937', 'gray': '#9ca3af',
}

export const LASER_COLOR_NAME_KR: Record<LaserColor, string> = {
  'transparent': '투명', 'white': '흰색', 'red': '빨간색',
  'blue': '파란색', 'yellow': '노란색', 'orange': '주황색',
  'purple': '보라색', 'green': '초록색', 'pink': '핑크색',
  'lemon': '레몬색', 'skyblue': '하늘색', 'light-orange': '연주황색',
  'light-purple': '연보라색', 'light-green': '연초록색',
  'black': '검정색', 'gray': '회색',
}

export const PIECE_NAMES: Record<PlanetType, string> = {
  'large-white': '대형 흰색', 'small-red': '소형 빨강', 'large-red': '대형 빨강',
  'large-blue': '대형 파랑', 'yellow': '노랑', 'white-ring': '토성',
  'blackhole': '블랙홀',
}
