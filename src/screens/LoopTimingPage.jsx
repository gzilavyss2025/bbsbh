// `/loop-timing` — the readout for the scoring-loop stopwatch. An unlisted QA
// page, the same shape as /animation-lab: nothing links to it, and it exists to
// answer one open question in the Express Lane PRD rather than to be a feature.
//
// It shows how long a plate appearance actually takes to score, against the
// ~25s-per-plate-appearance the staging queue can deliver at MLB's measured
// 2.1 Mbps clip ceiling. If the median comes in under the budget, "staging
// outruns the scorer" is false and Result mode needs a trigger after all.
//
// SPOILER NOTE: this renders only counts and durations. It never reads a result,
// a score, or an event type — the marks it summarizes cannot carry one (see
// src/lib/loopTiming.js and the invariant pinned in test/loop-timing.test.js).
// It reports on games already scored, so the number of plate appearances shown
// is something the reader has already sat through and written down.
//
// Styled inline rather than with a partial: src/styles is at its directory
// budget and this page is temporary, so it borrows the shared tokens directly
// instead of spending a permanent stylesheet slot on a throwaway.
//
// TEMPORARY. Delete with src/lib/loopTiming.js, its test, this route, and the
// one call site in InningViewer.jsx when the question is answered.
import { useMemo, useState } from 'react'
import { STAGING_BUDGET_S, summarize, timedGames } from '../lib/loopTiming.js'

const label = {
  font: '600 12px/1.2 var(--font-display)',
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: 'var(--ink-2)',
}

function Stat({ name, value, unit, hint }) {
  return (
    <div style={{ flex: '1 1 90px', minWidth: 90 }}>
      <div style={label}>{name}</div>
      <div style={{ font: '700 26px/1 var(--font-mono)', color: 'var(--ink-0)', marginTop: 5 }}>
        {value == null ? '—' : value}
        {value == null ? '' : <span style={{ fontSize: 14, marginLeft: 1 }}>{unit}</span>}
      </div>
      {hint ? (
        <div style={{ font: '400 11px/1.35 var(--font-body)', color: 'var(--ink-2)', marginTop: 3 }}>{hint}</div>
      ) : null}
    </div>
  )
}

function GameCard({ gamePk, marks }) {
  const [raw, setRaw] = useState(false)
  const s = useMemo(() => summarize(marks), [marks])
  const behind = s.outrunsScorer === false
  const verdict =
    s.outrunsScorer == null
      ? 'Not enough yet — score at least ten plate appearances.'
      : behind
        ? `Staging falls behind. The middle plate appearance takes ${s.medianS}s, faster than the ${s.budgetS}s a clip needs to arrive.`
        : `Staging keeps up. The middle plate appearance takes ${s.medianS}s, longer than the ${s.budgetS}s a clip needs to arrive.`

  return (
    <section
      style={{
        background: 'var(--paper-2)',
        border: '1px solid var(--rule)',
        borderRadius: 10,
        padding: '16px 18px',
        marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ font: '700 21px/1.2 var(--font-display)', color: 'var(--ink-0)', margin: 0 }}>
          Game {gamePk}
        </h2>
        <span style={label}>
          {s.marks} plate {s.marks === 1 ? 'appearance' : 'appearances'} timed
        </span>
      </div>

      <p
        style={{
          font: '400 15px/1.45 var(--font-read)',
          color: behind ? 'var(--clay-deep)' : 'var(--ink-0)',
          margin: '10px 0 14px',
        }}
      >
        {verdict}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <Stat name="Median" value={s.medianS} unit="s" hint="the middle one" />
        <Stat name="Fast fifth" value={s.p20S} unit="s" hint="quick stretches" />
        <Stat name="Slow fifth" value={s.p80S} unit="s" hint="the ones you thought about" />
        <Stat name="Fastest" value={s.fastestS} unit="s" />
        <Stat name="Slowest" value={s.slowestS} unit="s" />
        <Stat name="Under budget" value={s.shareFasterThanBudget} unit="%" hint={`quicker than ${s.budgetS}s`} />
      </div>

      <p style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '14px 0 0' }}>
        {s.intervals} gaps measured · {s.awayGaps} long {s.awayGaps === 1 ? 'break' : 'breaks'} set aside (over
        two minutes — you put the phone down, you did not score slowly)
      </p>

      <button
        type="button"
        onClick={() => setRaw((v) => !v)}
        style={{
          marginTop: 12,
          minHeight: 38,
          padding: '0 12px',
          borderRadius: 6,
          border: '1.5px solid var(--rule)',
          background: 'var(--paper-3)',
          color: 'var(--ink-1)',
          font: '700 12px/1 var(--font-display)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        {raw ? 'Hide the raw marks' : 'Show the raw marks'}
      </button>
      {raw ? (
        <textarea
          readOnly
          onFocus={(e) => e.target.select()}
          value={JSON.stringify({ gamePk, marks })}
          style={{
            display: 'block',
            width: '100%',
            height: 120,
            marginTop: 10,
            padding: 8,
            border: '1px solid var(--rule)',
            borderRadius: 6,
            background: 'var(--paper-3)',
            color: 'var(--ink-1)',
            font: '400 11px/1.4 var(--font-mono)',
          }}
        />
      ) : null}
    </section>
  )
}

export function LoopTimingPage() {
  const games = useMemo(() => timedGames(), [])

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px var(--app-gutter, 16px) 64px' }}>
      <h1 style={{ font: '700 30px/1.1 var(--font-display)', color: 'var(--ink-0)', margin: 0 }}>
        Scoring-loop stopwatch
      </h1>
      <p style={{ font: '400 15px/1.5 var(--font-body)', color: 'var(--ink-1)', marginTop: 10 }}>
        How long one plate appearance actually takes to score, against the {STAGING_BUDGET_S} seconds a pitch
        clip needs to arrive. Nothing here is sent anywhere — it is measured on this device and read back
        here.
      </p>
      {games.length === 0 ? (
        <p style={{ font: '400 15px/1.5 var(--font-read)', color: 'var(--ink-2)', marginTop: 24 }}>
          Nothing timed yet. Open a finished game, step through it one batter at a time the way you normally
          score, and come back.
        </p>
      ) : (
        games.map((g) => <GameCard key={g.gamePk} gamePk={g.gamePk} marks={g.marks} />)
      )}
    </main>
  )
}
