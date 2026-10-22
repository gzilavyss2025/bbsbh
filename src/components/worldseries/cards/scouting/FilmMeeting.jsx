import { useState } from 'react'
import { pitchMark } from '../../../../lib/pitch/pitchTypes.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { gamePath } from '../../../../lib/route.js'
import { TeamLogo } from '../../../logo/TeamLogo.jsx'
import { Headshot } from '../../../player/Headshot.jsx'
import { PlayerLink } from '../../../player/PlayerLink.jsx'
import { PitchMark } from '../../../playbyplay/pitcherCard/PitchMark.jsx'
import { HighlightSheet } from '../../../playbyplay/HighlightSheet.jsx'
import { useWatchClip } from '../../../highlights/useWatchClip.js'
import { watchClipSource } from '../../../highlights/watchClip.js'
import { Button } from '../../../ui/control/Button.jsx'
import { Door } from '../../../ui/control/Door.jsx'
import { IconButton } from '../../../ui/control/IconButton.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Stack } from '../../../ui/layout/Stack.jsx'
import { Table } from '../../../ui/table/Table.jsx'

// A missing figure draws a dash and says so to a screen reader.
const NONE = (
  <>
    —<span className="sr-only"> no figure</span>
  </>
)

// The legend names the three biggest pitches; the bar draws them all, and a screen reader hears the rest.
const LEGEND = 3

// The line score, drawn like the box score's board: a head of inning numbers, one row a club, then R H E.
// A half never batted draws X. A club with no inning data keeps R H E alone.
function LineScore({ m }) {
  const cols = m.innings[0]?.runs.length ?? 0
  return (
    <Table frame="bare" density="tight" className="ww-film__grid ww-film__grid--line">
      <thead>
        <tr>
          <th scope="col" className="ww-film__club">
            <span className="sr-only">Club</span>
          </th>
          {Array.from({ length: cols }, (_, i) => (
            <th key={i} scope="col">
              {i + 1}
            </th>
          ))}
          <th scope="col" className="ww-film__tot">R</th>
          <th scope="col" className="ww-film__tot">H</th>
          <th scope="col" className="ww-film__tot">E</th>
        </tr>
      </thead>
      <tbody>
        {m.rows.map((r, i) => (
          <tr key={r.abbr}>
            <th scope="row" className="ww-film__club">
              <TeamLogo teamId={r.id} name={r.abbr} size={20} />
              <span className="sr-only">{r.abbr}</span>
            </th>
            {(m.innings[i]?.runs ?? []).map((v, j, all) => (
              <td key={j} className={v > 0 ? 'ww-film__scored' : undefined}>
                {/* X means the home half never batted: only the last inning, only when the home club won. */}
                {v ?? (i === 1 && j === all.length - 1 && r.win ? 'X' : NONE)}
              </td>
            ))}
            <td className={r.win ? 'ww-film__tot ww-film__tot--lead' : 'ww-film__tot'}>
              {r.runs ?? NONE}
              {r.win && <span className="sr-only"> winner</span>}
            </td>
            <td className="ww-film__tot">{r.hits ?? NONE}</td>
            <td className="ww-film__tot">{r.errors ?? NONE}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// The two starters, one row each, the box score's pitching columns. The name is a link to the player page.
function Pitching({ m }) {
  const labels = m.starters[0].stats.map((c) => c.label)
  return (
    <Table frame="bare" density="tight" className="ww-film__grid ww-film__grid--pit">
      <thead>
        <tr>
          <th scope="col" className="ww-film__club">
            Pitching
          </th>
          {labels.map((l) => (
            <th key={l} scope="col">
              {l}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {m.rows.map((r) => {
          const s = m.starters.find((x) => x.abbr === r.abbr)
          if (!s) {
            return (
              <tr key={r.abbr}>
                <th scope="row" className="ww-film__pname">
                  {r.abbr}
                </th>
                <td colSpan={labels.length} className="ww-film__missing">
                  Starter not posted
                </td>
              </tr>
            )
          }
          return (
            <tr key={s.id}>
              <th scope="row" className="ww-film__pname">
                {/* The card prints "Last, First", like the box score; the address is spoken order (ADR-0057). */}
                <PlayerLink id={s.id} name={s.name} className="ww-film__name">{s.listName}</PlayerLink>{' '}
                <span className="ww-film__tag">{[s.abbr, s.hand].filter(Boolean).join(' | ')}</span>
              </th>
              {s.stats.map((c) => (
                <td key={c.label}>{c.value ?? NONE}</td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}

// One starter's pitch mix: the bar draws every pitch, the legend names the biggest three.
function Mix({ s }) {
  const named = s.mix.slice(0, LEGEND)
  const rest = s.mix.slice(LEGEND)
  return (
    <li className="ww-film__mixrow">
      <span className="t-label">{s.surname}</span>
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
    </li>
  )
}

// One meeting's stamped card (ADR-0087, ADR-0117). The Box score door is a plain link: it sets
// no flag and writes no bbsbh:boxreveal:* key, and the box score opens on its own by the date.
// `m` is one filmRoomModel entry; the pitching, scoring and lineups exist only when it is not compact.
export function FilmMeeting({ m }) {
  const link = useRouteLink()
  const full = m.scoring !== undefined
  const [lineups, setLineups] = useState(false)
  const { open, src, notice, loading, openClip, close } = useWatchClip()
  return (
    <Card frame="stamped" label={m.day} labelAs="h3" count={m.ump ? `HP ${m.ump}` : undefined} className="ww-film__card">
      <Stack gap="snug">
        <LineScore m={m} />
        {m.people.length > 0 && (
          <ul className="ww-film__people">
            {m.people.map((p) => (
              <li key={p.label}>
                {p.id != null && <Headshot personId={p.id} name={p.name} teamId={p.teamId} tint={false} className="ww-film__shot" />}
                <span className="t-label">{p.label}</span>
                <span className="ww-film__pname2">{p.surname || p.name}</span>
              </li>
            ))}
          </ul>
        )}
        {full && m.starters.length > 0 && <Pitching m={m} />}
        {full && m.starters.some((s) => s.mix.length > 0) && (
          <ul className="ww-film__mixes">
            {m.starters.filter((s) => s.mix.length > 0).map((s) => (
              <Mix key={s.id} s={s} />
            ))}
          </ul>
        )}
        {full && m.scoring.length > 0 && (
          <section aria-label="Scoring plays">
            <h4 className="ww-film__head">Scoring</h4>
            <ol className="ww-film__plays">
              {m.scoring.map((p, i) => {
                const watch = watchClipSource(null, p.playId)
                return (
                  <li key={i}>
                    <TeamLogo teamId={p.teamId} name={p.half === 'top' ? m.awayAbbr : m.homeAbbr} size={22} />
                    <span className="ww-film__when">
                      <span aria-hidden="true">{p.tag}</span>
                      <span className="sr-only">{p.half === 'top' ? 'Top' : 'Bottom'} of inning {p.num}</span>
                    </span>
                    <span className="ww-film__text">{p.text}</span>
                    {watch && (
                      <IconButton label={`Watch the clip of the ${p.half === 'top' ? 'top' : 'bottom'} ${p.num} play`} mark="md" skin="ink" onClick={() => openClip(p, p.playId)}>
                        ▶
                      </IconButton>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        )}
        {full && (
          <Button block icon="›" aria-expanded={lineups} onClick={() => setLineups(!lineups)}>
            Lineups
          </Button>
        )}
        {full && lineups && (
          <div className="ww-film__lineups">
            {m.lineups.map((l) => (
              <p key={l.abbr}>
                <b>{l.abbr}</b> {l.players.map((p) => `${p.name} ${p.pos}`.trim()).join(', ')}
              </p>
            ))}
          </div>
        )}
        {open && <HighlightSheet item={null} src={src} notice={loading ? 'Loading the clip…' : notice} onClose={close} />}
        <Door {...link(gamePath(m.date, m.awayAbbr, m.homeAbbr, 'boxscore', m.gameNumber))} className="ww-film__box">
          Box score
        </Door>
      </Stack>
    </Card>
  )
}
