import '../../../../styles/worldseries/film.css'
import { filmRoomModel, filmRoomNote } from '../../../../lib/postseason/worldseries/scouting/filmRoom.js'
import { SectionHead } from '../../../ui/frame/SectionHead.jsx'
import { Stack } from '../../../ui/layout/Stack.jsx'
import { FilmMeeting } from './FilmMeeting.jsx'

// FILM ROOM (#2316): one stamped card per regular-season meeting of the two Series clubs, oldest
// first, one column on a phone and two across from 740px. Off day: full cards (line score,
// pitching, scoring, lineups). Game day: compact cards (line score, decisions, Box score door). The meetings are past games (cutoff:
// the day before the slate date, ADR-0087 and the ADR-0117 addendum), so nothing here is sealed.
// Imports no reveal-only module. Draws nothing for zero meetings.
export function FilmRoom({ meetings, compact, clubId }) {
  const list = filmRoomModel(meetings, { compact })
  if (!list.length) return null
  return (
    <Stack gap="snug" className="ww-film">
      <SectionHead look="rule" as="h3" note={filmRoomNote(meetings, clubId)}>
        Film room
      </SectionHead>
      <ul className="ww-film__list">
        {list.map((m) => (
          <li key={m.gamePk} className="ww-film__slot">
            <FilmMeeting m={m} />
          </li>
        ))}
      </ul>
    </Stack>
  )
}
