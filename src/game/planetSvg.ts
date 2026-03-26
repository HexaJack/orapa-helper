import type { PlanetType } from './types'

/**
 * 행성 타입과 방향에 맞는 SVG 경로를 반환
 */
export function getPlanetSvgPath(
  type: PlanetType,
  orientation?: 'horizontal' | 'vertical',
  edgeSide?: 'top' | 'bottom' | 'left' | 'right'
): string {
  const base = '/planets'

  switch (type) {
    case 'small-red':
      return `${base}/small-red.svg`
    case 'large-red':
      return `${base}/large-red.svg`
    case 'large-blue':
      return `${base}/large-blue.svg`
    case 'yellow':
      return `${base}/yellow.svg`
    case 'blackhole':
      return `${base}/blackhole.svg`
    case 'large-white':
      return `${base}/large-white-${edgeSide ?? 'top'}.svg`
    case 'white-ring':
      return `${base}/white-ring-${orientation === 'vertical' ? 'v' : 'h'}.svg`
    default:
      return `${base}/small-red.svg`
  }
}

/**
 * 행성 한국어 이름
 */
export function getPlanetName(type: PlanetType): string {
  const names: Record<PlanetType, string> = {
    'small-red': '소행성 (빨강)',
    'large-red': '화성 (빨강)',
    'large-blue': '해왕성 (파랑)',
    'yellow': '목성 (노랑)',
    'large-white': '달 (흰색)',
    'white-ring': '토성 (흰색)',
    'blackhole': '블랙홀',
  }
  return names[type]
}
