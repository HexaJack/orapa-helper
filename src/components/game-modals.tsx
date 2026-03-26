interface ConfirmRevealProps {
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmRevealModal({ onCancel, onConfirm }: ConfirmRevealProps) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-modal">
        <p>정답이 공개됩니다. 계속하시겠습니까?</p>
        <div className="confirm-buttons">
          <button className="btn" onClick={onCancel}>취소</button>
          <button className="btn btn-new" onClick={onConfirm}>공개</button>
        </div>
      </div>
    </div>
  )
}

interface ConfirmNewGameProps {
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmNewGameModal({ onCancel, onConfirm }: ConfirmNewGameProps) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-modal">
        <p>게임이 진행 중입니다. 새 게임을 시작하시겠습니까?</p>
        <div className="confirm-buttons">
          <button className="btn" onClick={onCancel}>취소</button>
          <button className="btn btn-new" onClick={onConfirm}>새 게임</button>
        </div>
      </div>
    </div>
  )
}

interface FinishFormProps {
  type: 'success' | 'fail'
  shotCount: number
  winnerName: string
  onNameChange: (name: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function FinishForm({
  type, shotCount, winnerName, onNameChange, onCancel, onConfirm,
}: FinishFormProps) {
  return (
    <div className={`finish-form ${type === 'success' ? 'finish-success' : 'finish-fail'}`}>
      <h3>{type === 'success' ? '🎉 정답입니다!' : '❌ 틀렸습니다!'}</h3>
      <p className="finish-desc">
        {type === 'success'
          ? `${shotCount}회 발사로 정답을 맞췄습니다!`
          : '정답이 공개되었습니다.'}
      </p>
      <input type="text" className="winner-input"
        placeholder={type === 'success' ? '우승자 이름 입력' : '이름 입력 (선택)'}
        value={winnerName} onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onConfirm()} autoFocus />
      <div className="finish-form-buttons">
        <button className="btn" onClick={onCancel}>취소</button>
        <button className="btn btn-finish" onClick={onConfirm}>저장</button>
      </div>
    </div>
  )
}
