// The full bracket behind "Open the bracket" (#1224, slice 5) — Gary's
// approved Concept D, built on Concept A's "back page": each league's Wild
// Card -> Division -> LCS tree runs left to right in three columns, a
// finished round keeps its pips and paper, and elbow connector lines run
// pencil-gray until a series is decided, then ink navy into the next round.
// The World Series sits centered below both leagues. Every value comes from
// src/api/postseason/bracket.js's derived shape (docs/api/postseason.md);
// this file draws it and reads no feed of its own.
//
// Real data carries no seed number (the skeleton read never asks statsapi
// for one — docs/api/postseason.md), so a box shows a club's mark, name and
// pips, never a seed digit the way the reference concept's mock data could.
import { useRouteLink } from '../../lib/nav.js'
import { seriesHref } from '../../lib/route.js'
import { recordLine } from '../../api/postseason/text.js'
import { humanDate } from '../../lib/dates.js'
import {
  byeSlotIndex,
  feederSeries,
  isDecidingGame,
  isElimination,
  leaguePhase,
  winningSlotIndex,
} from '../../lib/postseason/bracketDisplay.js'
import { BlankSlot, ClubMark, Pips, Trophy } from './bracketParts.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { SeriesMark } from '../postseason/SeriesMark.jsx'
import { leagueRoundMark, seriesMark } from '../../lib/postseason/seriesMarks.js'

const R = 26 // one club row
const BOX = R * 2 // a two-row box, border drawn outside
const GAP = 14
const TREE_W = 358
// THE RAIL'S TREE (the desktop home, in the World Series design): no club marks,
// so the columns are narrower, and each Wild Card box sits level with the
// Division box it feeds. The tree is the 358px rail less the stamped card's edge
// and padding (styles/postseason/home.css).
const RAIL_TREE_W = 330
const RAIL_LANE = BOX + 32 // a lane: its boxes, then the note line under them
const RAIL_FLOOR = { wc: 84, ds: 112, lcs: 100 }

// Column widths: every box keeps its pips, finished or not, so each column has
// a floor that holds a mark, an abbreviation and its round's pips (2/3/4). The
// width left over goes to the league's current round.
const COLUMN_FLOOR = { wc: 88, ds: 102, lcs: 116 }
const COLUMN_NOW = { wildcard: 'wc', division: 'ds', lcs: 'lcs', done: 'lcs' }
function columns(phase, rail) {
  const c = { ...(rail ? RAIL_FLOOR : COLUMN_FLOOR) }
  const now = COLUMN_NOW[phase]
  if (now) c[now] += (rail ? RAIL_TREE_W : TREE_W) - 2 * GAP - c.wc - c.ds - c.lcs
  return c
}

// A connector's source point: the box's vertical middle unless its round is
// past AND it is decided, in which case it leaves from the winner's own row —
// both rows are still drawn (winner plain, loser struck), so the line has to
// pick one.
function rowCenter(series, past, top) {
  const idx = winningSlotIndex(series)
  if (idx === -1 || !past) return top + R
  return top + (idx === 0 ? R / 2 : R + R / 2)
}

// An elbow connector, bending at the middle x. Ink once the source series
// is decided, pencil while it is still open.
function Elbow({ x1, y1, x2, y2, inked }) {
  const mx = x1 + (x2 - x1) / 2
  return <path d={`M${x1} ${y1} H${mx} V${y2} H${x2}`} className={inked ? 'pbkt-ink' : 'pbkt-pencil'} />
}

function BoxRow({ slot, series, bracket, x, y, w, rail, bye }) {
  const style = { left: x, top: y, width: w, height: R }
  if (!slot.club) {
    const feeder = feederSeries(bracket, slot.from)
    const label = feeder ? `Winner of ${feeder.label || feeder.name}, to come` : 'To come'
    return (
      <div className="pbkt-trow pbkt-trow--empty" style={style}>
        <BlankSlot label={label} />
      </div>
    )
  }
  const isOut = series.eliminated?.id === slot.club.id
  const isWon = series.decided && series.winner.id === slot.club.id
  return (
    <div className={`pbkt-trow${isOut ? ' pbkt-trow--out' : isWon ? ' pbkt-trow--won' : ''}`} style={style}>
      {!rail && <ClubMark club={slot.club} eliminated={isOut} size={16} />}
      <span className="pbkt-trow__abbr">{slot.club.abbreviation}</span>
      {bye && <span className="pbkt-trow__bye">Bye</span>}
      <Pips winsNeeded={series.winsNeeded} wins={slot.wins} />
    </div>
  )
}

// The brief's one bold moment, or a plain "Today · Game N" note. No "To the
// next round" line: the connector already says where a winner goes (Gary,
// 2026-09-28). Shown for a deciding game even on a day it isn't played
// (Concept A: a 2-2 series still reads "Winner take all", with its next
// date, before the day it actually plays).
function BoxNote({ series, x, y, w }) {
  if (series.decided) return null
  const style = { left: x, top: y, width: w }
  if (isDecidingGame(series)) {
    const next = series.upcoming.find((u) => u.date)?.date
    return (
      <div className="pbkt-note" style={style}>
        <span className="pbkt-marker">Winner take all</span>
        {!series.playsOnCutoff && next && <span className="pbkt-when"> {humanDate(next).split(',')[0]}</span>}
      </div>
    )
  }
  if (series.playsOnCutoff) {
    return (
      <div className="pbkt-note" style={style}>
        <span className="pbkt-today">Today · Game {series.cutoffGame.gameNumber}</span>
        {isElimination(series) && <span className="pbkt-when"> · facing elimination</span>}
      </div>
    )
  }
  return null
}

// One series box: two club rows and a note — the same box before, during and
// after its round, so a finished series still shows how long it went. Every
// series taps through with slice 3's `seriesHref`.
function SeriesBox({ series, bracket, cutoff, historyIds, x, y, w, note, rail, byeSlot = -1 }) {
  const linkProps = useRouteLink()
  const href = series.id ? seriesHref(series, cutoff, historyIds) : null
  const Wrapper = href ? 'a' : 'div'
  const wrapperProps = href ? linkProps(href) : { role: 'group' }
  const sides = series.slots
    .map((slot) => (slot.club ? `${slot.club.name} ${slot.wins} ${slot.wins === 1 ? 'win' : 'wins'}` : 'to come'))
    .join(', ')
  const label = series.decided
    ? `${series.name}. ${recordLine(series)}.`
    : `${series.name}. ${sides}, best of ${series.bestOf}.`
  return (
    <>
      <Wrapper
        className={`pbkt-box${isDecidingGame(series) ? ' pbkt-box--bold' : ''}${series.decided ? ' pbkt-box--done' : ''}`}
        style={{ left: x, top: y, width: w, height: BOX }}
        aria-label={label}
        {...wrapperProps}
      />
      <BoxRow slot={series.slots[0]} series={series} bracket={bracket} x={x} y={y} w={w} rail={rail} bye={byeSlot === 0} />
      <BoxRow slot={series.slots[1]} series={series} bracket={bracket} x={x} y={y + R} w={w} rail={rail} bye={byeSlot === 1} />
      {note}
    </>
  )
}

// One league's tree: Wild Card and Division side by side (a lane per
// Division series, fed by whichever Wild Card series names it — never by
// slot position), the LCS centered against both lanes.
function League({ league, leagueId, leagueKey, name, roundName, bracket, cutoff, historyIds, rail }) {
  const phase = leaguePhase(league)
  const c = columns(phase, rail)
  const xWC = 0
  const xDS = c.wc + GAP
  const xLCS = xDS + c.ds + GAP
  const wcPast = phase !== 'wildcard'
  const dsPast = phase === 'lcs' || phase === 'done'
  // Per half: the Division box at 0, the Wild Card box under it.
  const HALF = 132
  const halves = rail ? [0, RAIL_LANE] : [0, HALF + 12]
  const dsY = (h) => halves[h] + (rail ? 2 : 16)
  // Rail: level with the Division box it feeds. Otherwise: under it.
  const wcY = (h) => (rail ? dsY(h) : halves[h] + 16 + BOX + 14)
  const lcsY = (dsY(0) + dsY(1)) / 2 + R / 2
  const H = rail ? 2 * RAIL_LANE : halves[1] + HALF + 14
  const treeW = rail ? RAIL_TREE_W : TREE_W
  const wcFor = (ds) => league.wildcard.find((w) => w.feeds === ds.key) ?? null

  const lanes = league.division.map((ds, h) => ({ ds, wc: wcFor(ds), h, bye: byeSlotIndex(ds) }))

  return (
    <LeagueFrame rail={rail} name={name}>
      {!rail && (
        <header className="pbkt-lghead">
          <TeamLogo teamId={leagueId} name={name} size={22} className="pbkt-mark" />
          <h3 className="pbkt-lgname">{name}</h3>
          {/* The round this league is in, as MLB's own mark — the column
              head below already says it in words, so it is decorative. */}
          <SeriesMark
            mark={leagueRoundMark(bracket, leagueKey)}
            height={22}
            plate
            decorative
            className="pbkt-roundmark"
          />
        </header>
      )}
      <div className="pbkt-colheads" style={{ gridTemplateColumns: `${c.wc}px ${c.ds}px ${c.lcs}px` }}>
        <span className={`pbkt-colhead${phase === 'wildcard' ? ' pbkt-colhead--now' : ''}`}>
          Wild Card
          <span className="pbkt-bestof">Best of 3</span>
        </span>
        <span className={`pbkt-colhead${phase === 'division' ? ' pbkt-colhead--now' : ''}`}>
          Division
          <span className="pbkt-bestof">Best of 5</span>
        </span>
        <span className={`pbkt-colhead${phase === 'lcs' || phase === 'done' ? ' pbkt-colhead--now' : ''}`}>
          {roundName}
          <span className="pbkt-bestof">Best of 7</span>
        </span>
      </div>
      <div className="pbkt-tree" style={{ height: H, width: treeW }}>
        <svg className="pbkt-lines" width={treeW} height={H} aria-hidden="true">
          {lanes.map(({ ds, wc, h, bye }) => {
            const dsFedRow = bye === 0 ? 1 : 0
            return (
              <g key={ds.key}>
                {wc && (
                  <Elbow
                    x1={c.wc}
                    y1={rowCenter(wc, wcPast, wcY(h))}
                    x2={xDS}
                    y2={dsY(h) + (dsFedRow === 0 ? R / 2 : R + R / 2)}
                    inked={wc.decided}
                  />
                )}
                {!rail && !wcPast && bye !== -1 && (
                  <path
                    d={`M${c.wc - 30} ${dsY(h) + (bye === 0 ? R / 2 : R + R / 2)} H${xDS}`}
                    className="pbkt-pencil pbkt-dash"
                  />
                )}
                <Elbow
                  x1={xDS + c.ds}
                  y1={rowCenter(ds, dsPast, dsY(h))}
                  x2={xLCS}
                  y2={lcsY + (h === 0 ? R / 2 : R + R / 2)}
                  inked={ds.decided}
                />
              </g>
            )
          })}
        </svg>
        {lanes.map(({ ds, wc, h, bye }) => (
          <div key={ds.key}>
            {!rail && !wcPast && bye !== -1 && (
              <div
                className="pbkt-bye"
                style={{ left: 0, top: dsY(h) + (bye === 1 ? R : 0), width: c.wc - 36, height: R }}
              >
                Bye
              </div>
            )}
            {wc && (
              <SeriesBox
                series={wc}
                bracket={bracket}
                cutoff={cutoff}
                historyIds={historyIds}
                x={xWC}
                y={wcY(h)}
                w={c.wc}
                rail={rail}
                note={
                  <BoxNote series={wc} x={xWC} y={wcY(h) + BOX + 2} w={c.wc} />
                }
              />
            )}
            <SeriesBox
              series={ds}
              bracket={bracket}
              cutoff={cutoff}
              historyIds={historyIds}
              x={xDS}
              y={dsY(h)}
              w={c.ds}
              rail={rail}
              byeSlot={rail && !wcPast ? bye : -1}
              note={
                <BoxNote
                  series={ds}
                  x={xDS}
                  y={dsY(h) + BOX + 2}
                  w={c.ds + GAP + 20}
                />
              }
            />
          </div>
        ))}
        {league.lcs && (
          <SeriesBox
            series={league.lcs}
            bracket={bracket}
            cutoff={cutoff}
            historyIds={historyIds}
            x={xLCS}
            y={lcsY}
            w={c.lcs}
            rail={rail}
            note={<BoxNote series={league.lcs} x={xLCS} y={lcsY + BOX + 2} w={c.lcs} />}
          />
        )}
      </div>
    </LeagueFrame>
  )
}

// The rail's league is a stamped card with its name on the ink tab, the World
// Series page's frame; elsewhere it is the plain section under its own head.
function LeagueFrame({ rail, name, children }) {
  if (!rail) {
    return (
      <section className="pbkt-league" aria-label={name}>
        {children}
      </section>
    )
  }
  return (
    <Card frame="stamped" body="flush" label={name} labelAs="h3" className="pbkt-league">
      <div className="pbkt-league__body">{children}</div>
    </Card>
  )
}

// The World Series band's note is plain flow text, not absolutely
// positioned like a tree box's — the same wording as `BoxNote` above.
function wsNoteText(series) {
  if (series.decided) return null
  if (isDecidingGame(series)) return 'Winner take all'
  if (series.playsOnCutoff) {
    return `Today · Game ${series.cutoffGame.gameNumber}${isElimination(series) ? ' · facing elimination' : ''}`
  }
  return null
}

// The World Series taps through like any other series (seriesHref), but it
// is the one band that also carries the champion treatment.
function WorldSeriesBand({ bracket, cutoff, historyIds, rail }) {
  const linkProps = useRouteLink()
  const ws = bracket.worldSeries
  if (!ws) return null
  const champion = bracket.champion
  const wsMark = seriesMark({ season: bracket.season, round: 'worldseries' })
  const href = ws.id ? seriesHref(ws, cutoff, historyIds) : null
  const Wrapper = href ? 'a' : 'div'
  const wrapperProps = href ? linkProps(href) : { role: 'group' }
  const label = champion
    ? `World Series. ${recordLine(ws)}.`
    : `World Series. ${ws.slots.map((s) => (s.club ? `${s.club.name} ${s.wins} ${s.wins === 1 ? 'win' : 'wins'}` : 'to come')).join(', ')}, best of 7.`
  const rows = ws.slots.map((slot, i) => {
    const isOut = ws.eliminated?.id === slot.club?.id
    const isWon = ws.decided && ws.winner.id === slot.club?.id
    return (
      <div key={i} className={`pbkt-row${isOut ? ' pbkt-row--out' : isWon ? ' pbkt-row--won' : ''}`}>
        {slot.club ? (
          <>
            {!rail && <ClubMark club={slot.club} eliminated={isOut} size={20} />}
            <span className="pbkt-row__abbr">{slot.club.name}</span>
            <Pips winsNeeded={ws.winsNeeded} wins={slot.wins} />
          </>
        ) : (
          <BlankSlot label={feederSeries(bracket, slot.from)?.label ? `Winner of ${feederSeries(bracket, slot.from).label}, to come` : 'To come'} />
        )}
      </div>
    )
  })
  const note = wsNoteText(ws)
  // The rail's Series is a stamped, tinted card named on the ink tab, the World
  // Series page's frame: no marks, no navy band, no trophy. The whole card taps through.
  if (rail) {
    return (
      <Wrapper className="pbkt-wslink" aria-label={label} {...wrapperProps}>
        <Card
          frame="stamped"
          tone="tint"
          label={champion ? champion.name : 'World Series'}
          labelAs="h3"
          count={champion ? `Won it in ${ws.gamesPlayed}` : 'Best of 7'}
          className={`pbkt-wscard${isDecidingGame(ws) ? ' pbkt-wscard--bold' : ''}`}
        >
          {rows}
          {note && <p className="pbkt-box__note">{note}</p>}
        </Card>
      </Wrapper>
    )
  }
  return (
    <Wrapper
      className={`pbkt-ws${champion ? ' pbkt-ws--champ' : ''}${isDecidingGame(ws) ? ' pbkt-ws--bold' : ''}`}
      aria-label={label}
      {...wrapperProps}
    >
      <div className="pbkt-ws__head">
        <div>
          {/* Before a champion, the World Series mark names the band; its alt
              text is the heading's name. A season with no art keeps the words. */}
          <h3 className="pbkt-ws__name">
            {champion ? champion.name : wsMark ? <SeriesMark mark={wsMark} height={40} /> : 'World Series'}
          </h3>
          <span className="pbkt-ws__sub">
            {champion ? `World Series champions · won it in ${ws.gamesPlayed}` : 'Best of 7'}
          </span>
        </div>
        <Trophy size={champion ? 56 : 40} />
      </div>
      <div className="pbkt-ws__rows">{rows}</div>
      {note && <p className="pbkt-box__note">{note}</p>}
    </Wrapper>
  )
}

export function FullBracket({ bracket, cutoff, historyIds, rail = false }) {
  return (
    <div className={`pbkt-full${rail ? ' pbkt-full--rail' : ''}`}>
      <League
        league={bracket.leagues.AL}
        leagueId={159}
        leagueKey="AL"
        name="American League"
        roundName="ALCS"
        bracket={bracket}
        cutoff={cutoff}
        historyIds={historyIds}
        rail={rail}
      />
      <League
        league={bracket.leagues.NL}
        leagueId={160}
        leagueKey="NL"
        name="National League"
        roundName="NLCS"
        bracket={bracket}
        cutoff={cutoff}
        historyIds={historyIds}
        rail={rail}
      />
      <WorldSeriesBand bracket={bracket} cutoff={cutoff} historyIds={historyIds} rail={rail} />
    </div>
  )
}
