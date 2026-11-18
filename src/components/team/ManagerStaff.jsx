import { useState } from 'react'
import { loadManagerHistory, groupManagerialRecord } from '../../api/managers.js'
import { useAsync } from '../../hooks/useAsync.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { Card } from '../ui/frame/Card.jsx'
import { Button } from '../ui/control/Button.jsx'
import { ManagerLink } from './ManagerLink.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import '../../styles/manager/staff.css'

// A band shows this many names; the rest wait behind a "more" button.
const SHOWN = 8

// The manager page's "His staff" card: who held a staff job while he managed.
// It claims nothing more than that (not who he mentored), so there is no tree.
// Full seasons are grouped by how many he and the coach had together. Seasons
// he managed only as interim sit apart in a lighter band, since that staff was
// in place before he took over. Coaches who later managed get a row on top and
// the yellow marker wherever they appear. `staff` is coachedUnder()'s output;
// `interimLabel` names his interim stints ("2015 San Diego Padres"). Renders
// nothing with no staff on file. Open surface: no score, no SealBox.
export function ManagerStaff({ staff, interimLabel }) {
  if (!staff?.length) return null
  const later = staff.filter((p) => p.laterManaged)
  const years = [...new Set(staff.filter((p) => p.seasons > 0).map((p) => p.seasons))].sort((a, b) => b - a)
  const interim = staff.filter((p) => p.interimSeasons > 0)
  return (
    <Card frame="stamped" label="His staff" count={`${staff.length} coaches`} body="flush" className="mgrpage__card mgrstaff">
      {later.length > 0 && (
        <div className="mgrstaff__band mgrstaff__later">
          <h3 className="mgrstaff__key mgrstaff__key--word">Later managed</h3>
          <LaterManaged people={later} />
        </div>
      )}
      {years.map((y) => (
        <div key={y} className="mgrstaff__band">
          <h3 className="mgrstaff__key">
            {y}
            <small>{y === 1 ? 'season' : 'seasons'}</small>
          </h3>
          <Names people={staff.filter((p) => p.seasons === y)} />
        </div>
      ))}
      {interim.length > 0 && (
        <div className="mgrstaff__band mgrstaff__band--interim">
          <h3 className="mgrstaff__key mgrstaff__key--word">
            Interim
            {interimLabel && <small>{interimLabel}</small>}
          </h3>
          <Names people={interim} />
        </div>
      )}
    </Card>
  )
}

// "Dodgers 2016–26": each club he managed, from his own manager history.
// The win-loss total sits after the clubs. Loads after the card, so a slow read
// leaves the names alone.
function recordLine(stints) {
  const rows = groupManagerialRecord(stints)
  if (!rows.length) return ''
  const yrs = (a, b) => (a === b ? String(a) : `${a}–${String(b).slice(-2)}`)
  const clubs = rows.map((r) => `${teamClubNameShort(r.teamId) || r.teamName} ${yrs(r.startSeason, r.endSeason)}`)
  const w = rows.reduce((t, r) => t + (r.w ?? 0), 0)
  const l = rows.reduce((t, r) => t + (r.l ?? 0), 0)
  return `${[...new Set(clubs)].join(', ')}${w + l ? ` · ${w}-${l}` : ''}`
}

function LaterManaged({ people }) {
  const ids = people.map((p) => p.personId).join(',')
  const { data } = useAsync(
    () => Promise.all(people.map((p) => loadManagerHistory(p.personId).then((h) => recordLine(h.stints)).catch(() => ''))),
    [ids],
  )
  return (
    <ul className="mgrstaff__names mgrstaff__names--later">
      {people.map((p, i) => (
        <Stack as="li" gap="tight" key={p.personId} className="mgrstaff__laterone">
          <ManagerLink id={p.personId} name={p.name || undefined} className="mgrstaff__name mgrstaff__name--mgr">
            {p.name || 'Coach'}
          </ManagerLink>
          {data?.[i] && <span className="mgrstaff__laterrec">{data[i]}</span>}
        </Stack>
      ))}
    </ul>
  )
}

function Names({ people }) {
  const [all, setAll] = useState(false)
  const shown = all ? people : people.slice(0, SHOWN)
  return (
    <ul className="mgrstaff__names">
      {shown.map((p) => {
        const cls = `mgrstaff__name${p.laterManaged ? ' mgrstaff__name--mgr' : ''}`
        return (
          <li key={p.personId}>
            {p.laterManaged ? (
              <ManagerLink id={p.personId} name={p.name || undefined} className={cls}>
                {p.name || 'Coach'}
              </ManagerLink>
            ) : (
              // No hover card: a coach's season line would be empty or years old.
              <PlayerLink id={p.personId} name={p.name || undefined} hover={false} className={cls}>
                {p.name || 'Coach'}
              </PlayerLink>
            )}
          </li>
        )
      })}
      {people.length > SHOWN && !all && (
        <li>
          <Button skin="ghost" className="mgrstaff__more" onClick={() => setAll(true)}>
            + {people.length - SHOWN} more
          </Button>
        </li>
      )}
    </ul>
  )
}
