import { useState } from 'react'
import { GameSelect } from './screens/GameSelect.jsx'
import { GameView } from './screens/GameView.jsx'

// Top-level router. Two states: pick a game, or view the one you picked.
// Deliberately no persistence — every screen is spoiler-safe by construction
// and there's nothing worth storing.
export default function App() {
  const [game, setGame] = useState(null)

  return (
    <div className="app">
      {game ? (
        <GameView game={game} onBack={() => setGame(null)} />
      ) : (
        <GameSelect onPick={setGame} />
      )}
    </div>
  )
}
