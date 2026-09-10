import { staticJson } from './staticJson.js'

// TARGET COMMAND — how close a pitcher puts the ball to where his catcher asked
// for it, per pitch type, over a season.
//
// WHAT IT MEASURES, and why nothing else on the page says it. The Command Map
// beside this card says WHERE a pitcher works. It cannot say whether he MEANT
// to. This can: OpenCommand reads the catcher's glove out of broadcast video,
// frame by frame, and reports the distance in inches between where the glove
// was set and where the pitch actually crossed. Lower is better. League-wide in
// 2026 the middle pitch misses by 9.9in, running from about 9.2in on a sinker
// to 11.0in on a curveball.
//
// SPOILER FOOTING — spoiler-FREE, and it needs no SealBox. Every figure is a
// season median over games already final: a distance in inches, carrying no
// line, no running score and no per-game granularity at all. Same footing as
// the Statcast percentiles this renders beside and as commandMap.js. The player
// page is an open surface (ADR-0034).
//
// THE DATA IS AN OUTSIDE DATASET, which is unusual here and carries two
// obligations. It is read from a nightly static precompute
// (scripts/gen-command.mjs writes public/data/target-command.json), never live
// during a game — the app never touches Hugging Face at request time. And it is
// CC BY-NC-SA 4.0, so the card renders ATTRIBUTION below it, always. That
// licence also forbids commercial use: that is satisfied today and is a
// standing constraint on this app, not a build-time check.
export const fetchTargetCommand = staticJson('/data/target-command.json', {
  fallback: { season: null, pit: {}, median: {}, ranked: {} },
})

// One pitcher's row map, or null when he isn't in the file — a hitter, a MiLB
// arm, a season outside OpenCommand's 2024-on coverage, or an arm under the
// pitch floor for every type he throws. Null renders nothing, which is the
// degrade this app makes everywhere rather than an empty state.
export function targetCommandFor(data, personId, season) {
  // The file holds ONE season. A player whose page is on a different one gets
  // nothing rather than last year's command silently labelled as this year's.
  if (season != null && data?.season != null && Number(season) !== Number(data.season)) return null
  return data?.pit?.[personId] ?? null
}

// The credit line the card prints. Required by the licence, so it is data here
// rather than a string a component may forget.
export function attributionFor(data) {
  const season = data?.season
  return {
    text: `OpenCommand${season ? ` ${season}` : ''} · CC BY-NC-SA 4.0`,
    href: data?.sourceUrl ?? 'https://huggingface.co/datasets/tomdoyo/open-command',
  }
}

// Pitch-type labels for the strip's left column.
//
// A SECOND COPY OF A CODE TABLE, which this repo is right to be wary of
// (scripts/lib/command-grid.mjs's header makes the argument). It is deliberate
// here: the arsenal card reads pitch NAMES off the live feed, which spells them
// at full length and inconsistently ("Four-Seam Fastball" vs "Four-seam FB"),
// and this file has no feed — only the codes its own nightly precompute wrote.
// A strip row needs a short, stable label in a fixed column, so the short names
// are named once, here, beside the only reader that uses them. A code absent
// from this table falls back to the code itself, which is honest and legible.
const PITCH_LABEL = {
  ALL: 'All pitches',
  FF: 'Fastball',
  SI: 'Sinker',
  FC: 'Cutter',
  FA: 'Fastball',
  SL: 'Slider',
  ST: 'Sweeper',
  SV: 'Slurve',
  CU: 'Curveball',
  KC: 'Knuckle curve',
  CS: 'Slow curve',
  CH: 'Changeup',
  FS: 'Splitter',
  FO: 'Forkball',
  EP: 'Eephus',
  KN: 'Knuckleball',
  SC: 'Screwball',
}

export function pitchLabel(code) {
  return PITCH_LABEL[code] ?? code
}

// Inches, one decimal. Bare, with no unit mark: the section note above the
// strip says what the column is, the same way the Statcast strip prints "21.7"
// under a heading rather than repeating a unit on every row.
const inches = (n) => n.toFixed(1)

// The rows the percentile strip draws.
//
// ORDER. "All pitches" leads, because it is the reading a page-scanner wants,
// then each pitch type by how often he threw it — his real arsenal order, so
// the row a reader cares about most is never buried under a show-me pitch.
//
// A row with no percentile still renders: a knuckleball has no league
// population to rank against (see gen-command.mjs's MIN_RANKED_POPULATION), and
// the figure is worth printing without a rank... except that PercentileStrip
// draws a row's whole track from its percentile and skips a row without one. So
// an unranked type is dropped here rather than handed over to be silently
// swallowed downstream.
//
// Returns null below two rows. Unlike the Statcast strip's three-row floor,
// which is guarding against a five-metric profile shown as two, a pitcher with
// "All pitches" and one pitch type genuinely has a two-line arsenal — but a
// SINGLE row is just the ALL figure printed twice over, since a one-pitch
// pitcher's ALL and his one type are the same number.
export function targetCommandRows(entry, data) {
  if (!entry) return null
  const median = data?.median ?? {}
  const rows = Object.entries(entry)
    .filter(([, v]) => Array.isArray(v) && Number.isFinite(v[1]) && Number.isFinite(v[2]))
    .sort((a, b) => {
      if (a[0] === 'ALL') return -1
      if (b[0] === 'ALL') return 1
      return b[1][0] - a[1][0]
    })
    .map(([code, [n, value, percentile]]) => {
      const baseline = Number.isFinite(median[code]) ? inches(median[code]) : null
      const label = pitchLabel(code)
      const what = code === 'ALL'
        ? 'every pitch he threw'
        : `his ${label.toLowerCase()}`
      return {
        key: code,
        label,
        value: inches(value),
        baseline,
        percentile,
        // Always: a smaller miss is better command, so the rank is flipped in
        // the precompute and the down-arrow beside the label is what says so
        // (see gen-command.mjs's percentileLowerIsBetter).
        lowerIsBetter: true,
        // The gloss carries what the strip's heading has no room for: the
        // sample the figure rests on, and — the part a reader cannot guess —
        // that the rank is taken among the men who throw THAT PITCH, not among
        // every pitcher in the league. A curveball misses by nearly two inches
        // more than a sinker does, so the two ranks answer different questions.
        def:
          `How far ${what} finished from the catcher's glove, on average — ${n.toLocaleString()} pitches, ` +
          `measured in inches, so a smaller number is better.` +
          (code === 'ALL'
            ? ' The rank is against every pitcher in the league.'
            : ` The rank is against the other pitchers who throw a ${label.toLowerCase()}.`) +
          (baseline != null
            ? ' The lighter number beside his own is that group’s middle. Half of them are nearer the glove. Half are further.'
            : ''),
      }
    })
  return rows.length >= 2 ? rows : null
}
