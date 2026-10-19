import { Fragment } from 'react'
import { splitDisplayName } from '../../api/person.js'
import { ordinal } from '../../lib/format.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { SectionMasthead } from '../../components/ui/SectionMasthead.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { BaseoutDiamond } from '../../components/scoring/BaseoutDiamond.jsx'
import { teamAbbr, teamFullName, favoriteAccentColor } from '../../lib/teams.js'
import { Pill } from '../../components/ui/control/Pill.jsx'
import { Table } from '../../components/ui/table/Table.jsx'

export const pct1 = (x) => `${(x * 100).toFixed(1)}%`

// A `.foulboard` <tr> or `.sgh-row`/`.gamehigh-row` <li>'s favorite-team
// highlight — same `is-me` class + `--fav-accent` inline var convention as
// StandingsPage (see .foulboard tr.is-me in 43-foul-tracker.css), reused
// as-is so a fan's team tints the same way here as on the other tables.
export function favRowProps(teamId, favoriteTeamId) {
  if (favoriteTeamId == null || teamId !== favoriteTeamId) return {}
  return { className: 'is-me', style: { '--fav-accent': favoriteAccentColor(teamId) } }
}

// Every board on this page wears the same navy/gold masthead the rest of the
// app's card sections use (Bullpen Tonight, batting order, opposing defense,
// …) — the Card owns the border/radius/shadow and the clip, the masthead
// caps it, same convention as those (#1113, slice C3). No descriptive copy
// under the title — the board's own name plus its data carries the meaning,
// and every board's table/list bleeds edge-to-edge under the masthead
// (.foulboard-block rules in 43-foul-tracker.css) rather than floating inset
// with its own redundant border.
export function BoardCard({ title, children }) {
  const head = <SectionMasthead as="h2" title={title} />
  return (
    <Card className="metric foulboard-block" head={head} body="flush">
      <div className="metric__body">{children}</div>
    </Card>
  )
}

// The rank-1 entry rendered as a hero card — headshot, a two-line name (same
// first/last split idiom as PlayerPage's/TeamLeaders' hero, see
// splitDisplayName) with the team name underneath, a bigger centered team
// logo. The table beneath still lists this same player at rank 1 with his
// stats, so nothing here needs to repeat them.
export function FoulFeatured({ player, favoriteTeamId, positions }) {
  const isFavorite = favoriteTeamId != null && player.teamId === favoriteTeamId
  const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(player.teamId) } : undefined
  const { first, last } = splitDisplayName(player.name)
  const position = positions?.[player.id]
  return (
    <Card as="div" body="flush" className={`foulboard__hero${isFavorite ? ' is-me' : ''}`} style={favStyle}>
      <div className="foulboard__herotop">
        <Headshot personId={player.id} name={player.name} teamId={player.teamId} className="foulboard__heroshot" />
        <div className="foulboard__heroident">
          <PlayerLink id={player.id} name={player.name} className="foulboard__heroname">
            {first && <span className="foulboard__heroname-first">{first}</span>}
            <span className="foulboard__heroname-last">{last}</span>
          </PlayerLink>
          <p className="foulboard__herometa">
            {position}
            {position && ' · '}
            <TeamLink id={player.teamId} className="foulboard__heroteamname">
              {teamFullName(player.teamId)}
            </TeamLink>
          </p>
        </div>
        <TeamLogo
          teamId={player.teamId}
          name={teamAbbr({ id: player.teamId })}
          size={44}
          className="foulboard__heroteam"
        />
      </div>
    </Card>
  )
}

// `featured`: additionally spotlights rank 1 in a FoulFeatured headshot card
// above the table — the table still lists him at rank 1 too, so a reader
// scanning the ledger alone still sees the full ranking.
// `compare` (seasons/view.js's boardCompare): one column beside the first figure (#1202).
export function FoulLeaderBoard({ title, rows, cols, cells, compare, featured = false, favoriteTeamId, positions }) {
  if (!rows || rows.length === 0) return null
  const lead = featured ? rows[0] : null
  return (
    <BoardCard title={title}>
      {lead && <FoulFeatured player={lead} favoriteTeamId={favoriteTeamId} positions={positions} />}
      {rows.length > 0 && (
        <Table frame="bare" label={title} className="foulboard">
          <thead>
            <tr>
              <th className="team">Player</th>
              {cols.map((c, j) => (
                <Fragment key={c}>
                  <th>{c}</th>
                  {j === 0 && compare && <th>{compare.head}</th>}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} {...favRowProps(r.teamId, favoriteTeamId)}>
                <td className="team">
                  <span className="umprank__rank">{i + 1}</span>
                  <PlayerLink id={r.id} className="foulboard__rowname">{r.name}</PlayerLink>
                  <span className="foulboard__team">{teamAbbr({ id: r.teamId })}</span>
                </td>
                {cells(r).map((v, j) => (
                  <Fragment key={j}>
                    <td>{v}</td>
                    {j === 0 && compare && <td>{compare.cell(r)}</td>}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </BoardCard>
  )
}

// Fouls-per-whiff's Most (foul-heavy) and Fewest (whiff-heavy) sides are the
// SAME underlying ratio read from both ends, not two independent boards — a
// separate hero card + masthead per side (like every other leaderboard here)
// duplicated too much chrome for that. One card, two plain compact tables
// side by side on desktop (stacked on phone, see .foulboard__whiffsplit) —
// no hero cards, deliberately, since the point of combining these is density.
// A whiff is the cleaner miss for a pitcher; a foul just keeps the pitch
// alive (see the two-strike stat in this page's intro), so "Most" reads
// foul-heavy/less swing-and-miss and "Fewest" reads whiff-heavy/more
// swing-and-miss — described inline rather than assumed, since which end is
// "better" isn't obvious the way Foul magnets/Fewest fouls' Foul% is. `avg`
// (buildBoards' pitcherFoulsPerWhiffAvg) gives the reader a middle to read
// both extremes against, the same "state the baseline before the outliers"
// idea as SeasonAverageCard leading the whole page — one sentence, shared by
// both columns below it, rather than repeating the number per side.
export function FoulsPerWhiffBoard({ mostRows, fewestRows, avg, minPitches, favoriteTeamId }) {
  const hasMost = mostRows && mostRows.length > 0
  const hasFewest = fewestRows && fewestRows.length > 0
  if (!hasMost && !hasFewest) return null
  return (
    <BoardCard title="Fouls per whiff — pitchers">
      {avg != null && (
        <p className="foulboard__whiffavg">
          Qualified pitchers ({minPitches}+ pitches, 1+ whiff) average <b>{avg.toFixed(1)}</b> fouls per whiff — every ranked
          pitcher below is well off that middle.
        </p>
      )}
      <div className="foulboard__whiffsplit">
        {hasMost && (
          <FoulsPerWhiffColumn
            heading="Most"
            hint="foul-heavy"
            rows={mostRows}
            favoriteTeamId={favoriteTeamId}
          />
        )}
        {hasFewest && (
          <FoulsPerWhiffColumn
            heading="Fewest"
            hint="whiff-heavy"
            rows={fewestRows}
            favoriteTeamId={favoriteTeamId}
          />
        )}
      </div>
    </BoardCard>
  )
}

export function FoulsPerWhiffColumn({ heading, hint, rows, favoriteTeamId }) {
  return (
    <div className="foulboard__whiffcol">
      <p className="foulboard__whiffcol-heading">
        {heading} <span className="foulboard__whiffcol-hint">({hint})</span>
      </p>
      <Table frame="bare" label={`${heading} fouls per whiff`} className="foulboard">
        <thead>
          <tr>
            <th className="team">Player</th>
            <th>Fouls per whiff</th>
            <th>Fouls</th>
            <th>Whiffs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} {...favRowProps(r.teamId, favoriteTeamId)}>
              <td className="team">
                <span className="umprank__rank">{i + 1}</span>
                <PlayerLink id={r.id} className="foulboard__rowname">{r.name}</PlayerLink>
                <span className="foulboard__team">{teamAbbr({ id: r.teamId })}</span>
              </td>
              <td>{(r.fouls / r.whiffs).toFixed(1)}</td>
              <td>{r.fouls}</td>
              <td>{r.whiffs}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

// A result that reaches base or otherwise helps the batter's own line — the
// user-facing "good outcome" set (hits, walks, HBP, a productive sac fly);
// everything else (every out, however it's recorded, plus reaching on an
// error — not credited as the batter's own doing) reads negative. Keyed on
// the feed's machine eventType (see gen-fouls.mjs's resultType), not the
// human-readable event string, so this can't be fooled by "Sac Fly" vs.
// "Sac Bunt" wording drift the way string-matching would be.
const POSITIVE_RESULT_TYPES = new Set([
  'single', 'double', 'triple', 'home_run',
  'walk', 'intent_walk', 'hit_by_pitch', 'sac_fly', 'catcher_interf',
])

// A compact scorebug for the single most-fouled AT-BAT of the season — the
// same information a broadcast graphic would carry: both teams' score, the
// inning, the base/out state ENTERING the at-bat (see gen-fouls.mjs's header
// comment on why that's the PRIOR play's post-state), who was on the mound,
// and how the at-bat actually ended. Renders at FoulStoryBoard's `.storypa-row`
// grid's own `scorebug` area, spanning the FULL width between the two
// headshots (not just under the batter's name) — kept compact (small diamond/
// logos) so, combined with the name/fouls/pitcher-name line above it, the
// whole card's height still stays close to the headshots'. The situation line
// (diamond, out dots, result pill) doesn't fill its own width, so the play's
// full prose (gen-fouls.mjs's resultDescription, the feed's own play-by-play
// sentence) fills that leftover space, single-line/ellipsis-truncated rather
// than wrapped — a wrapped second line would blow the height budget. Prefixed
// with the deciding pitch number in bold ("Pitch 6: ...") since that's the
// stat this whole board is about, read before the sentence describing what
// happened on it.
export function PaScorebug({ pa }) {
  const hisScore = pa.half === 'top' ? pa.awayScore : pa.homeScore
  const oppScore = pa.half === 'top' ? pa.homeScore : pa.awayScore
  const outs = pa.outs ?? 0
  const positive = POSITIVE_RESULT_TYPES.has(pa.resultType)
  return (
    <div className="scorebug">
      <div className="scorebug__score">
        <span className="scorebug__team scorebug__team--his">
          <TeamLogo teamId={pa.battingTeamId} name={teamAbbr({ id: pa.battingTeamId })} size={14} />
          {teamAbbr({ id: pa.battingTeamId })}
          <b>{hisScore}</b>
        </span>
        <span className="scorebug__team">
          <TeamLogo teamId={pa.opponentId} name={teamAbbr({ id: pa.opponentId })} size={14} />
          {teamAbbr({ id: pa.opponentId })}
          <b>{oppScore}</b>
        </span>
        <span className="scorebug__inning">
          <span className={`scorebug__arrow ${pa.half === 'top' ? 'is-top' : 'is-bottom'}`} aria-hidden="true">
            {pa.half === 'top' ? '▲' : '▼'}
          </span>
          {ordinal(pa.inning)}
        </span>
      </div>
      <div className="scorebug__situation">
        <BaseoutDiamond size={20} bases={[!!pa.onFirst, !!pa.onSecond, !!pa.onThird]} />
        <span className="scorebug__outs" role="img" aria-label={`${outs} ${outs === 1 ? 'out' : 'outs'}`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`scorebug__outdot ${i < outs ? 'is-out' : ''}`} />
          ))}
        </span>
        {pa.resultEvent && (
          <Pill className={`scorebug__result scorebug__result--${positive ? 'positive' : 'negative'}`}>{pa.resultEvent}</Pill>
        )}
        {pa.resultDescription && (
          <p className="scorebug__prose">
            {pa.paPitches != null && <b>Pitch {pa.paPitches}: </b>}
            {pa.resultDescription}
          </p>
        )}
      </div>
    </div>
  )
}

// A STORY (one specific at-bat), not a ranking — so unlike FoulLeaderBoard
// above, every row gets the fuller headshot treatment rather than just the
// rank-1 leader. `bug` renders a rich node (PaScorebug) — the only caller left
// is Most-Fouls-In-A-PA, whose situational data is rich enough to earn the
// widget.
//
// The row is batter-vs-pitcher, so it wears BOTH faces — the batter's headshot
// pinned left (as every other board's row does) and the pitcher he fouled off
// pinned right. A 3x2 grid (.storypa-row): both headshots span both grid
// rows (same "battershot"/"pitchershot" area repeated on both template rows),
// so they read as tall as ever, while the middle 1fr column stacks a top
// line — batter name/team, the fouls count, pitcher name/team — over the
// scorebug, which now spans that SAME full 1fr column (100% of the space
// between the two photos) rather than being confined under just the batter's
// name. The fouls count sits between two equal flex:1 name blocks in the top
// line, which is what keeps it genuinely centered regardless of how long
// either name runs.
export function FoulStoryBoard({ title, rows, value, bug, favoriteTeamId }) {
  if (!rows || rows.length === 0) return null
  return (
    <BoardCard title={title}>
      <ol className="sgh-list">
        {rows.map((b) => {
          const pa = b.bestPa
          return (
            <li className="sgh-row storypa-row" key={b.id} {...favRowProps(b.teamId, favoriteTeamId)}>
              <Headshot
                personId={b.id}
                name={b.name}
                teamId={b.teamId}
                className="sgh-shot sgh-shot--xl storypa-row__battershot"
              />
              <div className="storypa-row__topline">
                <div className="storypa-row__who">
                  <div className="sgh-top">
                    <PlayerLink id={b.id} className="sgh-name">
                      {b.name}
                    </PlayerLink>
                    <span className="foulboard__team">{teamAbbr({ id: b.teamId })}</span>
                  </div>
                  <div className="sgh-sub">
                    vs {pa.pitcherId ? <PlayerLink id={pa.pitcherId}>{pa.pitcherName}</PlayerLink> : pa.pitcherName}
                  </div>
                </div>
                <span className="storypa-row__val">
                  <span className="sgh-val">{value(b)}</span>
                  <span className="sgh-vallabel">Fouls</span>
                </span>
                <div className="storypa-row__who storypa-row__who--pitcher">
                  <div className="sgh-top">
                    {pa.pitcherId ? (
                      <PlayerLink id={pa.pitcherId} className="sgh-name">
                        {pa.pitcherName}
                      </PlayerLink>
                    ) : (
                      <span className="sgh-name">{pa.pitcherName}</span>
                    )}
                    <span className="foulboard__team">{teamAbbr({ id: pa.opponentId })}</span>
                  </div>
                </div>
              </div>
              {bug(b)}
              <Headshot
                personId={pa.pitcherId}
                name={pa.pitcherName}
                teamId={pa.opponentId}
                className="sgh-shot sgh-shot--xl storypa-row__pitchershot"
              />
            </li>
          )
        })}
      </ol>
    </BoardCard>
  )
}
