// Harness only (not product code): the real FilmRoom on the real sheets, fed the real meetings.
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import '../../src/styles/worldseries/home.css'
import meetings from '../ws-scouting/meetings.json'
import { FilmRoom } from '../../src/components/worldseries/cards/scouting/FilmRoom.jsx'
const compact = new URLSearchParams(location.search).get('day') === 'game'
createRoot(document.getElementById('root')).render(
  <main style={{ padding: 16, maxWidth: 740 }}><FilmRoom meetings={meetings} compact={compact} clubId={158} /></main>,
)
