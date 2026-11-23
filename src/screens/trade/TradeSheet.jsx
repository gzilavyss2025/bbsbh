import { loadTrade } from '../../api/trade/history.js'
import { useAsync } from '../../hooks/useAsync.js'
import { teamClubName, teamFullName, teamLocationName, isMlbTeamId } from '../../lib/teams.js'
import { tradeLead } from '../../lib/trade/history.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { headerThemeFor, themeKeyFor } from '../../lib/colors/headerTheme.js'

const DASH = '—'
const club = (id) => (isMlbTeamId(id) ? teamClubName(id) : 'Other club')

// What else moved in a trade, read from the wire's own sentence: the rows with
// no player carry no type, so "and cash" and "player to be named" are the record.
function extras(description) {
  const out = []
  if (/cash/i.test(description)) out.push('cash')
  if (/to be named/i.test(description)) out.push('a player to be named later')
  return out
}

// The trade that brought a player to his club, in place on his sheet: one
// sentence (tradeLead), then each club's side as one line per player, WAR
// right-aligned under one column head. Side by side at the wide step,
// stacked on a phone. Facts only, no verdict.
export function TradeRecap({ player, toId }) {
  const { loading, error, data } = useAsync(() => loadTrade(player.id, player.how, toId), [player.id, toId])
  if (loading && !data) return <p className="hint" role="status">Reading the wire…</p>
  if (error || !data) return <p className="hint">The wire has no record of this trade.</p>
  const from = teamLocationName(data.fromId) ?? club(data.fromId)
  return (
    <div className="traderecap">
      <p className="traderecap__lead">{tradeLead(data, player.id, from, extras(data.description))}</p>
      <div className="tradesheet__sides">
        <Side teamId={toId} players={data.got} warSeason={data.warSeason} highlight={player.id}
          extra={data.got.length ? [] : extras(data.description)} />
        <Side teamId={data.fromId} players={data.gave} warSeason={data.warSeason}
          extra={data.gave.length ? [] : extras(data.description)} />
      </div>
    </div>
  )
}

// What a side got that is not a player, drawn as a player row is: a stamped
// mark where the face goes and what it was, with no WAR figure (it has none).
// Shown only on a side with no players, where the wire's "for cash" or
// "player to be named later" must be what that club got.
// Cash wears Ben Franklin off the $100 note as its "headshot" (public-domain
// U.S. currency art, cropped to the portrait: public/art/trade/cash-franklin.webp).
const EXTRA_ROW = {
  cash: { mark: '$', name: 'Cash', face: '/art/trade/cash-franklin.webp' },
  'a player to be named later': { mark: '?', name: 'Player to be named later' },
}

function Side({ teamId, players, warSeason, highlight = null, extra = [] }) {
  // The player this sheet is about leads his side.
  const rows = [...players].sort((x, y) => (y.id === highlight) - (x.id === highlight))
  const here = teamFullName(teamId)
  // Drawn as the desk's club cards are: the club's colour down the left edge,
  // its name over a column head, then the rows.
  const theme = isMlbTeamId(teamId) ? headerThemeFor(teamId, themeKeyFor(teamId, 'home', 'main')) : null
  return (
    <section className="tradesheet__side" style={{ '--club-edge': theme?.bar ?? 'var(--border-stamped)' }}>
      <header className="tradesheet__club">
        {isMlbTeamId(teamId) && <TeamLogo teamId={teamId} size={28} />}
        <h3>{club(teamId)} got</h3>
      </header>
      <p className="tradesheet__colheads" aria-hidden="true"><span>Player</span><span>{warSeason} WAR</span></p>
      <ul className="tradesheet__list">
        {rows.map((p) => {
          // Where he is now, only when that is somewhere else.
          const moved = p.active === false ? 'retired or released' : p.nowTeam && p.nowTeam !== here ? `now ${p.nowTeam}` : null
          return (
            <li key={p.id} className={p.id === highlight ? 'tradesheet__player tradesheet__player--this' : 'tradesheet__player'}>
              <Headshot personId={p.id} name={p.name} className="tradedesk__face" />
              <div className="tradedesk__who">
                <PlayerLink id={p.id} name={p.name} className="tradedesk__name">{p.name}</PlayerLink>
                <span className="t-label tradedesk__meta">
                  {[p.pos, p.id === highlight ? 'this player' : null, moved].filter(Boolean).join(' · ') || DASH}
                </span>
              </div>
              <span className="tradesheet__num">{p.war != null ? p.war.toFixed(1) : DASH}</span>
            </li>
          )
        })}
        {extra.map((k) => EXTRA_ROW[k] && (
          <li key={k} className="tradesheet__player">
            {EXTRA_ROW[k].face
              ? <span className="shot tradedesk__face tradesheet__cashface" aria-hidden="true"><img src={EXTRA_ROW[k].face} alt="" width="39" height="52" /></span>
              : <span className="tradesheet__extramark" aria-hidden="true">{EXTRA_ROW[k].mark}</span>}
            <div className="tradedesk__who">
              <span className="tradedesk__name">{EXTRA_ROW[k].name}</span>
            </div>
          </li>
        ))}
        {!players.length && !extra.some((k) => EXTRA_ROW[k]) && <li className="tradesheet__extra">No players</li>}
      </ul>
    </section>
  )
}
