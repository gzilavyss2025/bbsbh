// Pitch arsenal, advanced pitching/hitting cards, and batted-ball profile —
// Statcast-derived rate stats behind the season tiles. See ../person.js's
// header for the module's overall spoiler footing.

import { DASH, num, rate2, rate3, propPct, fixed2, roundInt } from './shared.js'

// ---------------------------------------------------------------------------
// Pitch arsenal — the unique pitch types a pitcher throws and their average
// velocity, from stats=pitchArsenal, ordered by usage. Statcast-derived, so
// absent at parks without pitch tracking (most AA/High-A, some Single-A) —
// degrades to null and the UI hides the section, per "degrade, don't assume".
// ---------------------------------------------------------------------------

export function arsenalView(splits) {
  const rows = (splits ?? [])
    .map((s) => s.stat)
    .filter((st) => st?.type?.code)
    .map((st) => {
      const velo = Number(st.averageSpeed)
      const usage = Number(st.percentage)
      // `count` rides along so the card can foot its own total ("2,083
      // pitches") without a second request — the feed already sends a
      // per-type count and a totalPitches on every split, and the total is
      // what tells a reader whether a 63.9% share rests on a season or on
      // one relief outing. Null-safe like the rest: a split with no count
      // simply drops the card's total line rather than showing a wrong one.
      const count = Number(st.count)
      return {
        code: st.type.code,
        name: st.type.description || st.type.code,
        velo: Number.isFinite(velo) && velo > 0 ? velo : null,
        usage: Number.isFinite(usage) ? usage : null,
        count: Number.isFinite(count) ? count : null,
      }
    })
    .sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
  return rows.length ? rows : null
}

// ---------------------------------------------------------------------------
// Advanced pitching card — the run-prevention rates behind the headline tiles,
// from person-fetch's fetchPitchingAdvanced bundle (standard season +
// seasonAdvanced + sabermetrics, one request). Full-season aggregates, same
// spoiler footing as the vs-L/R season splits: no single game's line is
// derivable from a season rate, and the card is labeled "full season" (the
// page's asOf caveat covers it alongside the splits). MLB-only at the source
// (the sabermetrics/seasonAdvanced types return nothing for MiLB) — degrades
// to null and the card doesn't render.
// ---------------------------------------------------------------------------

export function advancedPitchingView(bundle) {
  const seasonStat = bundle?.season
  const adv = bundle?.advanced
  const saber = bundle?.saber
  if (!adv && !saber) return null
  const facts = []
  // Each fact carries its own one-line explainer, shown when the card's
  // per-fact "i" glyph is tapped open (AdvancedStatsCard.jsx) — colocated
  // with the value it explains rather than string-matched by label in the
  // component, so a relabel here can't silently orphan its note.
  const push = (label, value, note) => {
    if (value != null) facts.push({ label, value, note })
  }
  push(
    'FIP',
    fixed2(saber?.fip),
    'Counts what a pitcher alone controls — strikeouts, walks, and home runs allowed.',
  )
  push(
    'ERA−',
    roundInt(saber?.eraMinus),
    'His ERA measured against the league: 100 is average, lower is better.',
  )
  push('K%', propPct(adv?.strikeoutsPerPlateAppearance), 'Share of plate appearances that ended in a strikeout.')
  push('BB%', propPct(adv?.walksPerPlateAppearance), 'Share of plate appearances that ended in a walk.')
  push(
    'K−BB%',
    propPct(adv?.strikeoutsMinusWalksPercentage),
    'Strikeout rate minus walk rate — one number for command and stuff combined.',
  )
  // Ground-ball share of balls in play — seasonAdvanced carries the
  // out/hit batted-ball counts rather than a ready-made percentage.
  const bip = num(adv?.ballsInPlay)
  if (bip > 0) {
    push(
      'Ground ball %',
      `${Math.round(((num(adv?.groundOuts) + num(adv?.groundHits)) / bip) * 100)}%`,
      'Share of balls put in play that were hit on the ground.',
    )
  }
  const oppAvg = seasonStat?.avg
  const oppOps = adv?.ops
  if (oppAvg || oppOps) {
    push(
      'Opp. AVG / OPS',
      `${oppAvg ?? DASH} / ${oppOps ?? DASH}`,
      'What opposing hitters have batted / slugged against him this season.',
    )
  }
  // Role-aware last cell: a starter's quality-start count, a reliever's
  // inherited-runners record. A swing man with starts gets the QS cell.
  const gs = num(seasonStat?.gamesStarted)
  if (gs > 0 && adv?.qualityStarts != null) {
    push(
      'Quality starts',
      `${num(adv.qualityStarts)} of ${gs}`,
      'Starts of at least 6 innings with 3 or fewer earned runs allowed.',
    )
  } else if (num(adv?.inheritedRunners) > 0) {
    push(
      'Inherited scored',
      `${num(adv?.inheritedRunnersScored)} of ${num(adv?.inheritedRunners)}`,
      'Runners on base when he entered a game who came around to score.',
    )
  }
  // A sparse bundle (a cup-of-coffee arm the sabermetrics feed hasn't rated)
  // would render a lonely two-cell card — skip below four facts.
  return facts.length >= 4 ? { facts } : null
}

// ---------------------------------------------------------------------------
// Advanced hitting card — the plate-discipline/power rates behind the hitter
// tiles, from person-fetch's fetchHittingAdvanced bundle (standard season +
// seasonAdvanced + sabermetrics, one request). Same shape and spoiler footing
// as advancedPitchingView (AdvancedStatsCard.jsx renders both, generically,
// off `facts`): full-season aggregates, labeled "full season" by the UI.
// MLB-only at the source — degrades to null and the card doesn't render.
// ---------------------------------------------------------------------------

export function advancedHittingView(bundle) {
  const seasonAdvanced = bundle?.seasonAdvanced
  const sabermetrics = bundle?.sabermetrics
  if (!seasonAdvanced && !sabermetrics) return null
  const facts = []
  // Same per-fact note idiom as advancedPitchingView — colocated here rather
  // than string-matched by label in the component.
  const push = (label, value, note) => {
    if (value != null) facts.push({ label, value, note })
  }
  push(
    'wOBA',
    sabermetrics?.woba != null ? rate3(Number(sabermetrics.woba)) : null,
    "One number for the whole plate appearance — every walk, hit and out weighted by what it's actually worth in runs.",
  )
  push(
    'wRC+',
    roundInt(sabermetrics?.wRcPlus),
    'His run creation measured against the league, park-adjusted: 100 is average, higher is better — the wRC+ to a hitter is what ERA− is to a pitcher.',
  )
  push(
    'K%',
    propPct(seasonAdvanced?.strikeoutsPerPlateAppearance),
    'Share of plate appearances that ended in a strikeout.',
  )
  push(
    'BB%',
    propPct(seasonAdvanced?.walksPerPlateAppearance),
    'Share of plate appearances that ended in a walk.',
  )
  push(
    'BB/K',
    rate2(seasonAdvanced?.walksPerStrikeout),
    'Walks drawn for every strikeout — a quick read on his command of the strike zone as a hitter.',
  )
  push(
    'ISO',
    seasonAdvanced?.iso ?? null,
    'Extra bases per at-bat — power with the singles stripped out.',
  )
  push('BABIP', seasonAdvanced?.babip ?? null, 'His batting average on balls put in play.')
  push(
    'P/PA',
    fixed2(seasonAdvanced?.pitchesPerPlateAppearance),
    'Pitches seen per trip to the plate — how hard he makes the pitcher work.',
  )
  // Same sparse-bundle floor as advancedPitchingView.
  return facts.length >= 4 ? { facts } : null
}

// ---------------------------------------------------------------------------
// Batted-ball profile — the ground/line/fly/pop mix from seasonAdvanced's
// per-bucket outs+hits counts (fetchHittingAdvanced), each bucket's share of
// balls in play and the AVG on that bucket. The four buckets sum exactly to
// ballsInPlay (verified live: 145+83+83+30 = 341), so `share` always adds to 1.
// ---------------------------------------------------------------------------

// A sample floor so a September call-up's dozen balls in play doesn't render
// a confident-looking batted-ball profile — same idea as the pitch arsenal's
// MIN_ARSENAL_PITCHES qualifier floor (pitchArsenal.js).
const MIN_BATTED_BALL_SAMPLE = 50

const BATTED_BALL_BUCKETS = [
  ['ground', 'Ground balls', 'groundOuts', 'groundHits'],
  ['line', 'Line drives', 'lineOuts', 'lineHits'],
  ['fly', 'Fly balls', 'flyOuts', 'flyHits'],
  ['pop', 'Pop-ups', 'popOuts', 'popHits'],
]

export function battedBallView(seasonAdvanced) {
  const bip = num(seasonAdvanced?.ballsInPlay)
  if (!seasonAdvanced || bip < MIN_BATTED_BALL_SAMPLE) return null
  const rows = BATTED_BALL_BUCKETS.map(([key, name, outsKey, hitsKey]) => {
    const total = num(seasonAdvanced[outsKey]) + num(seasonAdvanced[hitsKey])
    return {
      key,
      name,
      share: total / bip,
      avg: total > 0 ? num(seasonAdvanced[hitsKey]) / total : null,
    }
  })
  return { rows, ballsInPlay: bip }
}
