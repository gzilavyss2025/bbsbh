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
import { pitchingLinesMarkup } from './pitchingLinesMarkup.js'
import { createElement } from 'react'
import { halfIndex, selectMoundPitcher, selectSkippedBottomHalf } from '../../../../api/select.js'
import { PitcherCard } from '../../../../components/playbyplay/pitcherCard/PitcherCard.jsx'
import { defenseAt } from '../../../../api/gameday/defense.js'
import { battingSideOf } from '../../../../api/gameday/stepCut.js'
import { chipCode, cutAt, orderAt } from './panelData.js'

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
    <table className="gdp__line" aria-label="Line score">
      <thead>
        <tr><th />{cols.map((n) => <th key={n}>{n}</th>)}{['R', 'H', 'E'].map((c, i) => <th key={c} className={i === 0 ? 'is-runs' : undefined}>{c}</th>)}</tr>
      </thead>
      <tbody>{row('top', 'away', meta.away)}{row('bottom', 'home', meta.home)}</tbody>
    </table>
  )
}

// Nothing on the trail until the half's first at-bat is revealed.
const Trail = ({ ctx }) => (
  <Sealable ctx={ctx} quiet>
    {({ cards, more }) => cards.length === 0 ? null : (
      <ol className="gdp__trail" aria-label="At-bats this half">
        {cards.slice(-10).map((c) => (
          // The at-bat on screen (ctx.here) is marked; the ones after it, already read, sit back.
          <li key={c.atBatIndex} aria-current={c.atBatIndex === ctx.here ? 'step' : undefined}
            className={['gdp__chip', c.outNumber != null && 'is-out', ctx.here != null && c.atBatIndex === ctx.here && 'is-here',
              ctx.here != null && c.atBatIndex > ctx.here && 'is-ahead'].filter(Boolean).join(' ')}>
            {/* A tap plays this at-bat again on the stage (stage/tapRule.js replay). */}
            <button type="button" className="gdp__replay" disabled={!ctx.onReplay} onClick={() => ctx.onReplay?.(c.atBatIndex)}
              aria-label={`Replay: ${chipCode(c) || 'at-bat'}, ${c.batter?.last ?? c.batter?.fullName ?? ''}`}>
              <b>{chipCode(c) || '···'}</b><span>{c.batter?.last ?? c.batter?.fullName}</span>
            </button>
          </li>
        ))}
        {more && <li className="gdp__chip gdp__chip--cover"><b>Sealed</b></li>}
      </ol>
    )}
  </Sealable>
)

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
        {({ cards }) => (
          <ol className="gdp__order">
            {atTheTop(orderAt(ctx.feed, side, ctx.inning, ctx.half, ctx.mark, cards), ctx, cards).map((r, i) => (
              <li key={r.slot} data-up={i === 0 || undefined}>
                <Headshot personId={r.id} name={r.last} tint={false} className="gdp__shot" />
                <span className="gdp__who"><PlayerLink id={r.id} name={[r.first, r.last].filter(Boolean).join(' ')}>{r.first && <small>{r.first}</small>}<b>{r.last}</b></PlayerLink></span>
                <span className="gdp__tag">{r.jersey && <b>{r.jersey}</b>}{r.position && <i>{r.position}</i>}</span>
                {r.trip && <span className="gdp__trip"><PlayDiamond reached={r.trip.reached} scored={r.trip.scored} earned={r.trip.earned} legNotations={r.trip.legNotations ?? {}} outAt={r.trip.outAt ?? null} outCode={r.trip.outCode ?? ''} size={56} onLeg /></span>}
                {r.outcome && <span className="gdp__trip gdp__trip--code"><b>{r.outcome}</b></span>}
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
function Field({ ctx }) {
  const { feed, inning, half, mark } = ctx
  const v = feed?.gameData?.venue
  const layout = resolveBallparkLayout({ venueId: v?.id, venueName: v?.name, gameDate: feed?.gameData?.datetime?.officialDate })
  if (!layout) return <p className="gdp__sealed">No park drawing for this venue.</p>
  const win = parkWindow(layout)
  return (
    <Sealable ctx={ctx} reach>
      {({ cap }) => {
        const by = defenseAt(feed, { inning, half, step: cap, revealedThrough: mark }) ?? {}
        return (
          <>
            <div className="lfld__field" style={{ aspectRatio: win.aspectRatio }}>
              <BallparkDiagram layout={layout} viewBox={win.viewBox} className="lfld__park" label={`${v?.name} with the defense`} />
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
          </>
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
        const pitches = l?.pitches ?? 0
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
  return <PitcherCard feed={feed} pitcher={pitcher} teamId={club.id} teamName={club.clubName} side={side} treatment={treatment} relief={false} tonight={tonight} showLast={false} gameday className="gdarm" />
}

const EventLog = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {({ cards }) => (
      <div className="gdp__log">
        <span className="gdp__label">This half</span>
        {cards.map((c) => (
          <p key={c.atBatIndex}><b>{c.batter?.last}</b> {c.descSegments?.map((s) => s.text ?? s).join('')}</p>
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
