import '../../../../styles/gameday-next/panels.css'
import '../../../../styles/lineup-next/field.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { bandPaint } from '../../../../lib/pitcherCard/card.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { PlayDiamond } from '../../../../components/scoring/PlayDiamond.jsx'
import { ScoutLine } from './ScoutLine.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { BallparkDiagram } from '../../../../components/ballpark/BallparkDiagram.jsx'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { DEFENSE_SPOTS } from '../../../../lib/ballpark/layout/defenseWindow.js'
import { parkWindow } from '../../../../lib/ballpark/layout/parkWindow.js'
import { revealInning } from '../../../../api/linescore.js'
import { selectDueUpDuring } from '../../../../api/dueup.js'
import { pitcherDayLine, pitchingDayLines } from '../../../../api/gameday/dayLine.js'
import { tonightPitches } from '../../../../api/gameday/pitchMix.js'
import { ArmTabs, ArmGameLog, TonightMix } from './ArmTabs.jsx'
import { ScoutVerdict } from './ScoutVerdict.jsx'
import { pitchingLinesMarkup } from './pitchingLinesMarkup.js'
import { createElement, useState } from 'react'
import { halfIndex, selectLineup, selectMoundPitcher, selectSkippedBottomHalf } from '../../../../api/select.js'
import { PitcherCard } from '../../../../components/playbyplay/pitcherCard/PitcherCard.jsx'
import { defenseAt } from '../../../../api/gameday/defense.js'
import { battingSideOf } from '../../../../api/gameday/stepCut.js'
import { chipCode, cutAt, orderAt, withOpenRunning } from './panelData.js'

// Gameday's panels (#2568), one per ladder block. `ctx` is the reader's cursor: the half on
// screen, `step` (the entry count PlayByPlay is capped at; null once the half is committed) and
// `mark`, the reveal mark. Anything that shows a result reads inside a SealBox, up to the cursor
// (ADR-0016). A panel that shows only the half's reference (the Field tab, the order's names) opens
// with the half the reader may reach, revealedThrough + 1 (ADR-0010); the rest wait for a step.
// The navigator's run cells stay the only way to reach a half more than one step away (ADR-0043).

// Result-bearing panels draw through here; `key` re-seals on every half, as the page does. Until
// the panel may show, the slot says "Sealed" (a label, outside the box: it holds no value).
// `quiet`: draw nothing at all until then (the trail: an empty strip says nothing).
function Sealable({ ctx, reach = false, quiet = false, children }) {
  const { feed, inning, half, step, mark } = ctx
  const idx = halfIndex(inning, half)
  const shown = reach ? idx <= mark + 1 : idx <= mark || step > 0
  if (!shown) return quiet ? null : <p className="gdp__sealed">Sealed</p>
  return (
    <SealBox key={`${inning}-${half}`} forceRevealed coverless>
      {() => children(cutAt(feed, inning, half, idx <= mark ? null : step))}
    </SealBox>
  )
}

function Navigator({ ctx }) {
  const { feed, regulation, unlocked, mark, runsInProgress, curIdx, onSelect, disabled, meta } = ctx
  const cols = Array.from({ length: Math.max(regulation, unlocked) }, (_, i) => i + 1)
  const cell = (n, half, side) => {
    const idx = halfIndex(n, half)
    if (idx <= mark) return revealInning(feed, n, side)
    if (idx === runsInProgress?.idx) return { runs: runsInProgress.runs, hits: runsInProgress.hits }
    // The half being stepped through, before its first run reaches the screen: 0 so far, never a later
    // play's count (Gary, 2026-10-29). It rises only as runsInProgress does.
    if (idx === curIdx && idx === mark + 1) return { runs: 0, hits: 0 }
    return null
  }
  // R / H / E as of the cursor: runs and hits over the club's halves on the line, errors (a fielding
  // stat, ADR-0006) over the halves it fielded that are revealed. A club that has not batted reads 0 0 0.
  const totals = (half, side) => {
    const other = half === 'top' ? 'bottom' : 'top'
    let r = 0; let hits = 0; let e = 0
    for (const n of cols) {
      const l = n <= unlocked ? cell(n, half, side) : null
      if (l) { r += l.runs ?? 0; hits += l.hits ?? 0 }
      if (halfIndex(n, other) <= mark) e += revealInning(feed, n, side)?.errors ?? 0
    }
    return [r, hits, e]
  }
  const row = (half, side, m) => (
    <tr key={side}>
      <th scope="row" aria-label={m.abbreviation} style={bandPaint({ teamId: m.id, side, treatment: ctx.treatment }).style}>
        <TeamLogo teamId={m.id} name={m.abbreviation} size={30} variant="mono" className="gdp__club sectionhead__mark" />
      </th>
      {cols.map((n) => {
        const idx = halfIndex(n, half)
        const l = n <= unlocked ? cell(n, half, side) : null
        // A bottom half never played (the game ended in the top), known once the top is revealed.
        const skipped = half === 'bottom' && halfIndex(n, 'top') <= mark && selectSkippedBottomHalf(feed, n)
        return (
          <td key={n}>
            <button
              type="button"
              className="gdp__run"
              aria-current={idx === curIdx || undefined}
              aria-disabled={disabled || undefined}
              disabled={n > unlocked || skipped}
              aria-label={`${half === 'top' ? 'Top' : 'Bottom'} ${n}${skipped ? ', not played' : l ? `, ${l.runs} runs` : ', sealed'}`}
              onClick={() => onSelect(idx)}
            >
              {skipped ? '✕' : l ? l.runs : ''}{/* a sealed half is an empty cell, as on paper */}
            </button>
          </td>
        )
      })}
      {totals(half, side).map((v, i) => <td key={`t${i}`} className={i === 0 ? 'gdp__tot is-runs' : 'gdp__tot'}>{v}</td>)}
    </tr>
  )
  return (
    <div className="gdp__linescroll">
    <table className="gdp__line" aria-label="Line score">
      <thead>
        <tr><th />{cols.map((n) => <th key={n}>{n}</th>)}{['R', 'H', 'E'].map((c, i) => <th key={c} className={i === 0 ? 'is-runs' : undefined}>{c}</th>)}</tr>
      </thead>
      <tbody>{row('top', 'away', meta.away)}{row('bottom', 'home', meta.home)}</tbody>
    </table>
    </div>
  )
}

// Before the half's first at-bat is revealed the trail holds one chip, the leadoff man's (Gary, 2026-10-29): the
// half within reach and nothing on it yet. His name is the lineup's, not a result.
const Trail = ({ ctx }) => (
  <Sealable ctx={ctx} reach quiet>
    {({ cards, more }) => cards.length === 0 ? (
      <ol className="gdp__trail" aria-label="At-bats this half">
        <li className="gdp__chip gdp__chip--cover"><b>{upNext(ctx, cards) || 'Sealed'}</b></li>
      </ol>
    ) : (
      <ol className="gdp__trail" aria-label="At-bats this half">
        {cards.slice(-10).map((c) => (
          // The at-bat on screen (ctx.here) is marked; the ones after it, already read, sit back.
          <li key={c.atBatIndex} aria-current={c.atBatIndex === ctx.here ? 'step' : undefined}
            className={['gdp__chip', c.outNumber != null && 'is-out', ctx.here != null && c.atBatIndex === ctx.here && 'is-here',
              ctx.here != null && c.atBatIndex > ctx.here && 'is-ahead'].filter(Boolean).join(' ')}>
            {/* A tap plays this at-bat again on the stage (stage/tapRule.js replay). */}
            <button type="button" className="gdp__replay" disabled={!ctx.onReplay} onClick={() => ctx.onReplay?.(c.atBatIndex)}
              aria-label={`Replay: ${chipCode(c) || 'at-bat'}, ${c.batter?.last ?? c.batter?.fullName ?? ''}`}>
              <b>{codeMark(c) || '···'}</b><span>{c.batter?.last ?? c.batter?.fullName}</span>
            </button>
          </li>
        ))}
        {/* The at-bat still open names its batter, as the hero does, instead of "Sealed" (Gary, 2026-10-28). */}
        {/* Once a pitch of it is on screen, the open at-bat's chip is the way back from a replay to
            where the reader was (Gary, 2026-10-29). */}
        {more && (ctx.onBack && ctx.open?.sub > 0
          ? <li className="gdp__chip gdp__chip--cover"><button type="button" className="gdp__replay" onClick={ctx.onBack} aria-label={`Back to ${upNext(ctx, cards) || 'the at-bat'}`}><b>{upNext(ctx, cards) || 'Sealed'}</b></button></li>
          : <li className="gdp__chip gdp__chip--cover"><b>{upNext(ctx, cards) || 'Sealed'}</b></li>)}
      </ol>
    )}
  </Sealable>
)

// The batter due after the last at-bat shown (the hero's own due-up): the next play's matchup would name
// a pinch hitter before his own notice.
const upNext = (ctx, cards) => selectDueUpDuring(ctx.feed, ctx.inning, ctx.half, ctx.mark, cards.at(-1)?.atBatIndex ?? null, 1)?.batters?.[0]?.last ?? ''

// A called third strike's K turns backwards, as the hero box and the scorebook draw it (Gary, 2026-10-28).
const codeMark = (c) => (c.calledLooking && chipCode(c) === 'K' ? <span className="gdp__kback">K</span> : chipCode(c))

// Names and slots are the order entering the half (lineupEntering gates itself); the at-bat result codes no longer show.
// The order turned so the batter at the plate leads and the rest follow in turn, wrapping to the
// ones just retired. `cards` is what the reader has seen, so the lead is the slot after the last
// plate appearance on screen (selectDueUpDuring, the hero's own due-up); before any, the half's leadoff.
function atTheTop(rows, ctx, cards) {
  const up = selectDueUpDuring(ctx.feed, ctx.inning, ctx.half, ctx.mark, cards.at(-1)?.atBatIndex ?? null, 1)?.batters?.[0]?.slot
  const i = rows.findIndex((r) => r.slot === up)
  return i > 0 ? [...rows.slice(i), ...rows.slice(0, i)] : rows
}

function BattingOrder({ ctx }) {
  const side = battingSideOf(ctx.half)
  const club = ctx.meta?.[side] ?? {}
  const band = bandPaint({ teamId: club.id, side, treatment: ctx.treatment })
  // The pitcher the batter at the top faces (the Arm panel's own read), for his Scout row.
  const up = ctx.pitcherId ?? selectMoundPitcher(ctx.feed, ctx.inning, ctx.half, ctx.mark, { opening: !ctx.openingHeld })?.id ?? null
  return (
    <>
      {/* The batting club's own band, as the lineup page's cards wear it (ADR-0030). */}
      <div className="gdp__band" style={band.style}>
        <SectionHead look="band" as="h3" mark={<TeamLogo teamId={club.id} name={club.clubName ?? ''} size={22} variant="mono" crop="bar" className="sectionhead__mark" />}>
          Due up
        </SectionHead>
      </div>
      <Sealable ctx={ctx} reach>
        {({ cards, hitters }) => (
          <ol className="gdp__order">
            {atTheTop(withOpenRunning(orderAt(ctx.feed, side, ctx.inning, ctx.half, ctx.mark, cards, hitters), ctx.feed, ctx.inning, ctx.half, ctx.open), ctx, cards).map((r, i) => (
              <li key={r.slot} data-up={i === 0 || undefined}>
                <Headshot personId={r.id} name={r.last} tint={false} className="gdp__shot" />
                <span className="gdp__who"><PlayerLink id={r.id} name={[r.first, r.last].filter(Boolean).join(' ')}>{r.first && <small>{r.first}</small>}<b>{r.last}</b></PlayerLink></span>
                <span className="gdp__tag">{r.jersey && <b>{r.jersey}</b>}{r.position && <i>{r.position}</i>}</span>
                {r.trip && <span className="gdp__trip"><PlayDiamond reached={r.trip.reached} scored={r.trip.scored} earned={r.trip.earned} legNotations={r.trip.legNotations ?? {}} outAt={r.trip.outAt ?? null} outCode={r.trip.outCode ?? ''} size={56} onLeg />
                  {/* How he reached (2B, BB, E6), in the diamond as the scorer pencils it (Gary, 2026-10-28). */}
                  {chipCode(r.trip) && <b className={r.trip.scored ? 'gdp__tripcode is-scored' : 'gdp__tripcode'}>{chipCode(r.trip)}</b>}</span>}
                {r.outcome && <span className="gdp__trip gdp__trip--code"><b>{r.looking && r.outcome === 'K' ? <span className="gdp__kback">K</span> : r.outcome}</b></span>}
                {i === 0 && up && <ScoutLine feed={ctx.feed} hitterId={r.id} pitcherId={up} />}
              </li>
            ))}
          </ol>
        )}
      </Sealable>
    </>
  )
}

// The Field tab: FieldCard's park with surnames at the spots, the defense as of the cursor.
// The other club's alignment, for the Field card's flip (Gary, 2026-10-28): the batting side as it last
// took the field, its half already behind the reader (the half before this one), else its lineup card
// (the top of the 1st, before it has fielded). Pre-pitch and reference data only.
function otherDefense(feed, inning, half, mark) {
  const prev = half === 'bottom' ? { inning, half: 'top' } : { inning: inning - 1, half: 'bottom' }
  const by = prev.inning >= 1 ? defenseAt(feed, { ...prev, step: null, revealedThrough: mark }) : null
  if (by) return by
  const at = {}
  for (const p of selectLineup(feed, battingSideOf(half))) if (p.position) at[p.position] = { id: p.id, last: p.last }
  return at
}

function Field({ ctx }) {
  const { feed, inning, half, mark } = ctx
  const [flipped, setFlipped] = useState(false)
  const v = feed?.gameData?.venue
  const layout = resolveBallparkLayout({ venueId: v?.id, venueName: v?.name, gameDate: feed?.gameData?.datetime?.officialDate })
  if (!layout) return <p className="gdp__sealed">No park drawing for this venue.</p>
  const win = parkWindow(layout)
  const fielding = feed?.gameData?.teams?.[half === 'top' ? 'home' : 'away']
  const batting = feed?.gameData?.teams?.[half === 'top' ? 'away' : 'home']
  const shown = flipped ? batting : fielding
  const other = flipped ? fielding : batting
  return (
    <Sealable ctx={ctx} reach>
      {({ cap }) => {
        const by = (flipped ? otherDefense(feed, inning, half, mark) : defenseAt(feed, { inning, half, step: cap, revealedThrough: mark })) ?? {}
        return (
          <div key={flipped ? 'b' : 'f'} className="gdp__flip">
            <div className="lfld__field" style={{ aspectRatio: win.aspectRatio }}>
              <BallparkDiagram layout={layout} viewBox={win.viewBox} className="lfld__park" label={`${v?.name} with the ${shown?.teamName ?? ''} defense`} />
              {/* The other club's mark turns the card over to its alignment, and back. */}
              <button type="button" className="gdp__flipbtn" aria-pressed={flipped} aria-label={`Show the ${other?.teamName ?? 'other'} defense`} onClick={() => setFlipped(!flipped)}>
                <TeamLogo teamId={other?.id} name={other?.teamName ?? ''} size={32} />
              </button>
              {Object.entries(DEFENSE_SPOTS).map(([pos, xy]) => {
                const { left, top } = win.percent(xy)
                return (
                  <span key={pos} className="lfld__node" style={{ left: `${left}%`, top: `${top}%` }} role="group" aria-label={pos}>
                    <span className={`lfld__name${by[pos] ? '' : ' lfld__name--tbd'}`}>{by[pos]?.last ?? '—'}</span>
                  </span>
                )
              })}
            </div>
            {by.DH && <p className="lfld__dh"><span>DH</span>{by.DH.last}</p>}
          </div>
        )
      }}
    </Sealable>
  )
}

// The park with the defense as of the cursor; the Arms and Extras tabs are later prompts, so there is no tab row yet.
const Reference = ({ ctx }) => (
  <div className="gdp__ref">
    <Field ctx={ctx} />
  </div>
)

// The arm on the mound: the pitcher card (season line, pitch mix, last outing). It reads only
// completed seasons and games, so it holds no score; it opens with the half the reader may reach.
// A pitcher by id from the feed's player index: the card's { id, name, jersey, hand }. No result in it.
function moundPitcher(feed, id) {
  const p = feed?.gameData?.players?.[`ID${id}`]
  if (!p) return null
  const first = p.useName || p.firstName
  return { id, name: p.lastName ? `${p.lastName}${first ? `, ${first}` : ''}` : p.fullName ?? '', jersey: p.primaryNumber ?? '', hand: p.pitchHand?.code ?? '' }
}

function Arm({ ctx }) {
  const { feed, inning, half, mark, meta, pitcherId, treatment } = ctx
  const side = battingSideOf(half) === 'away' ? 'home' : 'away'
  const idx = halfIndex(inning, half)
  if (idx > mark + 1) return <p className="gdp__sealed">Sealed</p>
  // A half-opening change shows on its own sub-step: until then the club's previous man (openingHeld).
  const pitcher = (pitcherId != null && moundPitcher(feed, pitcherId)) || selectMoundPitcher(feed, inning, half, mark, { opening: !ctx.openingHeld })
  if (!pitcher) return null
  const club = meta?.[side] ?? {}
  // His line for the game as of the step: each at-bat the reader reveals lands in it (dayLine.js clamps it).
  const tonight = (
    <Sealable ctx={ctx} reach>
      {() => {
        const l = pitcherDayLine(feed, pitcher.id, { inning, half, step: ctx.step, revealedThrough: mark })
        // In pitch mode the at-bat being stepped through adds its shown pitches (pitchMix.js's clamp).
        const pitches = Math.max(l?.pitches ?? 0, tonightPitches(feed, pitcher.id, { inning, half, step: ctx.step, revealedThrough: mark, open: ctx.open })?.length ?? 0)
        const faced = l?.bf ?? 0
        const cells = [['IP', l?.ip ?? '0.0'], ['H', l?.h ?? 0], ['R', l?.r ?? 0], ['ER', l?.er ?? 0], ['BB', l?.bb ?? 0], ['K', l?.k ?? 0]]
        return (
          <div className="gdp__tonight" aria-label="His line tonight">
            <span className="gdp__tonighthead"><span>{pitches} {pitches === 1 ? 'pitch' : 'pitches'} • {faced} {faced === 1 ? 'batter' : 'batters'} faced</span></span>
            <dl className="gdp__tonightgrid">
              {cells.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
        )
      }}
    </Sealable>
  )
  // The tabs under his line (Gary, 2026-10-29). Pitch Mix and Scout read tonight's game, so each draws in
  // its own seal at the same reach and step as his line above.
  const mix = (
    <Sealable ctx={ctx} reach>
      {() => <TonightMix pitches={tonightPitches(feed, pitcher.id, { inning, half, step: ctx.step, revealedThrough: mark, open: ctx.open })} />}
    </Sealable>
  )
  const game = feed?.gameData ?? {}
  const log = <ArmGameLog pitcherId={pitcher.id} season={game.game?.season} date={game.datetime?.officialDate} gameNumber={game.game?.gameNumber ?? 1} sportId={game.teams?.home?.sport?.id ?? 1} />
  // The batter at the top of the Due up (the same read as that card's Scout row).
  const bat = battingSideOf(half)
  const scout = (
    <Sealable ctx={ctx} reach>
      {({ cards, hitters }) => {
        const up = atTheTop(orderAt(feed, bat, inning, half, mark, cards, hitters), ctx, cards)[0]
        // The Scout page's verdict and things to watch, small (Gary, 2026-10-29); the head-to-head line lives on the Due up card.
        return up ? <div className="gdtabs__scout"><ScoutVerdict pitcherId={pitcher.id} hitterId={up.id} /></div> : null
      }}
    </Sealable>
  )
  return (
    <PitcherCard feed={feed} pitcher={pitcher} teamId={club.id} teamName={club.clubName} side={side} treatment={treatment} relief={false} tonight={tonight} showLast={false} gameday className="gdarm"
      tabs={(arsenal) => <ArmTabs arsenal={arsenal} mix={mix} log={log} scout={scout} />} />
  )
}

// The description reads on from the batter's name, so its verb starts lower case ("strikes out"). A description
// that still opens with his name (the feed spelled it another way, so the trim missed) is left as it is.
const afterName = (t, b) => (/^[A-Z][a-z]/.test(t) && !(b?.first && t.startsWith(b.first)) ? t[0].toLowerCase() + t.slice(1) : t) // caps-js-exempt: sentence case after a name

const EventLog = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {({ cards }) => (
      <div className="gdp__log">
        <span className="gdp__label">This half</span>
        {cards.map((c) => (
          <p key={c.atBatIndex}><b>{c.batter?.last}</b> {afterName(c.descSegments?.map((s) => s.text ?? s).join('') ?? '', c.batter)}</p>
        ))}
      </div>
    )}
  </Sealable>
)

// The scorebook's pitching page, both clubs, as of the step (Gary, 2026-10-28): the Menu's block.
const PitchingLines = ({ ctx }) => (
  <Sealable ctx={ctx} reach>
    {() => pitchingLinesMarkup(createElement, { feed: ctx.feed, lines: pitchingDayLines(ctx.feed, { inning: ctx.inning, half: ctx.half, step: ctx.step, revealedThrough: ctx.mark }) })}
  </Sealable>
)

const PANELS = { navigator: Navigator, trail: Trail, battingOrder: BattingOrder, reference: Reference, arm: Arm, eventLog: EventLog, pitchingLines: PitchingLines }

// The panel for a ladder block, or null for the blocks other prompts build.
export function GamedayPanel({ block, ctx }) {
  const P = PANELS[block]
  return P && ctx ? <P ctx={ctx} /> : null
}
