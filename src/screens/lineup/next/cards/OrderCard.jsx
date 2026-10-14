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
const val = (line, key) => (line?.[key] == null || line?.[key] === '' ? '—' : line[key])

// One batter: the order number (or the position, before the lineup posts), a photo, the
// name, the hand and number, his career line against tonight's starter, and his season
// AVG. A tap opens the rest of the line on a phone; wide screens show it across the row.
function OrderRow({ lead, player, line, bats, note, wide, open, onToggle, pills }) {
  const detailId = `lnext-det-${player.id}`
  return (
    <li className="lord__item">
      <button
        type="button"
        className="lord__row"
        aria-expanded={wide ? undefined : open}
        aria-controls={wide ? undefined : detailId}
        tabIndex={wide ? -1 : undefined}
        onClick={wide ? undefined : onToggle}
      >
        <span className="lord__lead">{lead}</span>
        <Headshot personId={player.id} name={player.name} className="lord__shot" />
        <span className="lord__name">
          <PlayerLink id={player.id} className="lord__link">
            {player.nameLastFirst ?? player.name}
          </PlayerLink>
          <span className="lord__meta">
            {player.position && <span>{player.position}</span>}
            {bats && <span>Bats {bats}</span>}
            {player.jersey && <span>#{player.jersey}</span>}
            {pills}
          </span>
          {note && <span className="lord__vs">{note}</span>}
        </span>
        <span className="lord__avg">
          <b>{val(line, 'avg')}</b>
          <small>{val(line, 'ops')} OPS</small>
        </span>
        {wide && DETAIL.slice(2, 4).map(([label, key]) => (
          <span key={key} className="lord__wide" aria-label={label}>
            {val(line, key)}
          </span>
        ))}
      </button>
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
  const [openId, setOpenId] = useState(() => lineup[0]?.id ?? null)
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
  const noteOf = (id) => {
    const row = matchups.byId.get(id)
    return row ? matchupLine(row, level) : ''
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
      {posted ? (
        <ul className="lord__list">
          {lineup.map((p) => (
            <OrderRow
              key={p.id}
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
                <b>{r.name}</b>
                <span>{matchupLine(r, level)}</span>
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
