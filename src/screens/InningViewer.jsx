import { useCallback, useMemo, useRef, useState } from 'react'
import {
  selectInningCount,
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

// Inning-by-inning viewer. Each half-inning is a single SealBox: one tap
// reveals that half's whole stat line at once (§7b). Navigating between
// innings remounts the panel (key={inning}) so every box re-seals.
export function InningViewer({ feed, started, globalRevealed, onReload }) {
  const inningCount = useMemo(() => selectInningCount(feed), [feed])
  const [inning, setInning] = useState(1)

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
  // half at or below it renders unsealed. Lives here (not in the per-inning
  // panel, which remounts on navigation) so reveals persist as you move around.
  const [revealedThrough, setRevealedThrough] = useState(-1)
  const revealTo = useCallback((n, half) => {
    const idx = halfIndex(n, half)
    setRevealedThrough((prev) => (idx > prev ? idx : prev))
  }, [])

  // Every pitcher who has appeared in a revealed half-inning, with running lines
  // (see api/pitchers.js). Recomputed as the reveal mark advances.
  const pitcherLines = useMemo(
    () => computePitcherLines(feed, globalRevealed ? Infinity : revealedThrough),
    [feed, revealedThrough, globalRevealed],
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
      <RollingLine
        feed={feed}
        inningCount={inningCount}
        revealedThrough={revealedThrough}
        globalRevealed={globalRevealed}
        awayAbbr={meta.away.abbreviation}
        homeAbbr={meta.home.abbreviation}
      />

      <nav className="inningnav" aria-label="Inning navigator">
        <button
          onClick={() => setInning((n) => Math.max(1, n - 1))}
          disabled={inning === 1}
          aria-label="Previous inning"
        >
          ‹ Back
        </button>
        <span className="inningnav__label">
          Inning {inning} <span className="inningnav__of">of {inningCount}</span>
        </span>
        <button
          onClick={() => setInning((n) => Math.min(inningCount, n + 1))}
          disabled={inning === inningCount}
          aria-label="Next inning"
        >
          Next ›
        </button>
      </nav>

      <div className="inningnav__strip">
        {Array.from({ length: inningCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`inningnav__chip ${n === inning ? 'is-active' : ''}`}
            onClick={() => setInning(n)}
          >
            {n}
          </button>
        ))}
      </div>

      {/* key={inning} → fresh mount; boxes at/under the reveal mark stay open. */}
      <div className="inning" key={inning}>
        <HalfInning
          feed={feed}
          inning={inning}
          half="top"
          battingSide="away"
          label="Top"
          revealed={globalRevealed || halfIndex(inning, 'top') <= revealedThrough}
          getDerived={getDerived}
          onReveal={revealTo}
        />
        <HalfInning
          feed={feed}
          inning={inning}
          half="bottom"
          battingSide="home"
          label="Bottom"
          revealed={globalRevealed || halfIndex(inning, 'bottom') <= revealedThrough}
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
    </div>
  )
}

function HalfInning({
  feed,
  inning,
  half,
  battingSide,
  label,
  revealed,
  getDerived,
  onReveal,
}) {
  return (
    <section className="half">
      <h3 className="half__title">
        {label} {ordinal(inning)}
        <span className="half__team">
          {battingSide === 'away' ? 'Away bats · Home pitches' : 'Home bats · Away pitches'}
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
            </>
          )
        }}
      </SealBox>
    </section>
  )
}

// The running line at the top of the innings view. It "builds as you reveal":
// each half you uncover drops its runs into this grid; halves you haven't
// revealed stay blank (·). The global "Reveal score" flag fills the whole grid
// at once. It only reads a linescore value along a reveal path: a cell is read
// only when its half-index is at or below `revealedThrough` (or global reveal is
// on), so nothing sealed is ever computed into the grid.
function RollingLine({
  feed,
  inningCount,
  revealedThrough,
  globalRevealed,
  awayAbbr,
  homeAbbr,
}) {
  const nums = Array.from({ length: inningCount }, (_, i) => i + 1)

  const lineFor = (n, half, side) =>
    globalRevealed || halfIndex(n, half) <= revealedThrough
      ? revealInning(feed, n, side)
      : null

  const rows = [
    { abbr: awayAbbr || 'AWY', half: 'top', side: 'away' },
    { abbr: homeAbbr || 'HOM', half: 'bottom', side: 'home' },
  ]

  const totals = (half, side) => {
    let r = 0, h = 0, e = 0, any = false
    for (const n of nums) {
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
              {nums.map((n) => (
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
                  {nums.map((n) => {
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
// horizontal scroll: the name column wraps, the jersey number is inked in clay
// red and right-aligned within its own slot in the Pitcher cell.
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
                      <span className="pitchers__pname">
                        {p.last}
                        {p.first ? `, ${p.first}` : ''}
                      </span>
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

// Persistent, collapsible roster reference. Spoiler-safe: it lists only the
// players who have NOT yet entered the game — the bullpen (with handedness) and
// the bench (with position) — for lookup while scoring. Reveals no outcomes.
function RosterPanel({ title, roster }) {
  const [open, setOpen] = useState(false)
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
                    <span className="roster__jersey">
                      {p.jersey ? `#${p.jersey}` : ''}
                    </span>
                    <span className="roster__pos">{p.hand.toUpperCase()}</span>
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
                    <span className="roster__jersey">
                      {p.jersey ? `#${p.jersey}` : ''}
                    </span>
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

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
