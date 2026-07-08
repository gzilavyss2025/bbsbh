import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
import {
  computeDerivedByInning,
  revealDerived,
  rollingPitches,
} from '../api/derive.js'
import { computePitcherLines } from '../api/pitchers.js'
import { revealDefense } from '../api/defense.js'
import { revealBattingOrder } from '../api/battingorder.js'
import { SealBox } from '../components/SealBox.jsx'
import { PlayByPlay } from '../components/PlayByPlay.jsx'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'

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
}) {
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // Derived stats (pitches/whiffs/1st-pitch strikes) are parsed lazily and
  // cached: the map is only built the first time a box is actually revealed.
  // The cache is keyed on the feed object, so a Refresh (which fetches a fresh
  // feed) rebuilds it. Without this the map froze at whatever feed was present
  // on first reveal and pitch/whiff stats went stale for the live inning — the
  // play-by-play (read live from `feed`) would show a walk while PITCHES read 0.
  const derivedRef = useRef({ feed: null, map: null })
  const getDerived = () => {
    if (derivedRef.current.feed !== feed) {
      derivedRef.current = { feed, map: computeDerivedByInning(feed) }
    }
    return derivedRef.current.map
  }

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

  // Reveal high-water mark: the furthest half-inning (by halfIndex) the user has
  // uncovered. Revealing a later inning auto-reveals everything before it — the
  // running line and Pitchers section both read from this single mark, and any
  // half at or below it renders unsealed.
  //
  // The mark is persisted per game (keyed by gamePk) so leaving the innings view
  // and returning — even in a new session — keeps your place instead of
  // re-sealing everything you'd already uncovered. Only the mark is stored, never
  // a score, so nothing score-revealing is written to disk: on return we simply
  // re-reveal up to the half the user had already reached.
  const storageKey = feed?.gamePk ? `${REVEAL_KEY}${feed.gamePk}` : null
  const [revealedThrough, setRevealedThrough] = useState(() =>
    readRevealMark(storageKey),
  )
  const revealTo = useCallback((n, half) => {
    const idx = halfIndex(n, half)
    setRevealedThrough((prev) => (idx > prev ? idx : prev))
  }, [])

  useEffect(() => {
    if (!storageKey || revealedThrough < 0) return
    try {
      window.localStorage.setItem(storageKey, String(revealedThrough))
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [storageKey, revealedThrough])

  // How many innings are currently visible: regulation, plus one more for each
  // extra inning whose predecessor has already been fully revealed.
  const unlocked = useMemo(() => {
    let u = regulation
    while (u < actualCount && revealedThrough >= halfIndex(u, 'bottom')) u++
    return u
  }, [regulation, actualCount, revealedThrough])

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
          the half-inning reading pane on the left, the pitchers table and
          roster reference riding a sticky column on the right. */}
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

          {/* key on inning+half → fresh mount; a box at/under the reveal mark stays open. */}
          <div className="inning" key={`${effInning}-${effHalf}`}>
            <HalfInning
              feed={feed}
              inning={effInning}
              half={effHalf}
              battingSide={effHalf === 'top' ? 'away' : 'home'}
              label={effHalf === 'top' ? 'Top' : 'Bottom'}
              battingAbbr={effHalf === 'top' ? meta.away.abbreviation : meta.home.abbreviation}
              pitchingAbbr={effHalf === 'top' ? meta.home.abbreviation : meta.away.abbreviation}
              revealed={curIdx <= revealedThrough}
              isNextToReveal={curIdx === revealedThrough + 1}
              getDerived={getDerived}
              onReveal={revealTo}
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

          <RosterPanel
            title={rosters.away.name}
            roster={rosters.away}
            revealedThrough={revealedThrough}
          />
          <RosterPanel
            title={rosters.home.name}
            roster={rosters.home}
            revealedThrough={revealedThrough}
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
        {nextIdx != null ? (
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
  revealed,
  isNextToReveal,
  getDerived,
  onReveal,
}) {
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

      {/* Pre-pitch subs/pitching changes for the half the user is about to
          reveal — spoiler-free (see selectPrePitchChanges), shown ahead of the
          seal so it can go straight into the scorebook margin before tapping
          to reveal the rest of the half. Only for the immediate next half:
          the same information for a half further out is what defense.js's
          "flurry of subs" risk is about. */}
      {!revealed && isNextToReveal && (
        <PrePitchChanges feed={feed} inning={inning} half={half} />
      )}

      <SealBox
        forceRevealed={revealed}
        onReveal={() => onReveal(inning, half)}
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
              {/* The batting side's lineup card, built up from the starting nine
                  plus every pinch-hitter/pinch-runner or double-switch sub
                  revealed so far (api/battingorder.js — reveal-only). Same
                  spoiler-adjacency as the defense below, so it's computed here
                  inside the seal, gated to this half. */}
              <BattingOrderSection
                feed={feed}
                inning={inning}
                half={half}
                battingSide={battingSide}
                battingAbbr={battingAbbr}
              />
              {/* The defense on the field this half, built up from the starting
                  nine plus every substitution revealed so far (api/defense.js —
                  reveal-only). A defensive change is spoiler-adjacent, so it's
                  computed here inside the seal, gated to this half. */}
              <DefenseSection
                feed={feed}
                inning={inning}
                half={half}
                fieldingSide={battingSide === 'away' ? 'home' : 'away'}
                fieldingAbbr={pitchingAbbr}
              />
            </>
          )
        }}
      </SealBox>
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
function PrePitchChanges({ feed, inning, half }) {
  const changes = selectPrePitchChanges(feed, inning, half)
  if (changes.length === 0) return null
  return (
    <div className="prepitch">
      <h4 className="prepitch__title">Before this half</h4>
      <ul className="prepitch__list">
        {changes.map((c, i) => (
          <li className="prepitch__item" key={i}>
            {c.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

// The fielding team's live defensive alignment for this half, drawn as the
// scorebook diamond and captioned with the fielding side. Reveal-only
// (revealDefense) — rendered here, inside the seal, so a defensive change never
// leaks before the user reveals its inning.
function DefenseSection({ feed, inning, half, fieldingSide, fieldingAbbr }) {
  const defense = revealDefense(feed, fieldingSide, inning, half)
  if (defense.length === 0) return null
  return (
    <section className="halfdefense">
      <h4 className="halfdefense__title">
        {fieldingAbbr ? `${fieldingAbbr} ` : ''}defense
      </h4>
      <DefenseDiamond defense={defense} />
    </section>
  )
}

// The batting side's lineup card for this half — the nine batting-order slots,
// each showing its starter and any pinch-hitter/pinch-runner/double-switch sub
// revealed so far. Reveal-only (revealBattingOrder) — rendered here, inside
// the seal, same as DefenseSection above.
function BattingOrderSection({ feed, inning, half, battingSide, battingAbbr }) {
  const slots = revealBattingOrder(feed, battingSide, inning, half)
  if (slots.length === 0) return null
  return (
    <section className="lineupcard">
      <h4 className="lineupcard__title">
        {battingAbbr ? `${battingAbbr} ` : ''}lineup
      </h4>
      <ol className="lineupcard__list">
        {slots.map((s) => (
          <li className="lineupcard__row" key={s.slot}>
            <span className="lineupcard__slot">{s.slot}</span>
            <span className="lineupcard__stack">
              {s.entries.map((e, i) => (
                <LineupName key={i} entry={e} />
              ))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// One batting-order slot's name stack — struck through when replaced, tagged
// with the inning he entered while he's the standing occupant. Mirrors
// DefenseDiamond's DefenseName styling for the same { last, inning, replaced }
// shape.
function LineupName({ entry }) {
  const entered = entry.inning != null && !entry.replaced
  return (
    <span
      className={`lineupcard__name ${entry.replaced ? 'lineupcard__name--out' : ''} ${
        entered ? 'lineupcard__name--in' : ''
      }`}
    >
      {entry.last.toUpperCase()}
      {entry.inning != null && (
        <span className="lineupcard__enter"> ({ordinal(entry.inning)})</span>
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
function RosterPanel({ title, roster, revealedThrough }) {
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
                    <PlayerLink id={p.id} className="roster__name">
                      {p.nameLastFirst.toUpperCase()}
                    </PlayerLink>
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
                    <PlayerLink id={p.id} className="roster__name">
                      {p.nameLastFirst.toUpperCase()}
                    </PlayerLink>
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
                    <PlayerLink id={p.id} className="roster__name">
                      {p.nameLastFirst.toUpperCase()}
                    </PlayerLink>
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

// localStorage key prefix + reader for the per-game reveal high-water mark.
const REVEAL_KEY = 'bbsbh:reveal:'
function readRevealMark(storageKey) {
  if (!storageKey) return -1
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw == null) return -1
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 ? n : -1
  } catch {
    return -1
  }
}
