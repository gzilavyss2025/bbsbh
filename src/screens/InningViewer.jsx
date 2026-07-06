import { useMemo, useRef, useState } from 'react'
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

  const rosters = useMemo(
    () => ({
      away: {
        name: selectTeamMeta(feed, 'away').name || 'Away',
        bullpen: selectBullpen(feed, 'away'),
        bench: selectBench(feed, 'away'),
      },
      home: {
        name: selectTeamMeta(feed, 'home').name || 'Home',
        bullpen: selectBullpen(feed, 'home'),
        bench: selectBench(feed, 'home'),
      },
    }),
    [feed],
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

      {/* key={inning} → fresh mount → all SealBoxes reset to sealed. */}
      <div className="inning" key={inning}>
        <HalfInning
          feed={feed}
          inning={inning}
          half="top"
          battingSide="away"
          label="Top"
          globalRevealed={globalRevealed}
          getDerived={getDerived}
        />
        <HalfInning
          feed={feed}
          inning={inning}
          half="bottom"
          battingSide="home"
          label="Bottom"
          globalRevealed={globalRevealed}
          getDerived={getDerived}
        />
      </div>

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
  globalRevealed,
  getDerived,
}) {
  return (
    <section className="half">
      <h3 className="half__title">
        {label} {ordinal(inning)}
        <span className="half__team">
          {battingSide === 'away' ? 'Away bats · Home pitches' : 'Home bats · Away pitches'}
        </span>
      </h3>

      <SealBox forceRevealed={globalRevealed}>
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
