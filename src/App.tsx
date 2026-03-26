import './App.css'
import GameBoard from './components/game-board'
import ColorTable from './components/color-table'

function App() {
  return (
    <div className="app">
      <h1>Orapa Space</h1>
      <div className="app-layout">
        <GameBoard />
        <ColorTable />
      </div>
    </div>
  )
}

export default App
