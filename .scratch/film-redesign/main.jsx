// Harness only (not product code): the real FilmRoom on the real sheets, fed the real fetchMeetings read.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import '../../src/styles/worldseries/home.css'
import { fetchMeetings } from '../../src/api/postseason/meetings.js'
import { FilmRoom } from '../../src/components/worldseries/cards/scouting/FilmRoom.jsx'
const compact = new URLSearchParams(location.search).get('day') === 'game'
function App() {
  const [meetings, set] = useState(null)
  useEffect(() => { fetchMeetings({ clubA: 158, clubB: 139, slateDate: '2026-10-22' }).then((m) => { if (new URLSearchParams(location.search).get('nostarter')) m[0].home.starter.id = null; set(m) }) }, [])
  return <main style={{ padding: 16, maxWidth: 740 }}>{meetings && <FilmRoom meetings={meetings} compact={compact} clubId={158} />}</main>
}
createRoot(document.getElementById('root')).render(<App />)
