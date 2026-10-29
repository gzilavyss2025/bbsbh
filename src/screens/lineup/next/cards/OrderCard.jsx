import { useState } from 'react'
import { matchupLine } from '../../../../api/careerMatchups.js'
import { prospectBadge } from '../../../../api/prospects.js'
import { hasDebuted, showRookiePill } from '../../../../api/rookies.js'
import { milestoneTextFor } from '../../../../api/callouts.js'
import { DebutPill } from '../../../../components/badges/DebutPill.jsx'
import { MilestonePill } from '../../../../components/badges/MilestonePill.jsx'
import { ProspectPill } from '../../../../components/badges/ProspectPill.jsx'
import { RookiePill } from '../../../../components/badges/RookiePill.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { useMediaQuery, WIDE_QUERY } from '../../../../hooks/useMediaQuery.js'
import { useNav } from '../../../../lib/nav.js'
import { teamTabPath } from '../../../../lib/route.js'
import { SPORT_LABEL } from '../../../../lib/teams.js'
import { ClubBar } from './ClubBar.jsx'

// The cells of one hitter's season line, by name; each is a stat and its label.
const DETAIL = [
  ['OBP', 'obp'],
  ['SLG', 'slg'],
  ['HR', 'homeRuns'],
  ['RBI', 'rbi'],
  ['AB', 'atBats'],
]
// The wide row's figures, in column order.
const WIDE_COLS = [
  ['AVG', 'avg'],
  ['OPS', 'ops'],
  ['HR', 'homeRuns'],
  ['RBI', 'rbi'],
]
const val = (line, key) => (line?.[key] == null || line?.[key] === '' ? '—' : line[key])

// One batter: the order number (or the position, before the lineup posts), a photo, the name,
// his position, hand and number, his career line against tonight's starter, and his season
// line. A tap opens the rest of the line on a phone; a wide screen shows AVG, OPS, HR and RBI
// across the row, so nothing needs a tap.
function OrderRow({ lead, player, line, bats, note, wide, open, onToggle, pills, index = 0 }) {
  const detailId = `lnext-det-${player.id}`
  // The row is a plain box, because the name inside it is a link and a link cannot sit inside a
  // button. On a phone the season line is the toggle (a real button, with the open state); a tap
  // anywhere else on the row that is not the name toggles it too.
  const figures = wide ? (
    WIDE_COLS.map(([label, key], i) => (
      <span key={key} className={`lord__figure${i === 0 ? ' lord__figure--lead' : ''}`}>
        <span className="sr-only">{label} </span>
        {val(line, key)}
      </span>
    ))
  ) : (
    <button
      type="button"
      className="lord__avg"
      aria-expanded={open}
      aria-controls={detailId}
      aria-label={`Season line for ${player.name}`}
      onClick={onToggle}
    >
      <b>{val(line, 'avg')}</b>
      <small>{val(line, 'ops')} OPS</small>
    </button>
  )
  return (
    // `--row-i` is the row's place in the posted order: the ink-in cascade steps off it (styles/motion/lineup.css).
    <li className="lord__item" style={{ '--row-i': index }}>
      <div className="lord__row" onClick={wide ? undefined : (e) => !e.target.closest('a, button') && onToggle()}>
        <span className="lord__lead">{lead}</span>
        <Headshot personId={player.id} name={player.name} className="lord__shot" />
        <span className="lord__name">
          <PlayerLink id={player.id} className="lord__link">
            {player.nameLastFirst ?? player.name}
          </PlayerLink>
          <span className="lord__meta">
            {/* Number then position, as Gameday's Due up tags a batter ("21 CF"), then his side (Gary, 2026-10-28). */}
            {player.jersey && <span className="lord__num">{player.jersey}</span>}
            {player.position && <span className="lord__pos">{player.position}</span>}
            {bats && <span>Bats {bats}</span>}
            {pills}
          </span>
          {note && <span className="lord__vs">{note}</span>}
        </span>
        {figures}
      </div>
      {!wide && open && (
        <dl className="lord__det" id={detailId}>
          {DETAIL.map(([label, key]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{val(line, key)}</dd>
            </div>
          ))}
          <div>
            <dt>Bats</dt>
            <dd>{bats || '—'}</dd>
          </div>
        </dl>
      )}
    </li>
  )
}

// The batting order card on this club's own band. Season lines end the day before the game
// (ADR-0088); the "vs" lines are career totals against the starter, never tonight's. Before
// the lineup posts it lists who could play, by position, from the active roster; for a
// played game with no record it says so.
export function OrderCard({ data, masthead }) {
  const { lineup, roster, hitterLines, matchups, closed, meta, info, season, isMlb, batsOf } = data
  const wide = useMediaQuery(WIDE_QUERY)
  // Which row's season line is open. Until the reader picks one, the first hitter's is open, so a
  // lineup that posts while the page is open gets the same first row as one loaded after it.
  const [picked, setPicked] = useState(undefined)
  const openId = picked === undefined ? (lineup[0]?.id ?? null) : picked
  const setOpenId = setPicked
  const navigate = useNav()
  const level = SPORT_LABEL[meta.sportId] ?? 'MLB'
  const pills = (p) => (
    <>
      <ProspectPill {...prospectBadge(data.prospectsData, p.id, data.orgTeamId)} />
      <MilestonePill text={milestoneTextFor(data.callouts, p.id)} />
      <RookiePill active={showRookiePill(data.rookiesData, p.id, isMlb)} />
      <DebutPill debuted={!isMlb && hasDebuted(data.rookiesData, p.id)} />
      {data.birthdayIds.has(p.id) && (
        <span role="img" aria-label="Birthday today" title="Birthday today">
          🎂
        </span>
      )}
    </>
  )
  // "vs Snell 0-for-1, 1 K", or that he has no history against him. A game whose starter has no
  // career file shows no line at all.
  const noteOf = (id) => {
    if (!data.starterLast) return ''
    const row = matchups.byId.get(id)
    // No meeting: no line at all (Gary, 2026-10-28), rather than saying so.
    return row ? `vs ${data.starterLast} ${matchupLine(row, level)}` : ''
  }
  const posted = lineup.length > 0
  const title = posted ? 'Batting order' : 'Who could play'
  const waiting = `Lineup not final${info.scheduledTime ? ` · posts close to first pitch (${info.scheduledTime})` : ''}`
  return (
    <Card
      frame="stamped"
      body="flush"
      className="lord"
      head={<ClubBar title={title} teamId={meta.id} teamName={meta.teamName} masthead={masthead} season={season} />}
    >
      {(posted || roster.length > 0) && (
        <div className="lord__cols" aria-hidden="true">
          <span>Batter</span>
          {wide ? WIDE_COLS.map(([label]) => <span key={label}>{label}</span>) : <span>AVG</span>}
        </div>
      )}
      {posted ? (
        <ul className="lord__list">
          {lineup.map((p, i) => (
            <OrderRow
              key={p.id}
              index={i}
              lead={p.order}
              player={p}
              line={hitterLines[p.id]}
              bats={batsOf(p.id)}
              note={noteOf(p.id)}
              wide={wide}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              pills={pills(p)}
            />
          ))}
        </ul>
      ) : roster.length > 0 ? (
        <>
          <p className="roster__notice">{waiting}</p>
          <ul className="lord__list">
            {roster.map((p) => (
              <OrderRow
                key={p.id}
                lead={p.pos}
                player={{ ...p, position: '' }}
                line={hitterLines[p.id]}
                bats={batsOf(p.id)}
                note={noteOf(p.id)}
                wide={wide}
                open={openId === p.id}
                onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                pills={pills(p)}
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="roster__notice">{closed ? 'The batting order is not in the record for this game.' : waiting}</p>
      )}
      {posted && matchups.bench.length > 0 && (
        <div className="lord__bench">
          <h4 className="lord__benchhead">Off the bench vs {data.starterLast}</h4>
          <ul className="lord__benchlist">
            {matchups.bench.map((r) => (
              <li key={r.id} className="lord__benchrow">
                <Headshot personId={r.id} name={r.name} className="lord__benchshot" />
                <span className="lord__benchname">
                  <PlayerLink id={r.id} className="lord__benchlink">
                    {r.name}
                  </PlayerLink>
                  <small>{data.tagOf(r.id)}</small>
                </span>
                <span className="lord__benchline">{matchupLine(r, level)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="lord__foot">
        <Door onClick={() => navigate(teamTabPath(meta.id, 'roster', { s: meta.sportId }))}>Full roster</Door>
      </div>
    </Card>
  )
}
