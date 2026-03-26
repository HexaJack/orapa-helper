import type { PlanetDef, PlanetType } from '../game/types'
import { getPlanetSvgPath } from '../game/planetSvg'
import { PIECE_NAMES } from '../game/constants'

interface Props {
  availableCounts: Record<string, number>
  placedCounts: Record<string, number>
  availablePieces: PlanetDef[]
  selectedPiece: PlanetDef | null
  orientation: 'horizontal' | 'vertical'
  onSelectPiece: (def: PlanetDef | null) => void
  onRemovePlaced: (type: PlanetType) => void
  onToggleOrientation: () => void
}

export default function PieceTray({
  availableCounts, placedCounts, availablePieces,
  selectedPiece, orientation, onSelectPiece, onRemovePlaced, onToggleOrientation,
}: Props) {
  return (
    <div className="piece-tray">
      {Object.entries(availableCounts).map(([type, count]) => {
        const def = availablePieces.find((d) => d.type === type)!
        const used = placedCounts[type] || 0
        const remaining = count - used
        const isSelected = selectedPiece?.type === type
        const isPlaced = used > 0

        const handleClick = () => {
          if (isPlaced && remaining <= 0) {
            // 배치 완료 → 탭하면 마지막 배치 제거
            onRemovePlaced(type as PlanetType)
          } else if (remaining > 0) {
            // 미배치 → 선택/해제
            onSelectPiece(isSelected ? null : def)
          }
        }

        return (
          <button
            key={type}
            className={`piece-btn${isSelected ? ' selected' : ''}${isPlaced && remaining <= 0 ? ' placed' : ''}${!isPlaced && remaining <= 0 ? ' used' : ''}`}
            onClick={handleClick}
          >
            <img
              src={getPlanetSvgPath(type as PlanetType, 'horizontal', 'top')}
              alt={PIECE_NAMES[type as PlanetType]}
              className="piece-icon"
            />
            <span className="piece-name">{PIECE_NAMES[type as PlanetType]}</span>
            <span className="piece-count">
              {isPlaced && remaining <= 0 ? '배치됨' : `${remaining}/${count}`}
            </span>
          </button>
        )
      })}
      {selectedPiece?.canRotate && (
        <button className="btn rotate-btn" onClick={onToggleOrientation}>
          배치: {orientation === 'horizontal' ? '가로' : '세로'}
        </button>
      )}
    </div>
  )
}
