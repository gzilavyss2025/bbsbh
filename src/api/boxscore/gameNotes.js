// THE INFO BLOCK — the label/value rows MLB hangs off the bottom of a box score
// (Pitches-strikes, HBP, WP, Balk, ABS Challenge…), and the rule that decides
// which club each one prints under. Split out of boxscore.js, which owns the
// tables; this file owns only the prose rows beneath them.
//
// Reveal-only, like its one caller: everything here is read out of a final box
// score, so it may only run from inside selectBoxscore (see boxscore.js's
// header for the rule this obeys).
//
// THE ATTRIBUTION RULE, in one line: a row goes to the club of the player it
// NAMES FIRST — the man the note is about. That is a pitcher on every row but
// two. HBP and IBB name the BATTER, and they follow him: being hit belongs with
// the rest of a hitter's night, so those two print in his club's BATTING notes
// (mergeBattingNotes) rather than under the pitching club's heading.
//
// WHAT GOES WRONG HERE, since the whole file is one parse. An entry the parse
// mangles doesn't crash and doesn't vanish — it fails the roster-name lookup
// and lands in the `shared` foot at the very bottom of the sheet, which reads
// like a category rather than a bug. Three separate shapes did exactly that,
// each verified against real feeds and each pinned by a test in
// test/box-score-note-attribution.test.js:
//
//   "Culpepper, K 2 (by Gasser, by Patrick)"  a batter hit by TWO pitchers
//   "Seymour, C 2"                            a count with no parenthetical
//   "…; Balboni Jr."                          a suffix period eaten as the
//                                             row's own terminator
//
// So: an entry in the foot that NAMES A PLAYER is a parse bug. The foot is for
// rows with no player in them at all — an ejection, written as prose.
// fill-in boxes' Umpires/Weather/Venue/Attendance/First-Pitch/duration
// fields) — dropped from the shared foot rather than repeated verbatim. Wind
// belongs here too: it's folded into the weather box we compute ourselves
// (see src/api/weather.js), so the feed's raw Wind row is redundant.
const DEDUPED_INFO_LABELS = new Set([
  'Umpires',
  'Weather',
  'Wind',
  'First pitch',
  'T',
  'Att',
  'Venue',
])

// Rows shaped "Name stat; Name stat…" — one entry per pitcher.
const STAT_SPLIT_LABELS = new Set([
  'Pitches-strikes',
  'Groundouts-flyouts',
  'Batters faced',
  'Inherited runners-scored',
])

// Rows shaped "Name (detail); Name (detail)…" or bare "Name; Name…" — a name,
// an optional repeat count, and an optional parenthetical (an outcome, a role,
// or a "by Pitcher" attribution).
const NAME_SPLIT_LABELS = new Set([
  'Balk',
  'WP',
  'IBB',
  'HBP',
  'ABS Challenge',
  'Pitch timer violations',
  'Disengagement violations',
])

// The two rows whose leading name is a BATTER, not a pitcher: he was hit, or
// he was walked on purpose. Both close with a "(by Pitcher)" attribution, and
// that tail used to decide the row's club — which put "Culpepper was hit
// twice" under the club that threw the pitches rather than the club whose
// hitter wore them. It reads with a man's other plate appearances, so it goes
// to HIS side, in that club's BATTING notes (see mergeBattingNotes) beside the
// 2B/RBI/GIDP lines rather than under a Pitching heading. Every other split
// label leads with the pitcher, so all of them keep the plain leading-name
// rule and stay in their club's pitching notes.
const BATTER_NOTE_LABELS = new Set(['HBP', 'IBB'])

// Every player in the game, keyed by the exact `boxscoreName` string the feed
// also uses inside the info-block text (MLB disambiguates same-surname
// players game-wide, e.g. "Contreras, Wm", so this lookup can't collide
// across the two teams).
//
// Indexed a SECOND time without a trailing period, because splitEntries has to
// strip the period that ends a row and cannot tell it apart from the one that
// ends a suffix: the last entry of "Serna, L 2; MacGregor; Balboni Jr." leaves
// the parser holding "Balboni Jr", which the roster spells "Balboni Jr." The
// value carries the canonical spelling back out so the rendered text keeps the
// period the split took off.
function nameTeamMap(feed) {
  const map = new Map()
  const gdPlayers = feed?.gameData?.players ?? {}
  for (const side of ['away', 'home']) {
    const boxPlayers = feed?.liveData?.boxscore?.teams?.[side]?.players ?? {}
    for (const key of Object.keys(boxPlayers)) {
      const name = gdPlayers[key]?.boxscoreName
      if (!name) continue
      map.set(name, { side, name })
      const bare = name.replace(/\.$/, '')
      if (bare !== name && !map.has(bare)) map.set(bare, { side, name })
    }
  }
  return map
}

// The club a named player belongs to, plus the roster's own spelling of his
// name for display. `side` is undefined for anyone no roster claims — a
// manager, an umpire, or a name this parse got wrong — and those keep the text
// exactly as the feed wrote it.
function resolvePlayer(teamOf, name) {
  const hit = teamOf.get(name)
  return hit ?? { side: undefined, name }
}

function splitEntries(value) {
  return (value ?? '')
    .split(';')
    .map((s) => s.trim().replace(/\.\s*$/, '').trim())
    .filter(Boolean)
}

// Re-joins one club's entries into the row the sheet prints, closed with the
// period the feed writes at the end of every one of these. A suffix name in
// last position ("…; Balboni Jr.") already carries it — appending blindly gave
// that club "Balboni Jr..".
function closeRow(entries) {
  const text = entries.join('; ')
  return text.endsWith('.') ? text : `${text}.`
}

// "Holmes, C 90-57" -> { name: 'Holmes, C', stat: '90-57' }
function splitNameStat(entry) {
  const m = entry.match(/^(.+?)\s+(\d[\d-]*)$/)
  return m ? { name: m[1].trim(), stat: m[2] } : { name: entry, stat: '' }
}

// "Soto, J (by Soriano, G)" -> { name: 'Soto, J', count: '', detail: 'by Soriano, G' }
// "Jackson, A 4 (Ball-Confirmed, …)" -> { name: 'Jackson, A', count: '4', detail: '…' } —
// an ABS Challenge row tallies a repeat challenger as "Name N (result; result…)"; the
// count must be split off before matching, or a player who challenged more than once
// fails the roster-name lookup below and falls into the unattributed `shared` bucket
// instead of his own team's (regardless of which side he's on — this isn't a
// home/away-specific bug, just any name this pattern applies to). Kept separate from
// `name` so the caller can still show the count in the rendered text.
//
// The PARENTHETICAL IS OPTIONAL, and that is the whole of a second bug: a Balk
// or WP row states a repeat offender as a bare "Seymour, C 2" with no detail to
// close it. Requiring the parens made the count part of the name, so the lookup
// missed and the row dropped into the foot — in 27 of 157 real games swept.
function splitNameDetail(entry) {
  const m = entry.match(/^(.+?)(?:\s+(\d+))?\s*(?:\(([^)]*)\))?$/)
  return m
    ? { name: m[1].trim(), count: m[2] ?? '', detail: (m[3] ?? '').trim() }
    : { name: entry, count: '', detail: '' }
}

// Splits the info block's per-player rows onto the club of the player each one
// NAMES FIRST — the man the note is about. That is the pitcher on every row
// but two: HBP and IBB name the batter and hand him to his own club's BATTING
// notes (see BATTER_NOTE_LABELS). Anything that can't be matched to a roster
// name is kept, under its original label, in `shared` rather than dropped or
// guessed onto the wrong side.
//
// Returns `{ away, home, shared }`, where each club's half is
// `{ batting, pitching }` — two lists because they print under different
// headings on the sheet, not because they are parsed differently.
export function splitGameNotes(feed) {
  const info = feed?.liveData?.boxscore?.info ?? []
  const teamOf = nameTeamMap(feed)
  const bucket = {
    away: { batting: [], pitching: [] },
    home: { batting: [], pitching: [] },
    shared: [],
  }

  for (const row of info) {
    if (!row.label || row.value == null) continue
    if (DEDUPED_INFO_LABELS.has(row.label)) continue

    const isStat = STAT_SPLIT_LABELS.has(row.label)
    if (!isStat && !NAME_SPLIT_LABELS.has(row.label)) {
      bucket.shared.push(row)
      continue
    }
    const group = BATTER_NOTE_LABELS.has(row.label) ? 'batting' : 'pitching'

    const bySide = { away: [], home: [], other: [] }
    for (const entry of splitEntries(row.value)) {
      let text, side
      if (isStat) {
        const parsed = splitNameStat(entry)
        const player = resolvePlayer(teamOf, parsed.name)
        side = player.side
        text = parsed.stat ? `${player.name} ${parsed.stat}` : player.name
      } else {
        const parsed = splitNameDetail(entry)
        const player = resolvePlayer(teamOf, parsed.name)
        side = player.side
        const nameWithCount = parsed.count ? `${player.name} ${parsed.count}` : player.name
        text = parsed.detail ? `${nameWithCount} (${parsed.detail})` : nameWithCount
      }
      ;(bySide[side] ?? bySide.other).push(text)
    }
    for (const side of ['away', 'home']) {
      if (bySide[side].length) {
        bucket[side][group].push({ label: row.label, value: closeRow(bySide[side]) })
      }
    }
    if (bySide.other.length) {
      bucket.shared.push({ label: row.label, value: closeRow(bySide.other) })
    }
  }

  return bucket
}

// Folds the info block's batter rows (HBP, IBB) into a club's own BATTING note
// group, so the sheet prints one BATTING block per club rather than the same
// heading twice. They go ABOVE the "Team RISP"/"Team LOB" tallies that close
// that group: those are club totals and read as its footer, while HBP is a
// per-batter line like the 2B and GIDP rows it now sits with. A club whose
// feed carried no BATTING group at all (thin MiLB records) gets one, first,
// which is where MLB orders it.
export function mergeBattingNotes(groups, rows) {
  if (rows.length === 0) return groups
  const idx = groups.findIndex((g) => g.title.toUpperCase() === 'BATTING')
  if (idx === -1) return [{ title: 'BATTING', rows }, ...groups]
  const existing = groups[idx].rows
  const at = existing.findIndex((r) => /^Team\b/i.test(r.label ?? ''))
  const merged =
    at === -1
      ? [...existing, ...rows]
      : [...existing.slice(0, at), ...rows, ...existing.slice(at)]
  return groups.map((g, i) => (i === idx ? { ...g, rows: merged } : g))
}

// The BATTING / BASERUNNING / FIELDING note groups a printed box score carries
// under each team (HR detail, 2-out RBI, SB, DP, Team LOB…).
export function teamNoteGroups(feed, side) {
  const groups = feed?.liveData?.boxscore?.teams?.[side]?.info ?? []
  return groups
    .map((g) => ({
      title: g.title ?? '',
      rows: (g.fieldList ?? []).filter((r) => r.label || r.value),
    }))
    .filter((g) => g.rows.length)
}

