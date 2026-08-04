import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { Headshot } from './Headshot.jsx'
import { ProspectPill } from './ProspectPill.jsx'
import { teamFullName } from '../lib/teams.js'

// The stats-to-date block under a traded player's name — one line for an MLB
// player (role-gated hitting/SP/RP/CL line), or a MiLB player's three lines
// (how he entered the league, games played per level, season stats). Shaped
// by scripts/gen-trade-deadline.mjs's decoratePlayerStats (fetching + the
// MLB-vs-MiLB/role decision) calling src/api/tradeDeadline.js's pure line
// formatters. Renders nothing when there's no stats data at all (e.g. a
// just-drafted player with no games and no signing record yet).
function PlayerStatLines({ stats }) {
  if (!stats) return null
  if (stats.kind === 'mlb') {
    return (
      <span className="tradecard__playerstats">
        <span className="tradecard__statline">{stats.line}</span>
      </span>
    )
  }
  if (!stats.entry && !stats.levelGamesLine && !stats.line) return null
  return (
    <span className="tradecard__playerstats">
      {stats.entry && <span className="tradecard__statline">{stats.entry}</span>}
      {stats.levelGamesLine && <span className="tradecard__statline">{stats.levelGamesLine}</span>}
      {stats.line && <span className="tradecard__statline">{stats.line}</span>}
    </span>
  )
}

// One player landing on a team side, headshot-first per the non-sports
// "A → B transfer" UX research (Venmo/Cash App, swap UIs): avatar + name is
// the primary identity anchor, the team's own logo is already the column
// header above it. Filed under the club that ACQUIRED him (side.receives —
// see TeamSide), not the one he left, so a reader scanning one team's
// column sees who's now on the roster, not who used to be. `isMlb`
// (threaded from ctx.debutedIds in tradeDeadline.js) tells Headshot whether
// this specific player is a confirmed major leaguer — a card's teamId is
// always the MLB parent org even for a low-minors prospect swap, so
// without this every player would read as "confirmed MLB" and Headshot
// would skip straight from a missing silo photo to the team-logo fallback,
// never trying his real MiLB photo. The Top Prospect pill (rank, mostly only
// ever populated on the current season — no historical snapshots) sits above
// the name, per the deadline page's own layout ask, rather than inline after
// it like the roster list's ProspectPill usage.
function PlayerRow({ player, teamId }) {
  return (
    <li className="tradecard__player">
      <PlayerLink id={player.playerId} className="tradecard__playerlink">
        <Headshot
          personId={player.playerId}
          name={player.name}
          teamId={teamId}
          isMlb={player.isMlb}
          className="tradecard__shot"
        />
        <span className="tradecard__playerinfo">
          {player.prospect && <ProspectPill {...player.prospect} />}
          <span className="tradecard__nameline">
            <span className="tradecard__playername">{player.name}</span>
            {player.pos && <span className="tradecard__pos">{player.pos}</span>}
          </span>
          <PlayerStatLines stats={player.stats} />
        </span>
      </PlayerLink>
    </li>
  )
}

// The glyph shown in a consideration's photo-sized frame — decorative only,
// the label text next to it is what actually names the thing. Cash is the
// one already-in-hand asset (its own '$' + the green tone below); every
// other consideration is a still-pending promise between the two clubs, so
// they share a handshake glyph rather than each getting its own symbol.
const CONSIDERATION_ICONS = {
  cash: '$',
  ptbnl: '🤝',
  futureConsiderations: '🤝',
  intlBonus: '🤝',
  draftPick: '🤝',
}

// Cash, a player to be named later, future considerations, international
// bonus-pool space, or a draft pick — every one a real, named part of the
// trade (tradeDeadline.js's CONSIDERATION_TYPES), so each earns the same
// list-row weight as an actual player rather than a small footnote chip: a
// glyph in a photo-sized frame stands in for the missing headshot (dashed
// border marks it as "not a real photo," not a broken image), full label
// (plus a detail line, e.g. a draft pick's CBA pick number, when known)
// alongside it, same as PlayerRow. Cash alone gets a green tint — the
// app's established positive/acquired color (TeamTransactionsCard's trade
// -> --field convention) — since unlike the others it's an unambiguous,
// already-in-hand gain rather than a still-unresolved promise.
function ConsiderationRow({ consideration }) {
  const tone = consideration.type === 'cash' ? 'cash' : null
  return (
    <li className="tradecard__player">
      <span className="tradecard__playerlink tradecard__considerationlink">
        <span
          className={`tradecard__considerationicon${tone ? ` tradecard__considerationicon--${tone}` : ''}`}
          aria-hidden="true"
        >
          {CONSIDERATION_ICONS[consideration.type] ?? '🤝'}
        </span>
        <span className="tradecard__playername">{consideration.label}</span>
        {consideration.detail && <span className="tradecard__pos">{consideration.detail}</span>}
      </span>
    </li>
  )
}

// One team's side of the trade — its logo/name header, then everything it
// ACQUIRED (side.receives, plus every consideration it took in —
// side.considerationsIn): a reader scans one team's column to see who/what
// landed there, not who left.
function TeamSide({ side }) {
  const name = teamFullName(side.teamId) || ''
  const hasGot = side.receives.length > 0 || side.considerationsIn.length > 0

  return (
    <div className="tradecard__side">
      <TeamLink id={side.teamId} className="tradecard__teamhead" ariaLabel={name}>
        <TeamLogo teamId={side.teamId} name={name} size={30} />
        <span className="tradecard__teamname">{name}</span>
      </TeamLink>
      {hasGot && (
        <ul className="tradecard__players">
          {side.receives.map((p) => (
            <PlayerRow key={p.playerId} player={p} teamId={side.teamId} />
          ))}
          {side.considerationsIn.map((c) => (
            <ConsiderationRow key={c.type} consideration={c} />
          ))}
        </ul>
      )}
    </div>
  )
}

// Shape badge — almost every real trade is '2-team' (see tradeDeadline.js's
// grouping header), but a genuine 3+-team blockbuster statsapi logs as one
// combined description (e.g. the 2024-07-29 Dodgers/White Sox/Cardinals
// deal) surfaces a wider shape here.
function badgeLabel(trade) {
  return trade.shape !== '2-team' ? trade.shape : null
}

// One completed trade: a two-column "swap card" for the ordinary 2-team
// case (Team A's ACQUISITIONS on the left, Team B's on the right, a
// connector glyph between them — the pattern from Venmo/Cash App and
// swap-UI research for showing an A ↔ B exchange at a glance), or a
// stacked one-row-per-team layout for a real 3+-team blockbuster, since
// forcing extra teams into two columns reads worse than just listing each
// side in turn.
//
// The two columns stay side by side at EVERY width, phone included — the
// swap only reads as a swap while both clubs are in view at once, so on a
// phone the column pair holds and it's each player ROW that restacks
// (headshot above the name instead of beside it). Collapsing to one
// column per club, which this used to do, spends the exchange to buy
// width the rows don't need. See the @media block by .tradecard__swap in
// index.css.
export function TradeCard({ trade }) {
  const badge = badgeLabel(trade)
  const isSwap = trade.teams.length === 2

  return (
    <article className="tradecard">
      {badge && <p className="tradecard__badge">{badge}</p>}
      {isSwap ? (
        <div className="tradecard__swap">
          <TeamSide side={trade.teams[0]} />
          <span className="tradecard__connector" aria-hidden="true">
            ⇄
          </span>
          <TeamSide side={trade.teams[1]} />
        </div>
      ) : (
        <div className="tradecard__stack">
          {trade.teams.map((side) => (
            <TeamSide key={side.teamId} side={side} />
          ))}
        </div>
      )}
      {trade.cutline.map((line, i) => (
        <p className="tradecard__cutline" key={i}>
          {line}
        </p>
      ))}
    </article>
  )
}
