// Shared voice mechanics for the matchup callout families (./notes.js's SKILL
// and STYLE axes, ./arsenal.js's per-pitch-type family) — the reusable parts
// of the shape that came out of two blind copy reviews (docs/callouts.md,
// "Matchup callouts"). Rate formatting, the sentence-shape rotation, the
// length-aware short-form assembler and its documented drop order, and the
// "just" intensifier rule all live here so a new family built on the same
// savant-matchup.json data reuses them rather than reimplementing them.
//
// Every axis-specific WORDING (what a clause says, which metric it reads,
// what counts as a collision) stays in the family's own module — this file
// only holds mechanics with no opinion about the axis.

// The measured ceiling of the existing pre-half strip — the longest shipped
// callout is 150 characters (the times-through note). Short forms live under it.
export const SHORT_MAX = 150

// Percentages ROUND. A tenth of a point on a chase rate is a database talking;
// decimals in this app belong on averages, ERA, mph and pitches per inning.
// Mirrors vsTeamNote.js's own `pct` helper.
export const pct = (n) => `${Math.round(n)}%`

// A rate near a clean fraction reads as words, the way a broadcast says it —
// "half his batted balls", not "50% of his batted balls". Applying one
// precision rule uniformly is what makes copy feel templated; keying it to the
// number's own size is what a person does without thinking. Returns the whole
// quantity phrase INCLUDING the following noun, because "half his balls" and
// "50% of his balls" take different prepositions.
export function quantity(n, noun) {
  if (n >= 48 && n <= 52) return `half ${noun}`
  if (n >= 31 && n <= 35) return `a third of ${noun}`
  if (n >= 23 && n <= 27) return `a quarter of ${noun}`
  return `${pct(n)} of ${noun}`
}

// ---------------------------------------------------------------------------
// Shape rotation. Every note in these families is "two clauses pointing at
// one collision", and one rhetorical figure repeated fifteen times across nine
// innings stops being read. So the SHAPE rotates by note index, not the
// vocabulary.
//
//   0 em dash   — only when the clause after it is CONTEXT (the league
//                 average). Never to introduce a second subject; the second
//                 side gets its own sentence.
//   1 semicolon — the true parallel, both clauses taking the same verb. No
//                 league average, which is also what makes it the short one.
//   2 named turn — the asymmetric case, naming which side is the outlier.
//
// Two hard bans, both enforced here by construction: at most ONE em dash per
// note, and never a dash plus `but` (the dash already made the turn).
export const SHAPES = 3

// A clause may begin with something other than a name — the pull axis reads
// "hitters pull 33% against Newcomb" — so any clause promoted to the start of a
// sentence gets capitalised here rather than at each call site.
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// `bClause`/`pClause` name which clause leads (shapes 0/1) and which follows;
// `bName`/`bareClause` are always the side that narrates shape 2's turn — see
// each caller's own header for which real-world side plays that role.
export function assemble(shape, { bName, bClause, pClause, bareClause, lgText, turn }) {
  if (shape === 0 && lgText) {
    return `${cap(bClause)} this season — ${lgText}. ${cap(pClause)}.`
  }
  if (shape === 2 && turn) {
    return `${cap(pClause)} this season. ${bName} ${turn}: he ${bareClause}.`
  }
  // The parallel. It carries the baseline when there is room — two numbers with
  // nothing to measure them against are just numbers — and drops it in the
  // fallback below, which is what makes this the shortest shape.
  const lg = lgText ? `, ${lgText.replace(/^league average is/, 'against a league average of')}` : ''
  return `${cap(bClause)} this season${lg}; ${cap(pClause)}.`
}

// Try the rotated shape first, then fall back through a DOCUMENTED drop order
// rather than truncating: the improved forms run 118-145 characters and a long
// name pair (Yamamoto / Guerrero Jr.) overflows 150. Lose the league average
// first, then the emphasis word, then take the shortest parallel.
export function fitShort(shape, parts) {
  const tries = [
    assemble(shape, parts),
    assemble(shape, { ...parts, lgText: null, turn: null }),
    assemble(1, { ...parts, bClause: parts.bPlain, pClause: parts.pPlain }),
  ]
  for (const t of tries) if (t.length <= SHORT_MAX) return t
  return null
}

// An intensifier ("just") is allowed on exactly ONE side of a note, and only
// when that side is this far out. A word that appears by default is a tic; a
// word conditioned on the number is judgment.
export const EMPHASIS_Z = 1.5

// "just" is a DIMINUTIVE. It belongs only on a number that is small for its
// own league mean — "hits just 52% of his batted balls hard" is nonsense when
// the league hits 37%. So emphasis needs both a magnitude AND a direction, and
// it lands on at most one side of a note: whichever is further out, and only if
// that side is the low one.
export function emphasisFor(zb, zp) {
  const bLow = zb <= -EMPHASIS_Z
  const pLow = zp <= -EMPHASIS_Z
  if (bLow && (!pLow || Math.abs(zb) >= Math.abs(zp))) return ['just ', '']
  if (pLow) return ['', 'just ']
  return ['', '']
}
