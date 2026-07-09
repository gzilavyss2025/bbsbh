import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { useNav, useLinkScope } from '../lib/nav.js'
import { playerPath } from '../lib/route.js'
import {
  selectInningCount,
  selectRegulationInnings,
  selectBullpen,
  selectBench,
  selectTeamMeta,
  selectPrePitchChanges,
  halfIndex,
} from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import { revealDerived, rollingPitches } from '../api/derive.js'
import { selectWinProbPath } from '../api/winprob.js'
import { computePitcherLines } from '../api/pitchers.js'
import { defenseEntering } from '../api/defense.js'
import { lineupEntering } from '../api/battingorder.js'
import { prospectBadge } from '../api/prospects.js'
import { SealBox } from '../components/SealBox.jsx'
import { WinProbChart } from '../components/WinProbChart.jsx'
import { PlayByPlay } from '../components/PlayByPlay.jsx'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'
import { ProspectPill } from '../components/ProspectPill.jsx'
import { useRevealProgress } from '../hooks/useRevealProgress.js'

// Half-inning-by-half-inning viewer: each page is one half (top of the 1st,
// then the bottom of the 1st, …), a single SealBox whose one tap reveals that
// half's whole stat line at once (§7b). Navigating between halves remounts the
// panel (key on inning+half) so the box re-seals. Which half shows is driven by
// the URL (`inning`/`half` / `onInning`); the reveal high-water mark lives here
// so it survives navigation.
//
// Extra innings never spoil: only `regulation` innings (9, or 7 for short games)
// are shown up front. Each inning past regulation unlocks one at a time, and only
// once the prior inning has been revealed — so the navigator and boxscore never
// hint that a game went to extras before the user gets there.
export function InningViewer({
  feed,
  started,
  inning,
  half,
  onInning,
  onBoxScore,
  onReload,
  loading,
  pitcherRoles,
  winProbability,
  prospectsData,
}) {
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // Reveal high-water mark, extras-unlock state, and the feed-keyed derived
  // cache — see useRevealProgress. The running line and Pitchers section both
  // read from `revealedThrough`; any half at or below it renders unsealed.
  const { revealedThrough, revealTo, unlocked, getDerived } = useRevealProgress(
    feed,
    regulation,
    actualCount,
  )

  const meta = useMemo(
    () => ({ away: selectTeamMeta(feed, 'away'), home: selectTeamMeta(feed, 'home') }),
    [feed],
  )

  const rosters = useMemo(
    () => ({
      away: {
        name: meta.away.name || 'Away',
        ...splitBullpen(selectBullpen(feed, 'away'), pitcherRoles),
        bench: selectBench(feed, 'away'),
      },
      home: {
        name: meta.home.name || 'Home',
        ...splitBullpen(selectBullpen(feed, 'home'), pitcherRoles),
        bench: selectBench(feed, 'home'),
      },
    }),
    [feed, meta, pitcherRoles],
  )

  // The page being shown, as a half-index clamped to what's unlocked. The last
  // navigable page is the bottom of the last unlocked inning.
  const maxIdx = halfIndex(unlocked, 'bottom')
  const curIdx = Math.min(
    Math.max(0, halfIndex(inning || 1, half === 'bottom' ? 'bottom' : 'top')),
    maxIdx,
  )
  const effInning = Math.floor(curIdx / 2) + 1
  const effHalf = curIdx % 2 === 0 ? 'top' : 'bottom'
  const goTo = (idx) => onInning(Math.floor(idx / 2) + 1, idx % 2 === 0 ? 'top' : 'bottom')

  // The next half within what's unlocked, for the floating advance button (§ the
  // lineup pages' btn--next, carried over to the innings view). Null at the last
  // unlocked half — which is always the bottom of the furthest revealed inning
  // (regulation or an unlocked extra). There the floating button becomes "View
  // box score" instead of Next, so the bottom of the 9th never sprouts a "Next:
  // Top 10th" that would leak the game going to extras before it's revealed.
  const nextIdx = curIdx < maxIdx ? curIdx + 1 : null
  const nextLabel =
    nextIdx == null
      ? null
      : `${nextIdx % 2 === 0 ? 'Top' : 'Bottom'} ${ordinal(Math.floor(nextIdx / 2) + 1)}`

  // Whether the half being shown is still sealed. When it is, the fixed bottom
  // bar's primary action becomes "Reveal {this half}" (in thumb reach, so you
  // never scroll down past the staging lineups to find the kraft cover); once
  // revealed it flips back to the Next / View-box-score advance. Revealing from
  // the bar then scrolls the freshly-uncovered results into view, since the
  // layout flips the results up above where the button sits.
  const currentSealed = curIdx > revealedThrough
  const curHalfLabel = `${effHalf === 'top' ? 'Top' : 'Bottom'} ${ordinal(effInning)}`
  const resultsRef = useRef(null)
  const scrollPendingRef = useRef(false)
  const revealCurrent = () => {
    scrollPendingRef.current = true
    revealTo(effInning, effHalf)
  }
  useEffect(() => {
    if (!scrollPendingRef.current) return
    scrollPendingRef.current = false
    const el = resultsRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.focus?.({ preventScroll: true }) // AT parity: land on the results, not <body>
  }, [revealedThrough])

  // Normalize an out-of-range URL (a mistyped /top12 deep link, a legacy link
  // past what's unlocked) to the half actually being shown, via replaceState so
  // Back never revisits the bogus address. Without this the URL, the stepnav's
  // remembered section, and any re-shared link all keep the phantom inning —
  // and the page would silently jump forward as reveals raise the clamp.
  const urlIdx = halfIndex(inning || 1, half === 'bottom' ? 'bottom' : 'top')
  useEffect(() => {
    if (urlIdx !== curIdx) onInning(effInning, effHalf, { replace: true })
  }, [urlIdx, curIdx, effInning, effHalf]) // eslint-disable-line react-hooks/exhaustive-deps

  // Every pitcher who has appeared in a revealed half-inning, with running lines
  // (see api/pitchers.js). Recomputed as the reveal mark advances.
  const pitcherLines = useMemo(
    () => computePitcherLines(feed, revealedThrough),
    [feed, revealedThrough],
  )

  // The win-probability line "so far" — only the plays through the revealed
  // half. Same reveal gate as the running line and Pitchers table (a
  // reveal-only selector clamped to revealedThrough; see api/winprob.js), so
  // nothing sealed is plotted. Empty until at least one half is revealed, and at
  // MiLB parks with no win-prob feed — the chart then renders nothing.
  const winProbPoints = useMemo(
    () => selectWinProbPath(winProbability, { throughHalf: revealedThrough }),
    [winProbability, revealedThrough],
  )

  if (!started) {
    return (
      <div className="innings">
        <p className="hint hint--prose">
          This game hasn’t started yet. Lineups and info are on the previous
          pages; inning totals appear once first pitch is thrown.
        </p>
        <button className="btn" onClick={onReload} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    )
  }

  return (
    <div className="innings">
      <div className="innings__toolbar">
        <button
          type="button"
          className="refreshbtn"
          onClick={onReload}
          disabled={loading}
          aria-label="Refresh live game data"
        >
          <span className="refreshbtn__icon" aria-hidden="true">
            ↻
          </span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* On a phone these wrappers are inert divs and everything stacks in the
          same order as ever; from the wide breakpoint up they become a grid —
          the half-inning reading pane on the left, the pitchers table, lineups
          & defense reference, and rosters riding a sticky column on the right. */}
      {/* The half-inning heading + Back/Next: full-width above both columns on
          the wide layout, and above the running line on a phone (moved up out of
          the reading pane so it stays put as the feed scrolls). */}
      <nav className="inningnav" aria-label="Half-inning navigator">
        <button
          onClick={() => goTo(Math.max(0, curIdx - 1))}
          disabled={curIdx === 0}
          aria-label="Previous half-inning"
        >
          ‹ Back
        </button>
        <span className="inningnav__label">
          {effHalf === 'top' ? 'Top' : 'Bottom'} {ordinal(effInning)}
        </span>
        <button
          onClick={() => goTo(Math.min(maxIdx, curIdx + 1))}
          disabled={curIdx === maxIdx}
          aria-label="Next half-inning"
        >
          Next ›
        </button>
      </nav>

      <div className="innings__grid">
        <div className="innings__main">
          <RollingLine
            feed={feed}
            regulation={regulation}
            unlocked={unlocked}
            revealedThrough={revealedThrough}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
            curIdx={curIdx}
            onSelect={goTo}
          />

          <WinProbChart
            points={winProbPoints}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
            partial
          />

          {/* key on inning+half → fresh mount; a box at/under the reveal mark stays open. */}
          <div className="inning" key={`${effInning}-${effHalf}`} ref={resultsRef} tabIndex={-1}>
            <HalfInning
              feed={feed}
              inning={effInning}
              half={effHalf}
              battingSide={effHalf === 'top' ? 'away' : 'home'}
              label={effHalf === 'top' ? 'Top' : 'Bottom'}
              battingAbbr={effHalf === 'top' ? meta.away.abbreviation : meta.home.abbreviation}
              pitchingAbbr={effHalf === 'top' ? meta.home.abbreviation : meta.away.abbreviation}
              awayName={meta.away.clubName}
              homeName={meta.home.clubName}
              revealed={curIdx <= revealedThrough}
              isNextToReveal={curIdx === revealedThrough + 1}
              getDerived={getDerived}
              onReveal={revealTo}
              prospectsData={prospectsData}
            />
          </div>
        </div>

        <aside className="innings__side">
          <PitchersSection
            teams={[
              { name: rosters.away.name, rows: pitcherLines.away },
              { name: rosters.home.name, rows: pitcherLines.home },
            ]}
          />

          {/* Lineups & Defense reference — its own right-column card on the wide
              layout (below Pitchers, above the rosters). On a phone this is
              hidden (.innings__reference) and the same reference renders inline
              in the half-inning, staged around the seal (see HalfInning). Gated
              to a half the user has reached — revealed, or the immediate
              next-to-reveal — the same spoiler gate as the inline copy. */}
          {curIdx <= revealedThrough + 1 && (
            <section className="innings__reference">
              <h3 className="innings__reference-title">Lineups &amp; Defense</h3>
              <EnteringReference
                feed={feed}
                inning={effInning}
                half={effHalf}
                battingSide={effHalf === 'top' ? 'away' : 'home'}
                awayName={meta.away.clubName}
                homeName={meta.home.clubName}
                prospectsData={prospectsData}
              />
            </section>
          )}

          <RosterPanel
            title={rosters.away.name}
            roster={rosters.away}
            revealedThrough={revealedThrough}
            prospectsData={prospectsData}
          />
          <RosterPanel
            title={rosters.home.name}
            roster={rosters.home}
            revealedThrough={revealedThrough}
            prospectsData={prospectsData}
          />
        </aside>
      </div>

      {/* Floating bar — the same fixed blue bar the lineup pages page forward
          with. On narrow viewports it carries a duplicate Refresh stacked above
          the primary action, so refreshing live data doesn't mean scrolling back
          up to the toolbar (hidden again on the wide layout, where the top
          toolbar stays reachable). The primary action advances to the next
          half-inning when one is unlocked; at the bottom of the furthest
          revealed inning it becomes "View box score" instead — so the bottom of
          the 9th (or any extra) never shows a "Next: Top 10th" that would leak
          the game going to extras. Revealing that bottom half unlocks the next
          inning and the button flips back to Next. */}
      <div className="pagenav pagenav--innings">
        <button
          type="button"
          className="refreshbtn refreshbtn--float"
          onClick={onReload}
          disabled={loading}
          aria-label="Refresh live game data"
        >
          <span className="refreshbtn__icon" aria-hidden="true">
            ↻
          </span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        {currentSealed ? (
          <button
            type="button"
            className="btn btn--reveal"
            onClick={revealCurrent}
            aria-label={`Reveal ${effHalf === 'top' ? 'top' : 'bottom'} of the ${ordinal(effInning)} inning`}
          >
            <span className="btn__ball" aria-hidden="true">⚾️</span> Reveal {curHalfLabel}
          </button>
        ) : nextIdx != null ? (
          <button className="btn btn--next" onClick={() => goTo(nextIdx)}>
            Next: {nextLabel} →
          </button>
        ) : (
          <button className="btn btn--next" onClick={onBoxScore}>
            View box score →
          </button>
        )}
      </div>
    </div>
  )
}

function HalfInning({
  feed,
  inning,
  half,
  battingSide,
  label,
  battingAbbr,
  pitchingAbbr,
  awayName,
  homeName,
  revealed,
  isNextToReveal,
  getDerived,
  onReveal,
  prospectsData,
}) {
  // The lineups + defense as they stand ENTERING this half — the pre-scoring
  // reference (see EnteringReference). On a phone it's positioned by reveal
  // state: ABOVE the seal while the half is still sealed (stage the sheet before
  // tapping), then BELOW the play-by-play once revealed (out of the way of the
  // results). Only for a half the user has reached; a half further out stays
  // fully sealed — its "entering" state would leak the intervening subs. On the
  // wide layout this inline copy is hidden (.half__entering) and the same
  // reference rides its own card in the right column instead.
  const enteringCards = (
    <div className="half__entering">
      <EnteringReference
        feed={feed}
        inning={inning}
        half={half}
        battingSide={battingSide}
        awayName={awayName}
        homeName={homeName}
        prospectsData={prospectsData}
      />
    </div>
  )

  return (
    <section className="half">
      <h3 className="half__title">
        {label} {ordinal(inning)}
        <span className="half__team">
          {battingAbbr || (battingSide === 'away' ? 'Away' : 'Home')} bats{' '}
          <span className="half__dot" aria-hidden="true">•</span>{' '}
          {pitchingAbbr || (battingSide === 'away' ? 'Home' : 'Away')} pitches
        </span>
      </h3>

      {/* Reached but still sealed: the lineups/defense sit ABOVE the seal, with
          the pre-pitch change list, so the scorer stages the half before
          tapping to reveal the results. See selectPrePitchChanges for why the
          pre-pitch list is spoiler-free, and only for the immediate next half. */}
      {!revealed && isNextToReveal && (
        <>
          <PrePitchChanges
            feed={feed}
            inning={inning}
            half={half}
            pitchingName={battingSide === 'away' ? homeName : awayName}
          />
          {enteringCards}
        </>
      )}

      <SealBox
        forceRevealed={revealed}
        onReveal={() => onReveal(inning, half)}
        coverless
      >
        {() => {
          // Computed only on reveal. R/H/LOB are the batting side's; E is a
          // *fielding* stat, so it belongs to the side in the field this half
          // (the opposite side). The MLB linescore stores a team's per-inning
          // `errors` under that team's node but for the half it fields — reading
          // E off the batting side would both be wrong AND leak the other half's
          // errors (a still-sealed half) into this box.
          const line = revealInning(feed, inning, battingSide)
          const fieldLine = revealInning(feed, inning, battingSide === 'away' ? 'home' : 'away')
          const d = revealDerived(getDerived(), inning, half)
          const rolling = rollingPitches(getDerived(), inning, half)
          return (
            <>
              <div className="rhe">
                <Stat k="R" v={line?.runs ?? 0} tone="run" big />
                <Stat k="H" v={line?.hits ?? 0} big />
                <Stat k="E" v={fieldLine?.errors ?? 0} big />
                <Stat k="LOB" v={line?.leftOnBase ?? 0} big />
              </div>
              <div className="pitchgrid">
                <Stat k="Pitches" v={d.pitches} />
                <Stat k="Total pitches" v={rolling} unit="rolling" />
                <Stat k="Whiffs" v={d.whiffs} />
                <Stat
                  k="1st-pitch strikes"
                  v={`${d.firstPitchStrikes}/${d.plateAppearances}`}
                  small
                />
              </div>
              <PlayByPlay
                feed={feed}
                inning={inning}
                half={half}
                battingSide={battingSide}
              />
              {/* Statcast superlatives for the half — the game-notes numbers
                  (fastest pitch, hardest/longest ball), sat below the feed.
                  Tracking data is often absent at MiLB levels, so the row only
                  renders when the feed carried it. Same reveal path as above. */}
              {(d.maxVelo != null || d.hardestHit != null || d.longestHit != null) && (
                <div className="statcast">
                  {d.maxVelo != null && (
                    <StatcastCard
                      label="Fastest pitch"
                      value={d.maxVelo.toFixed(1)}
                      unit="MPH"
                      who={d.maxVeloPlayer}
                      detail={d.maxVeloType}
                    />
                  )}
                  {d.hardestHit != null && (
                    <StatcastCard
                      label="Hardest hit"
                      value={d.hardestHit.toFixed(1)}
                      unit="MPH"
                      who={d.hardestHitPlayer}
                    />
                  )}
                  {d.longestHit != null && (
                    <StatcastCard
                      label="Longest ball"
                      value={Math.round(d.longestHit)}
                      unit="FT"
                      who={d.longestHitPlayer}
                    />
                  )}
                </div>
              )}
            </>
          )
        }}
      </SealBox>

      {/* Revealed: the same cards drop BELOW the play-by-play (see enteringCards). */}
      {revealed && enteringCards}
    </section>
  )
}

// The running line at the top of the innings view. It "builds as you reveal":
// each half you uncover drops its runs into this grid; halves you haven't
// revealed stay blank (·). It only reads a linescore value along a reveal path:
// a cell is read only when its half-index is at or below `revealedThrough`, so
// nothing sealed is ever computed into the grid.
//
// It doubles as the half-inning navigator: every run cell is a button that jumps
// to that half (away row = tops, home row = bottoms), with the current half
// highlighted — so selecting a half reads like reading a line score, no separate
// scrolling chip strip. The Back/Next nav above covers the full unlocked range in
// the rare extra-innings case where the visible window has scrolled a half off.
//
// The grid can only hold `regulation` inning columns, so once extra innings
// unlock it scrolls that window forward — dropping inning 1 when inning 10
// appears, inning 2 for 11, and so on — while the R/H/E totals stay cumulative
// over every revealed inning.
function RollingLine({
  feed,
  regulation,
  unlocked,
  revealedThrough,
  awayAbbr,
  homeAbbr,
  curIdx,
  onSelect,
}) {
  const firstCol = Math.max(1, unlocked - regulation + 1)
  const cols = []
  for (let n = firstCol; n <= unlocked; n++) cols.push(n)

  const lineFor = (n, half, side) =>
    halfIndex(n, half) <= revealedThrough ? revealInning(feed, n, side) : null

  const rows = [
    { abbr: awayAbbr || 'AWY', half: 'top', side: 'away' },
    { abbr: homeAbbr || 'HOM', half: 'bottom', side: 'home' },
  ]

  // Totals span every revealed inning (1..unlocked), not just the visible window.
  // R/H are batting stats gated on the batting half; E is a *fielding* stat, so
  // it accrues in — and is gated on — the opposite (fielding) half. Gating E on
  // the batting half would leak the fielding half's errors before it's revealed.
  const totals = (battingHalf, side) => {
    const fieldingHalf = battingHalf === 'top' ? 'bottom' : 'top'
    let r = 0, h = 0, e = 0, any = false
    for (let n = 1; n <= unlocked; n++) {
      if (halfIndex(n, battingHalf) <= revealedThrough) {
        const l = revealInning(feed, n, side)
        if (l) { any = true; r += l.runs; h += l.hits }
      }
      if (halfIndex(n, fieldingHalf) <= revealedThrough) {
        e += revealInning(feed, n, side)?.errors ?? 0
      }
    }
    return { r, h, e, any }
  }

  return (
    <section className="rolling" aria-label="Running line">
      <div className="rolling__scroll">
        <table className="rolling__grid">
          <thead>
            <tr>
              <th className="rolling__corner" />
              {cols.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th className="rolling__tot">R</th>
              <th className="rolling__tot">H</th>
              <th className="rolling__tot">E</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const t = totals(row.half, row.side)
              return (
                <tr key={row.side}>
                  <th className="rolling__team">{row.abbr}</th>
                  {cols.map((n) => {
                    const l = lineFor(n, row.half, row.side)
                    const idx = halfIndex(n, row.half)
                    const active = idx === curIdx
                    return (
                      <td key={n} className="rolling__cell">
                        <button
                          type="button"
                          className={`rolling__pick ${active ? 'is-active' : ''} ${
                            l ? '' : 'rolling__pending'
                          } ${l && l.runs > 0 ? 'rolling__runs' : ''}`}
                          aria-current={active ? 'true' : undefined}
                          // The label must carry the cell's value too — it
                          // overrides the visible text in the accessible name,
                          // and "Top of inning 3" alone hides both the runs
                          // and the sealed/revealed distinction from a screen
                          // reader. Revealed runs are only read here when the
                          // half is already at/under the reveal mark.
                          aria-label={`${row.half === 'top' ? 'Top' : 'Bottom'} of inning ${n}${
                            l ? `, ${l.runs} run${l.runs === 1 ? '' : 's'}` : ', sealed'
                          }`}
                          onClick={() => onSelect(idx)}
                        >
                          {l ? l.runs : '·'}
                        </button>
                      </td>
                    )
                  })}
                  <td className="rolling__tot">{t.any ? t.r : '·'}</td>
                  <td className="rolling__tot">{t.any ? t.h : '·'}</td>
                  <td className="rolling__tot">{t.any ? t.e : '·'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="rolling__cap">Tap a half to open it; runs fill in as you reveal.</p>
    </section>
  )
}

// Running pitching lines for every pitcher who has appeared in a revealed
// half-inning — a separate block per team, each led by the team name with its
// own header row. Lines are cumulative through the reveal mark (see
// api/pitchers.js); nothing sealed is shown. Deliberately not behind a SealBox —
// it mirrors the running line's reveal state. Sized to fit a phone with no
// horizontal scroll: the caps-locked name auto-shrinks to one line (PitcherName)
// while the numeric columns hold their size, and the jersey number is inked in
// clay red and right-aligned within its own slot in the Pitcher cell.
function PitchersSection({ teams }) {
  const shown = teams.filter((t) => t.rows.length > 0)
  if (shown.length === 0) return null
  return (
    <section className="pitchers">
      <h3 className="pitchers__title">Pitchers</h3>
      {shown.map((t) => (
        <div className="pitchers__team" key={t.name}>
          <h4 className="pitchers__teamname">{t.name}</h4>
          <table className="pitchers__grid">
            <thead>
              <tr>
                <th className="pitchers__pitcher">Pitcher</th>
                <th>R/L</th>
                <th>IP</th>
                <th>P</th>
                <th>BF</th>
                <th>H</th>
                <th>R</th>
                <th>ER</th>
                <th>BB</th>
                <th>K</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((p) => (
                <tr key={p.id}>
                  <td className="pitchers__pitcher">
                    <div className="pitchers__cell">
                      <PitcherName id={p.id} last={p.last} first={p.first} />
                      {p.jersey ? (
                        <span className="pitchers__num">{p.jersey}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{p.hand || '—'}</td>
                  <td>{p.ip}</td>
                  <td>{p.pitches}</td>
                  <td>{p.bf}</td>
                  <td>{p.h}</td>
                  <td>{p.r}</td>
                  <td>{p.er}</td>
                  <td>{p.bb}</td>
                  <td>{p.k}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}

// A pitcher's name, always drawn in caps (see .pitchers__pname), auto-shrunk to
// fit its column on one line so a long name never widens the table into a
// horizontal scroll. Only the NAME shrinks — the numeric columns keep their
// size. The name span is `flex: 1` so its box always fills the space the layout
// gives it (stable clientWidth); we step the font down from the CSS max until
// the rendered text (scrollWidth) fits, or we hit the floor. A ResizeObserver
// re-fits when the column width changes (extra innings unlocking, rotation).
const NAME_MAX_PX = 12
const NAME_MIN_PX = 8
function PitcherName({ id, last, first }) {
  const ref = useRef(null)
  const navigate = useNav()
  const { asOf, sportId } = useLinkScope()
  const text = `${last}${first ? `, ${first}` : ''}`

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let size = NAME_MAX_PX
      el.style.fontSize = `${size}px`
      while (size > NAME_MIN_PX && el.scrollWidth > el.clientWidth) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])

  // The clickable element IS the ref'd, auto-shrunk element (a plain span when
  // there's no id) so the fit logic measures the same box either way and the
  // table layout is unchanged.
  if (!id) {
    return (
      <span className="pitchers__pname" ref={ref}>
        {text}
      </span>
    )
  }
  return (
    <button
      type="button"
      ref={ref}
      className="plink pitchers__pname"
      onClick={() => navigate(playerPath(id, { d: asOf, s: sportId }))}
    >
      {text}
    </button>
  )
}

function Stat({ k, v, unit, tone, big, small }) {
  return (
    <div
      className={`stat ${big ? 'stat--big' : ''} ${small ? 'stat--small' : ''} ${
        tone ? `stat--${tone}` : ''
      }`}
    >
      <span className="stat__v">{v}</span>
      <span className="stat__k">
        {k}
        {unit ? <em className="stat__unit"> {unit}</em> : null}
      </span>
    </div>
  )
}

// One Statcast superlative below the feed: the measure up top (FASTEST PITCH),
// the value with its unit trailing in a smaller face (95.2 MPH), then who did
// it beneath — a pitcher's card also names the pitch type (MAY (SINKER)).
function StatcastCard({ label, value, unit, who, detail }) {
  return (
    <div className="statcast__card">
      <span className="statcast__label">{label}</span>
      <span className="statcast__value">
        {value}
        <em className="statcast__unit"> {unit}</em>
      </span>
      {who && (
        <span className="statcast__who">
          {who.toUpperCase()}
          {detail ? ` (${detail.toUpperCase()})` : ''}
        </span>
      )}
    </div>
  )
}

// Subs/pitching changes announced before this half's first pitch — rendered
// above the SealBox (not inside it), gated by the caller to the half the user
// is about to reveal. See selectPrePitchChanges for why this is spoiler-free.
function PrePitchChanges({ feed, inning, half, pitchingName }) {
  const changes = selectPrePitchChanges(feed, inning, half)
  if (changes.length === 0) return null
  return (
    <div className="prepitch">
      <ul className="prepitch__list">
        {changes.map((c, i) => (
          <li className="prepitch__item" key={i}>
            {c.eventType === 'pitching_substitution' && c.pitcher ? (
              <span className="prepitch__pitching">
                <span className="prepitch__now">
                  Now pitching{pitchingName ? ` for the ${pitchingName}` : ''}:
                </span>{' '}
                <span className="prepitch__pitcher">
                  {c.pitcher.name}
                  {c.pitcher.jersey ? ` ${c.pitcher.jersey}` : ''}
                  {c.pitcher.hand ? ` | ${c.pitcher.hand}HP` : ''}
                </span>
              </span>
            ) : (
              c.text
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// The fielding team's defensive alignment ENTERING this half, drawn as the
// scorebook diamond and captioned with the fielding side. Shows the state at
// first pitch (defenseEntering) — a change made during the half stays sealed —
// so it's safe outside the seal under the caller's reveal gate.
function DefenseSection({ feed, inning, half, fieldingSide, fieldingName }) {
  const defense = defenseEntering(feed, fieldingSide, inning, half)
  if (defense.length === 0) return null
  return (
    <section className="halfdefense">
      <h4 className="halfdefense__title">
        {fieldingName ? `${fieldingName} ` : ''}defense
      </h4>
      <DefenseDiamond defense={defense} />
    </section>
  )
}

// The pre-scoring reference for a half: both teams' lineup cards + the fielding
// side's alignment as they stand ENTERING it (subs through first pitch only).
// Factored out because two layouts render it — inline in the half-inning on a
// phone (staged around the seal), and as a right-column card on the wide layout.
// Spoiler-free under the caller's reveal gate (ADR-0010).
function EnteringReference({ feed, inning, half, battingSide, awayName, homeName, prospectsData }) {
  return (
    <>
      <LineupSection
        feed={feed}
        inning={inning}
        half={half}
        awayName={awayName}
        homeName={homeName}
        prospectsData={prospectsData}
      />
      <DefenseSection
        feed={feed}
        inning={inning}
        half={half}
        fieldingSide={battingSide === 'away' ? 'home' : 'away'}
        fieldingName={battingSide === 'away' ? homeName : awayName}
      />
    </>
  )
}

// Both teams' lineup cards as they stand ENTERING this half — the nine
// batting-order slots per side, each name with its jersey number and fielding
// position, subs (pinch-hitter/runner/double-switch) folded in through first
// pitch only (lineupEntering). Rendered outside the seal under the caller's
// reveal gate: it's the reference you copy onto the sheet before scoring.
function LineupSection({ feed, inning, half, awayName, homeName, prospectsData }) {
  const away = lineupEntering(feed, 'away', inning, half)
  const home = lineupEntering(feed, 'home', inning, half)
  if (away.length === 0 && home.length === 0) return null
  return (
    <section className="lineupcard">
      <div className="lineupcard__teams">
        <LineupTeam name={awayName || 'Away'} slots={away} prospectsData={prospectsData} />
        <LineupTeam name={homeName || 'Home'} slots={home} prospectsData={prospectsData} />
      </div>
    </section>
  )
}

// One team's lineup column: the club name spelled out, then a numbered list of
// its nine batting slots. Each row reads name(s) on the left and the standing
// occupant's jersey number │ fielding position right-aligned on a shared column.
// An empty side (a thin MiLB feed that never posted a lineup) is dropped rather
// than shown as a bare header.
function LineupTeam({ name, slots, prospectsData }) {
  if (slots.length === 0) return null
  return (
    <div className="lineupteam">
      <h5 className="lineupteam__name">{name} Lineup</h5>
      <ol className="lineupcard__list">
        {slots.map((s) => {
          const cur = s.entries[s.entries.length - 1] // standing occupant
          return (
            <li className="lineupcard__row" key={s.slot}>
              <span className="lineupcard__slot">{s.slot}</span>
              <span className="lineupcard__names">
                {s.entries.map((e, i) => (
                  <LineupName key={i} entry={e} />
                ))}
                <ProspectPill {...prospectBadge(prospectsData, cur.id)} />
              </span>
              <span className="lineupcard__meta">
                {cur.jersey ? (
                  <span className="lineupcard__jersey">#{cur.jersey}</span>
                ) : null}
                {cur.jersey && cur.position ? (
                  <span className="lineupcard__bar" aria-hidden="true">
                    |
                  </span>
                ) : null}
                {cur.position ? (
                  <span className="lineupcard__pos">{cur.position}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// One batting-order slot's name stack — struck through when replaced, tagged
// with the inning he entered while he's the standing occupant. Jersey/position
// are pulled up to the row's right-aligned meta column, so this renders name +
// enter-tag only. Mirrors DefenseDiamond's DefenseName styling.
function LineupName({ entry }) {
  const entered = entry.inning != null && !entry.replaced
  return (
    <span
      className={`lineupcard__name ${entry.replaced ? 'lineupcard__name--out' : ''} ${
        entered ? 'lineupcard__name--in' : ''
      }`}
    >
      <PlayerLink id={entry.id}>
        {entry.last.toUpperCase()}
        {entry.first ? `, ${entry.first}` : ''}
      </PlayerLink>
      {entry.inning != null && (
        <span className="lineupcard__enter">({ordinal(entry.inning)})</span>
      )}
    </span>
  )
}

// Splits selectBullpen's card into rotation starters (won't enter once the
// game's underway — see the module docstring) and the actual bullpen, using
// the same season-stats role inference the team page badges pitchers with
// (rosterPitcherRole: gamesStarted ratio / saves — see person.js). A pitcher
// with no resolved role (the roles fetch hasn't landed yet, or a rookie with
// no starts on record) defaults into the bullpen list rather than being ruled
// out as unavailable.
function splitBullpen(bullpen, roles) {
  const starters = bullpen.filter((p) => roles?.[p.id] === 'SP')
  const relief = bullpen.filter((p) => roles?.[p.id] !== 'SP')
  return { starters, bullpen: relief }
}

// Persistent roster reference, collapsed by default: starters (who won't
// enter once the rotation's set), the bullpen (with handedness as LHP/RHP),
// and the bench (with position) as they stood at first pitch, for lookup
// while scoring. A player who has entered the game is struck through — no
// longer eligible — but ONLY once his entry sits at or below the reveal mark;
// a substitution the user hasn't revealed their way to yet renders like any
// other available player, so the card never hints at a sealed inning.
function RosterPanel({ title, roster, revealedThrough, prospectsData }) {
  const [open, setOpen] = useState(false)
  const empty =
    roster.starters.length === 0 && roster.bullpen.length === 0 && roster.bench.length === 0
  const entered = (p) => p.enteredIdx != null && p.enteredIdx <= revealedThrough
  const rowClass = (p) => `roster__row ${entered(p) ? 'is-entered' : ''}`
  return (
    <section className="roster">
      <button
        className="roster__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="roster__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="roster__body">
          {empty && <p className="hint">Not posted yet.</p>}

          {roster.bullpen.length > 0 && (
            <>
              <h4 className="roster__group">Bullpen</h4>
              <ul className="roster__list">
                {roster.bullpen.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst.toUpperCase()}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{handAbbr(p.hand)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {roster.bench.length > 0 && (
            <>
              <h4 className="roster__group">Bench</h4>
              <ul className="roster__list">
                {roster.bench.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst.toUpperCase()}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{p.position}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {roster.starters.length > 0 && (
            <>
              <h4 className="roster__group">Starters</h4>
              <ul className="roster__list">
                {roster.starters.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst.toUpperCase()}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{handAbbr(p.hand)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}

// 'Left' / 'Right' handedness -> pitcher shorthand.
function handAbbr(hand) {
  const h = (hand || '').toLowerCase()
  if (h.startsWith('l')) return 'LHP'
  if (h.startsWith('r')) return 'RHP'
  return ''
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
