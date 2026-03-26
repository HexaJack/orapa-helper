import type { Planet } from '../game/types'

interface Props {
  planets: Planet[]
  visible: boolean
  cellSize: number
}

export default function PlanetOverlay({ planets, visible, cellSize }: Props) {
  if (!visible) return null
  const S = cellSize

  return (
    <svg
      className="planet-overlay"
      width={S * 9}
      height={S * 9}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {planets.map((planet, i) => (
        <PlanetShape key={i} planet={planet} S={S} />
      ))}
    </svg>
  )
}

function PlanetShape({ planet, S }: { planet: Planet; S: number }) {
  const ox = planet.col * S
  const oy = planet.row * S
  const o = planet.orientation ?? 'horizontal'

  switch (planet.type) {
    case 'small-red':
      return <SmallRed x={ox} y={oy} S={S} />
    case 'large-red':
      return <Diamond x={ox} y={oy} S={S} color="#e94560" />
    case 'large-blue':
      return <Diamond x={ox} y={oy} S={S} color="#3b82f6" />
    case 'yellow':
      return <Octagon x={ox} y={oy} S={S} />
    case 'large-white':
      return <HalfOctagon x={ox} y={oy} S={S} orientation={o} edgeSide={planet.edgeSide ?? 'top'} />
    case 'white-ring':
      return <WhiteRing x={ox} y={oy} S={S} orientation={o} />
    case 'blackhole':
      return <BlackHole x={ox} y={oy} S={S} />
    default:
      return null
  }
}

function SmallRed({ x, y, S }: { x: number; y: number; S: number }) {
  const pad = 3
  return <rect x={x + pad} y={y + pad} width={S - pad * 2} height={S - pad * 2} fill="#e94560" rx={2} />
}

function Diamond({ x, y, S, color }: { x: number; y: number; S: number; color: string }) {
  const s = S * 2
  const cx = x + s / 2, cy = y + s / 2, r = s / 2 - 3
  return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={color} />
}

function Octagon({ x, y, S }: { x: number; y: number; S: number }) {
  const s = S * 3, pad = 3, cut = S - pad
  const x0 = x + pad, y0 = y + pad, w = s - pad * 2, h = s - pad * 2
  return (
    <polygon
      points={`
        ${x0 + cut},${y0} ${x0 + w - cut},${y0}
        ${x0 + w},${y0 + cut} ${x0 + w},${y0 + h - cut}
        ${x0 + w - cut},${y0 + h} ${x0 + cut},${y0 + h}
        ${x0},${y0 + h - cut} ${x0},${y0 + cut}
      `}
      fill="#eab308"
    />
  )
}

function HalfOctagon({ x, y, S, orientation, edgeSide }: {
  x: number; y: number; S: number
  orientation: 'horizontal' | 'vertical'
  edgeSide: 'top' | 'bottom' | 'left' | 'right'
}) {
  const pad = 3, cut = S - pad
  if (orientation === 'horizontal') {
    const w = S * 4 - pad * 2, h = S * 2 - pad * 2, x0 = x + pad, y0 = y + pad
    if (edgeSide === 'top') {
      return <polygon points={`${x0},${y0} ${x0 + w},${y0} ${x0 + w},${y0 + h - cut} ${x0 + w - cut},${y0 + h} ${x0 + cut},${y0 + h} ${x0},${y0 + h - cut}`} fill="#e8e8e8" />
    } else {
      return <polygon points={`${x0 + cut},${y0} ${x0 + w - cut},${y0} ${x0 + w},${y0 + cut} ${x0 + w},${y0 + h} ${x0},${y0 + h} ${x0},${y0 + cut}`} fill="#e8e8e8" />
    }
  } else {
    const w = S * 2 - pad * 2, h = S * 4 - pad * 2, x0 = x + pad, y0 = y + pad
    if (edgeSide === 'left') {
      return <polygon points={`${x0},${y0} ${x0 + w - cut},${y0} ${x0 + w},${y0 + cut} ${x0 + w},${y0 + h - cut} ${x0 + w - cut},${y0 + h} ${x0},${y0 + h}`} fill="#e8e8e8" />
    } else {
      return <polygon points={`${x0 + cut},${y0} ${x0 + w},${y0} ${x0 + w},${y0 + h} ${x0 + w - cut},${y0 + h} ${x0},${y0 + h - cut} ${x0},${y0 + cut}`} fill="#e8e8e8" />
    }
  }
}

function WhiteRing({ x, y, S, orientation }: {
  x: number; y: number; S: number
  orientation: 'horizontal' | 'vertical'
}) {
  const pad = 3, barH = S * 0.28
  if (orientation === 'horizontal') {
    const cx = x + S * 2, cy = y + S, dr = S - pad
    const barLeft = x + pad, barRight = x + S * 4 - pad
    return (
      <g>
        <path d={`M ${barLeft},${cy - barH} L ${cx},${cy - barH} L ${cx},${cy - dr} L ${cx + dr},${cy} L ${cx},${cy + dr} L ${cx},${cy + barH} L ${barLeft},${cy + barH} Z`} fill="#d4d4d4" stroke="#aaa" strokeWidth={0.5} />
        <path d={`M ${barRight},${cy - barH} L ${cx},${cy - barH} L ${cx},${cy - dr} L ${cx - dr},${cy} L ${cx},${cy + dr} L ${cx},${cy + barH} L ${barRight},${cy + barH} Z`} fill="#d4d4d4" stroke="#aaa" strokeWidth={0.5} />
        <line x1={cx} y1={cy - dr} x2={cx} y2={cy + dr} stroke="#aaa" strokeWidth={0.5} />
        <line x1={cx - dr} y1={cy} x2={cx + dr} y2={cy} stroke="#aaa" strokeWidth={0.5} />
      </g>
    )
  } else {
    const cx = x + S, cy = y + S * 2, dr = S - pad
    const barTop = y + pad, barBottom = y + S * 4 - pad
    return (
      <g>
        <path d={`M ${cx - barH},${barTop} L ${cx + barH},${barTop} L ${cx + barH},${cy} L ${cx + dr},${cy} L ${cx},${cy - dr} L ${cx - dr},${cy} L ${cx - barH},${cy} Z`} fill="#d4d4d4" stroke="#aaa" strokeWidth={0.5} />
        <path d={`M ${cx - barH},${barBottom} L ${cx + barH},${barBottom} L ${cx + barH},${cy} L ${cx + dr},${cy} L ${cx},${cy + dr} L ${cx - dr},${cy} L ${cx - barH},${cy} Z`} fill="#d4d4d4" stroke="#aaa" strokeWidth={0.5} />
        <line x1={cx} y1={cy - dr} x2={cx} y2={cy + dr} stroke="#aaa" strokeWidth={0.5} />
        <line x1={cx - dr} y1={cy} x2={cx + dr} y2={cy} stroke="#aaa" strokeWidth={0.5} />
      </g>
    )
  }
}

function BlackHole({ x, y, S }: { x: number; y: number; S: number }) {
  const cx = x + S / 2, cy = y + S / 2, r = S / 2 - 3
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#111" />
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="#444" strokeWidth={1} />
    </g>
  )
}
