import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  selectInningCount,
  selectRegulationInnings,
  selectBullpen,
  selectBench,
  selectTeamMeta,
} from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import {
  computeDerivedByInning,
  revealDerived,
  rollingPitches,
} from '../api/derive.js'
import { computePitcherLines, halfIndex } from '../api/pitchers.js'
import { SealBox } from '../components/SealBox.jsx'
import { PlayByPlay } from '../components/PlayByPlay.jsx'

// Inning-by-inning viewer. Each half-inning is a single SealBox: one tap reveals
// that half's whole stat line at once (§7b). Navigating between innings remounts
// the panel (key={inning}) so every box re-seals. Which inning shows is driven by
// the URL (`inning` / `onInning`); the reveal high-water mark lives here so it
// survives inning navigation.
//
// Extra innings never spoil: only `regulation` innings (9, or 7 for short games)
// are shown up front. Each inning past regulation unlocks one at a time, and only
// once the prior inning has been revealed — so the navigator and boxscore never
// hint that a game went to extras before the user gets there.
export function InningViewer({ feed, started, inning, onInning, onBoxScore, onReload, loading }) {
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // Derived stats (pitches/whiffs/1st-pitch strikes) are parsed lazily and
  // cached: the map is only built the first time a box is actually revealed.
  const derivedRef = useRef(null)
  const getDerived = () => {
    if (!derivedRef.current) derivedRef.current = computeDerivedByInning(feed)
    return derivedRef.current
  }

  const meta = useMemo(
    () => ({ away: selectTeamMeta(feed, 'away'), home: selectTeamMeta(feed, 'home') }),
    [feed],
  )

  const rosters = useMemo(
    () => ({
      away: {
        name: meta.away.name || 'Away',
        bullpen: selectBullpen(feed, 'away'),
        bench: selectBench(feed, 'away'),
      },
      home: {
        name: meta.home.name || 'Home',
        bullpen: selectBullpen(feed, 'home'),
        bench: selectBench(feed, 'home'),
      },
    }),
    [feed, meta],
  )

  // Reveal high-water mark: the furthest half-inning (by halfIndex) the user has
  // uncovered. Revealing a later inning auto-reveals everything before it — the
  // running line and Pitchers section both read from this single mark, and any
  // half at or below it renders unsealed.
  const [revealedThrough, setRevealedThrough] = useState(-1)
  const revealTo = useCallback((n, half) => {
    const idx = halfIndex(n, half)
    setRevealedThrough((prev) => (idx > prev ? idx : prev))
  }, [])

  // How many innings are currently visible: regulation, plus one more for each
  // extra inning whose predecessor has already been fully revealed.
  const unlocked = useMemo(() => {
    let u = regulation
    while (u < actualCount && revealedThrough >= halfIndex(u, 'bottom')) u++
    return u
  }, [regulation, actualCount, revealedThrough])

  const effInning = Math.min(Math.max(1, inning || 1), unlocked)

  // Every pitcher who has appeared in a revealed half-inning, with running lines
  // (see api/pitchers.js). Recomputed as the reveal mark advances.
  const pitcherLines = useMemo(
    () => computePitcherLines(feed, revealedThrough),
    [feed, revealedThrough],
  )

  if (!started) {
    return (
      <div className="innings">
        <p className="hint">
          This game hasn’t started yet. Lineups and info are on the previous
          pages; inning totals appear once first pitch is thrown.
        </p>
        <button className="btn" onClick={onReload}>
          Refresh
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

      <RollingLine
        feed={feed}
        regulation={regulation}
        unlocked={unlocked}
        revealedThrough={revealedThrough}
        awayAbbr={meta.away.abbreviation}
        homeAbbr={meta.home.abbreviation}
      />

      <nav className="inningnav" aria-label="Inning navigator">
        <button
          onClick={() => onInning(Math.max(1, effInning - 1))}
          disabled={effInning === 1}
          aria-label="Previous inning"
        >
          ‹ Back
        </button>
        <span className="inningnav__label">
          Inning {effInning} <span className="inningnav__of">of {unlocked}</span>
        </span>
        <button
          onClick={() => onInning(Math.min(unlocked, effInning + 1))}
          disabled={effInning === unlocked}
          aria-label="Next inning"
        >
          Next ›
        </button>
      </nav>

      <div className="inningnav__strip">
        {Array.from({ length: unlocked }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`inningnav__chip ${n === effInning ? 'is-active' : ''}`}
            onClick={() => onInning(n)}
          >
            {n}
          </button>
        ))}
      </div>

      {/* key={inning} → fresh mount; boxes at/under the reveal mark stay open. */}
      <div className="inning" key={effInning}>
        <HalfInning
          feed={feed}
          inning={effInning}
          half="top"
          battingSide="away"
          label="Top"
          battingAbbr={meta.away.abbreviation}
          pitchingAbbr={meta.home.abbreviation}
          revealed={halfIndex(effInning, 'top') <= revealedThrough}
          getDerived={getDerived}
          onReveal={revealTo}
        />
        <HalfInning
          feed={feed}
          inning={effInning}
          half="bottom"
          battingSide="home"
          label="Bottom"
          battingAbbr={meta.home.abbreviation}
          pitchingAbbr={meta.away.abbreviation}
          revealed={halfIndex(effInning, 'bottom') <= revealedThrough}
          getDerived={getDerived}
          onReveal={revealTo}
        />
      </div>

      <PitchersSection
        teams={[
          { name: rosters.away.name, rows: pitcherLines.away },
          { name: rosters.home.name, rows: pitcherLines.home },
        ]}
      />

      <RosterPanel title={rosters.away.name} roster={rosters.away} />
      <RosterPanel title={rosters.home.name} roster={rosters.home} />

      {onBoxScore && (
        <button type="button" className="btn boxscorelink" onClick={onBoxScore}>
          Full box score ›
        </button>
      )}
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
  getDerived,
  onReveal,
}) {
  return (
    <section className="half">
      <h3 className="half__title">
        {label} {ordinal(inning)}
        <span className="half__team">
          {battingAbbr || (battingSide === 'away' ? 'Away' : 'Home')} bats{' '}
          {pitchingAbbr || (battingSide === 'away' ? 'Home' : 'Away')} pitches
        </span>
      </h3>

      <SealBox
        forceRevealed={revealed}
        onReveal={() => onReveal(inning, half)}
      >
        {() => {
          // Computed only on reveal.
          const line = revealInning(feed, inning, battingSide)
          const d = revealDerived(getDerived(), inning, half)
          const rolling = rollingPitches(getDerived(), inning, half)
          return (
            <>
              <div className="rhe">
                <Stat k="R" v={line?.runs ?? 0} tone="run" big />
                <Stat k="H" v={line?.hits ?? 0} big />
                <Stat k="E" v={line?.errors ?? 0} big />
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
  const totals = (half, side) => {
    let r = 0, h = 0, e = 0, any = false
    for (let n = 1; n <= unlocked; n++) {
      const l = lineFor(n, half, side)
      if (l) { any = true; r += l.runs; h += l.hits; e += l.errors }
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
                    return (
                      <td key={n} className={l ? '' : 'rolling__pending'}>
                        {l ? l.runs : '·'}
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
      <p className="rolling__cap">Fills in as you reveal each half.</p>
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
                      <PitcherName last={p.last} first={p.first} />
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
function PitcherName({ last, first }) {
  const ref = useRef(null)
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

  return (
    <span className="pitchers__pname" ref={ref}>
      {text}
    </span>
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

// Persistent roster reference, expanded by default. Spoiler-safe: it lists only
// the players who have NOT yet entered the game — the bullpen (with handedness as
// LHP/RHP) and the bench (with position) — for lookup while scoring.
function RosterPanel({ title, roster }) {
  const [open, setOpen] = useState(true)
  const empty = roster.bullpen.length === 0 && roster.bench.length === 0
  return (
    <section className="roster">
      <button className="roster__toggle" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className="roster__chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="roster__body">
          {empty && <p className="hint">Not posted yet.</p>}

          {roster.bullpen.length > 0 && (
            <>
              <h4 className="roster__group">Bullpen</h4>
              <ul className="roster__list">
                {roster.bullpen.map((p) => (
                  <li key={p.id} className="roster__row">
                    <span className="roster__name">
                      {p.nameLastFirst.toUpperCase()}
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
                  <li key={p.id} className="roster__row">
                    <span className="roster__name">
                      {p.nameLastFirst.toUpperCase()}
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{p.position}</span>
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
