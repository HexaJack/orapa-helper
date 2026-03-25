import './App.css'
import Board from './components/Board'
import ColorTable from './components/ColorTable'

function App() {
  return (
    <div className="app">
      <h1>Orapa Space</h1>
      <div className="app-layout">
        <Board />
        <ColorTable />
      </div>
    </div>
  )
}

export default App
