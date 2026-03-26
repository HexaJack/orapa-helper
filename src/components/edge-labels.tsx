import { TOP_LABELS, RIGHT_LABELS, LEFT_LABELS, BOTTOM_LABELS } from '../game/constants'

interface Props {
  onFire: (label: string) => void
  getEdgeClass: (label: string) => string
}

export function TopLabels({ onFire, getEdgeClass }: Props) {
  return (
    <div className="edge-labels top">
      <div className="corner" />
      {TOP_LABELS.map((label) => (
        <button key={`top-${label}`} className={getEdgeClass(label)}
          onClick={() => onFire(label)}>{label}</button>
      ))}
      <div className="corner" />
    </div>
  )
}

export function BottomLabels({ onFire, getEdgeClass }: Props) {
  return (
    <div className="edge-labels bottom">
      <div className="corner" />
      {BOTTOM_LABELS.map((label) => (
        <button key={`bottom-${label}`} className={getEdgeClass(label)}
          onClick={() => onFire(label)}>{label}</button>
      ))}
      <div className="corner" />
    </div>
  )
}

export function LeftLabels({ onFire, getEdgeClass }: Props) {
  return (
    <div className="edge-labels left">
      {LEFT_LABELS.map((label) => (
        <button key={`left-${label}`} className={getEdgeClass(label)}
          onClick={() => onFire(label)}>{label}</button>
      ))}
    </div>
  )
}

export function RightLabels({ onFire, getEdgeClass }: Props) {
  return (
    <div className="edge-labels right">
      {RIGHT_LABELS.map((label) => (
        <button key={`right-${label}`} className={getEdgeClass(label)}
          onClick={() => onFire(label)}>{label}</button>
      ))}
    </div>
  )
}
