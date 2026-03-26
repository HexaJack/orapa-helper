import { useRef, useEffect } from 'react'
import type { LaserResult, LaserColor } from '../game/laser'
import { LASER_COLOR_MAP, LASER_COLOR_NAME_KR } from '../game/constants'

interface HistoryEntry {
  label: string
  result: LaserResult
}

interface Props {
  lastResult: LaserResult | null
  history: HistoryEntry[]
  selectedHistoryIdx: number | null
  placingMode: boolean
  onHistoryClick: (idx: number) => void
}

export default function ResultPanel({
  lastResult, history, selectedHistoryIdx, placingMode, onHistoryClick,
}: Props) {
  const historyListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (historyListRef.current) {
      historyListRef.current.scrollTop = historyListRef.current.scrollHeight
    }
  }, [history.length])

  return (
    <>
      {lastResult && !placingMode && (
        <div className="last-result">
          {selectedHistoryIdx !== null && (
            <div className="result-row">
              <span className="result-label">#{selectedHistoryIdx + 1}</span>
              <span className="result-value">발사: {history[selectedHistoryIdx]?.label}</span>
            </div>
          )}
          <div className="result-row">
            <span className="result-label">결과:</span>
            <span className="result-value">
              {lastResult.exitPoint === '소멸' ? '소멸되었습니다'
                : lastResult.exitPoint === '갇힘' ? '레이저가 갇혔습니다'
                  : `나간 지점: ${lastResult.exitPoint}`}
            </span>
          </div>
          {lastResult.exitPoint !== '소멸' && (
            <div className="result-row">
              <span className="result-label">레이저 색:</span>
              <span className="result-value">
                <span className="color-dot" style={{ backgroundColor: LASER_COLOR_MAP[lastResult.color] }} />
                {LASER_COLOR_NAME_KR[lastResult.color]}
              </span>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="history">
          <h3>발사 기록</h3>
          <div className="history-list" ref={historyListRef}>
            {history.map((entry, i) => (
              <HistoryItem
                key={i}
                entry={entry}
                index={i}
                isSelected={selectedHistoryIdx === i}
                onClick={() => onHistoryClick(i)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function HistoryItem({ entry, index, isSelected, onClick }: {
  entry: HistoryEntry; index: number; isSelected: boolean; onClick: () => void
}) {
  const isSomel = entry.result.exitPoint === '소멸'
  const isTrapped = entry.result.exitPoint === '갇힘'
  return (
    <div
      className={`history-item${isSelected ? ' history-selected' : ''}`}
      onClick={onClick}
    >
      <span className="history-number">{index + 1}.</span>
      <span className="history-label">발사: {entry.label}</span>
      <span className="history-arrow">→</span>
      <span className="history-exit">
        {isSomel ? '소멸' : isTrapped ? '갇힘' : entry.result.exitPoint}
      </span>
      {!isSomel && (
        <>
          <span className="history-divider">|</span>
          <span className="color-dot" style={{ backgroundColor: LASER_COLOR_MAP[entry.result.color as LaserColor] }} />
          <span className="history-color">{LASER_COLOR_NAME_KR[entry.result.color as LaserColor]}</span>
        </>
      )}
    </div>
  )
}
