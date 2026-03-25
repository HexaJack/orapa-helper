import './ColorTable.css'

interface ComboEntry {
  inputs: { color: string; label: string }[]
  result: { color: string; label: string }
}

const COLORS: Record<string, string> = {
  red: '#e94560',
  yellow: '#eab308',
  blue: '#3b82f6',
  white: '#ffffff',
  orange: '#f97316',
  purple: '#a855f7',
  green: '#22c55e',
  pink: '#f9a8d4',
  lemon: '#fef08a',
  skyblue: '#7dd3fc',
  'light-orange': '#fdba74',
  'light-purple': '#d8b4fe',
  'light-green': '#bbf7d0',
  black: '#1f2937',
  gray: '#9ca3af',
}

const TWO_COLOR: ComboEntry[] = [
  { inputs: [{ color: 'red', label: '빨강' }, { color: 'yellow', label: '노랑' }], result: { color: 'orange', label: '주황' } },
  { inputs: [{ color: 'red', label: '빨강' }, { color: 'blue', label: '파랑' }], result: { color: 'purple', label: '보라' } },
  { inputs: [{ color: 'yellow', label: '노랑' }, { color: 'blue', label: '파랑' }], result: { color: 'green', label: '초록' } },
]

const WHITE_MIX: ComboEntry[] = [
  { inputs: [{ color: 'red', label: '빨강' }, { color: 'white', label: '흰' }], result: { color: 'pink', label: '핑크' } },
  { inputs: [{ color: 'yellow', label: '노랑' }, { color: 'white', label: '흰' }], result: { color: 'lemon', label: '레몬' } },
  { inputs: [{ color: 'blue', label: '파랑' }, { color: 'white', label: '흰' }], result: { color: 'skyblue', label: '하늘' } },
]

const THREE_COLOR: ComboEntry[] = [
  { inputs: [{ color: 'red', label: '빨강' }, { color: 'yellow', label: '노랑' }, { color: 'white', label: '흰' }], result: { color: 'light-orange', label: '연주황' } },
  { inputs: [{ color: 'red', label: '빨강' }, { color: 'blue', label: '파랑' }, { color: 'white', label: '흰' }], result: { color: 'light-purple', label: '연보라' } },
  { inputs: [{ color: 'yellow', label: '노랑' }, { color: 'blue', label: '파랑' }, { color: 'white', label: '흰' }], result: { color: 'light-green', label: '연초록' } },
  { inputs: [{ color: 'red', label: '빨강' }, { color: 'yellow', label: '노랑' }, { color: 'blue', label: '파랑' }], result: { color: 'black', label: '검정' } },
  { inputs: [{ color: 'red', label: '빨강' }, { color: 'yellow', label: '노랑' }, { color: 'blue', label: '파랑' }, { color: 'white', label: '흰' }], result: { color: 'gray', label: '회색' } },
]

function ComboRow({ entry }: { entry: ComboEntry }) {
  return (
    <div className="color-combo">
      {entry.inputs.map((input, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="combo-plus">+</span>}
          <span className="combo-dot" style={{ backgroundColor: COLORS[input.color] }} />
        </span>
      ))}
      <span className="combo-eq">=</span>
      <span className="combo-dot" style={{ backgroundColor: COLORS[entry.result.color] }} />
      <span className="combo-name">{entry.result.label}</span>
    </div>
  )
}

function ComboSection({ title, entries }: { title: string; entries: ComboEntry[] }) {
  return (
    <>
      <h3>{title}</h3>
      <div className="color-combo-list">
        {entries.map((entry, i) => (
          <ComboRow key={i} entry={entry} />
        ))}
      </div>
    </>
  )
}

export default function ColorTable() {
  return (
    <div className="color-table">
      <h2>색 조합표</h2>
      <ComboSection title="2색 혼합" entries={TWO_COLOR} />
      <ComboSection title="흰색 혼합" entries={WHITE_MIX} />
      <ComboSection title="3색 이상 혼합" entries={THREE_COLOR} />
    </div>
  )
}
