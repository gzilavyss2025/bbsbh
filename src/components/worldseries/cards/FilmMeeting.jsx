import { pitchMark } from '../../../lib/pitch/pitchTypes.js'
import { useRouteLink } from '../../../lib/nav.js'
import { gamePath, playerPath } from '../../../lib/route.js'
import { PitchMark } from '../../playbyplay/pitcherCard/PitchMark.jsx'
import { Headshot } from '../../player/Headshot.jsx'
import { Door } from '../../ui/control/Door.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { Stack } from '../../ui/layout/Stack.jsx'

function Starter({ s, teamId }) {
  return (
    <div className="ww-film__starter">
      <Headshot personId={s.id} name={s.name} teamId={teamId} className="ww-film__shot" />
      <div className="ww-film__who">
        <span className="ww-film__name">{[s.abbr, s.name, s.hand].filter(Boolean).join(' · ')}</span>
        <span className="ww-film__line">{s.line}</span>
      </div>
      {s.mix.length > 0 && (
        <>
          <div className="ww-film__bar" aria-hidden="true">
            {s.mix.map((p) => (
              <span key={p.code} style={{ flexGrow: p.pct, background: pitchMark(p.code).color }} />
            ))}
          </div>
          <ul className="ww-film__mix">
            {s.mix.map((p) => (
              <li key={p.code}>
                <PitchMark mark={pitchMark(p.code)} size={12} /> {p.code} {p.pct}%
              </li>
            ))}
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
  return (
    <Card frame="stamped" label={m.day} labelAs="h3" count={m.ump ? `HP ${m.ump}` : undefined} className="ww-film__card">
      <Stack gap="snug">
        <table className="ww-film__score">
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.abbr}>
                <th scope="row">{r.abbr}</th>
                <td className={r.win ? 'ww-film__runs ww-film__runs--lead' : 'ww-film__runs'}>
                  {r.runs ?? '—'}
                  {r.win && <span className="sr-only"> winner</span>}
                </td>
                <td>{r.hits ?? '—'} H</td>
                <td>{r.errors ?? '—'} E</td>
              </tr>
            ))}
          </tbody>
        </table>
        {m.decisions && <p className="ww-film__dec">{m.decisions}</p>}
        {full && m.starters.map((s) => <Starter key={s.id} s={s} teamId={m.rows.find((r) => r.abbr === s.abbr)?.id} />)}
        {full && m.scoring.length > 0 && (
          <details className="ww-film__details">
            <summary>Scoring plays</summary>
            <ul>
              {m.scoring.map((p, i) => (
                <li key={i}>
                  <b>{p.inning}</b> {p.text}
                </li>
              ))}
            </ul>
          </details>
        )}
        {full && (
          <details className="ww-film__details">
            <summary>Lineups</summary>
            {m.lineups.map((l) => (
              <p key={l.abbr}>
                <b>{l.abbr}</b> {l.players.map((p) => `${p.name} ${p.pos}`.trim()).join(', ')}
              </p>
            ))}
          </details>
        )}
        <div className="ww-film__doors">
          <Door {...link(gamePath(m.date, m.awayAbbr, m.homeAbbr, 'boxscore', m.gameNumber))}>Box score</Door>
          {full && m.starters.map((s) => <Door key={s.id} {...link(playerPath(s.id))}>{`Scout ${s.surname || 'starter'}`}</Door>)}
        </div>
      </Stack>
    </Card>
  )
}
