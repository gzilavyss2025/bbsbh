import { useState } from 'react'
import { GameSelect } from './screens/GameSelect.jsx'
import { GameView } from './screens/GameView.jsx'
import { LogoSheet } from './screens/LogoSheet.jsx'

// Top-level router. Three states: pick a game, view the one you picked, or open
// the printable logo sheet. Deliberately no persistence — every screen is
// spoiler-safe by construction and there's nothing worth storing.
export default function App() {
  const [game, setGame] = useState(null)
  const [showLogos, setShowLogos] = useState(false)
  const [logoOffset, setLogoOffset] = useState(0) // days from today

  if (game) {
    return (
      <div className="app">
        <GameView game={game} onBack={() => setGame(null)} />
      </div>
    )
  }

  if (showLogos) {
    return (
      <div className="app">
        <LogoSheet
          offset={logoOffset}
          onOffset={setLogoOffset}
          onBack={() => setShowLogos(false)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <GameSelect onPick={setGame} onShowLogos={() => setShowLogos(true)} />
    </div>
  )
}
