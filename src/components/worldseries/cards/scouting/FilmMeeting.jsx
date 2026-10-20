import { useState } from 'react'
import { pitchMark } from '../../../../lib/pitch/pitchTypes.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { gamePath, playerPath } from '../../../../lib/route.js'
import { PitchMark } from '../../../playbyplay/pitcherCard/PitchMark.jsx'
import { Headshot } from '../../../player/Headshot.jsx'
import { Button } from '../../../ui/control/Button.jsx'
import { Door } from '../../../ui/control/Door.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Stack } from '../../../ui/layout/Stack.jsx'

// A missing figure draws a dash and says so to a screen reader.
const NONE = (
  <>
    —<span className="sr-only"> no figure</span>
  </>
)

// The legend names the three biggest pitches; the bar draws them all, and a screen reader hears the rest.
const LEGEND = 3

function Starter({ s, teamId }) {
  const link = useRouteLink()
  const named = s.mix.slice(0, LEGEND)
  const rest = s.mix.slice(LEGEND)
  return (
    <div className="ww-film__starter">
      <Headshot personId={s.id} name={s.name} teamId={teamId} className="ww-film__shot" />
      <div className="ww-film__who">
        <Door {...link(playerPath(s.id))} className="ww-film__name">
          {s.name}
        </Door>
        <span className="t-label ww-film__meta">{[s.abbr, s.hand].filter(Boolean).join(' · ')}</span>
      </div>
      <dl className="ww-film__stats">
        {s.stats.map((c) => (
          <div key={c.label}>
            <dt>{c.label}</dt>
            <dd>{c.value ?? NONE}</dd>
          </div>
        ))}
      </dl>
      {s.mix.length > 0 && (
        <>
          <div className="ww-film__bar" aria-hidden="true">
            {s.mix.map((p) => (
              <span key={p.code} style={{ flexGrow: p.pct, background: pitchMark(p.code).color }} />
            ))}
          </div>
          <ul className="ww-film__mix">
            {named.map((p) => (
              <li key={p.code}>
                <PitchMark mark={pitchMark(p.code)} size={12} /> {p.code} {p.pct}%
              </li>
            ))}
            {rest.length > 0 && <li className="sr-only">{rest.map((p) => `${p.code} ${p.pct}%`).join(', ')}</li>}
          </ul>
        </>
      )}
    </div>
  )
}

// One meeting's stamped card (ADR-0087, ADR-0117). The Box score door is a plain link: it sets
// no flag and writes no bbsbh:boxreveal:* key, and the box score opens on its own by the date.
// `m` is one filmRoomModel entry; the scoring plays and lineups exist only when it is not compact.
export function FilmMeeting({ m }) {
  const link = useRouteLink()
  const full = m.scoring !== undefined
  const [open, setOpen] = useState(null)
  return (
    <Card frame="stamped" label={m.day} labelAs="h3" count={m.ump ? `HP ${m.ump}` : undefined} className="ww-film__card">
      <Stack gap="snug">
        <table className="ww-film__score">
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.abbr}>
                <th scope="row">{r.abbr}</th>
                <td className={r.win ? 'ww-film__runs ww-film__runs--lead' : 'ww-film__runs'}>
                  {r.runs ?? NONE}
                  {r.win && <span className="sr-only"> winner</span>}
                </td>
                <td>{r.hits ?? NONE} H</td>
                <td>{r.errors ?? NONE} E</td>
              </tr>
            ))}
          </tbody>
        </table>
        {m.decisions && <p className="ww-film__dec">{m.decisions}</p>}
        {full && m.starters.map((s) => <Starter key={s.id} s={s} teamId={m.rows.find((r) => r.abbr === s.abbr)?.id} />)}
        {full && (
          <div className="ww-film__more">
            {m.scoring.length > 0 && (
              <Button size="control" pressed={open === 'scoring'} onClick={() => setOpen(open === 'scoring' ? null : 'scoring')}>
                Scoring plays
              </Button>
            )}
            <Button size="control" pressed={open === 'lineups'} onClick={() => setOpen(open === 'lineups' ? null : 'lineups')}>
              Lineups
            </Button>
          </div>
        )}
        {full && open === 'scoring' && (
          <ul className="ww-film__panel">
            {m.scoring.map((p, i) => (
              <li key={i}>
                <b>{p.inning}</b> {p.text}
              </li>
            ))}
          </ul>
        )}
        {full && open === 'lineups' && (
          <div className="ww-film__panel">
            {m.lineups.map((l) => (
              <p key={l.abbr}>
                <b>{l.abbr}</b> {l.players.map((p) => `${p.name} ${p.pos}`.trim()).join(', ')}
              </p>
            ))}
          </div>
        )}
        <Door {...link(gamePath(m.date, m.awayAbbr, m.homeAbbr, 'boxscore', m.gameNumber))} className="ww-film__box">
          Box score
        </Door>
      </Stack>
    </Card>
  )
}
