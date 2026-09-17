// BOX LINES — the facet half (ADR-0069). One tagged object says WHICH of a
// player's career games a sheet is about; this module turns it into the three
// things the fetch and the gate need, and nothing else:
//
//   opponentId    — a club id when the facet can narrow the game log itself
//   gameTypes     — which game types may produce a row at all
//   keep(row)     — a predicate over FINISHED rows, applied by boxLineRows
//                   AFTER its cutoff and Final checks
//   needsLineups  — whether the row needs to know if he was in the starting
//                   lineup, which costs a second, narrow schedule pass
//
// WHY A PREDICATE OVER ROWS, NOT A SECOND FILTER OVER SPLITS. The gate in
// rows.js is the whole spoiler defense, and a facet must not be able to reach
// around it. Handing the facet a `keep` that runs last makes that structural:
// a facet can only ever narrow a row set the gate already approved. It has no
// way to widen one, because the rows it never sees do not exist (ADR-0069).
//
// WHY MOST FACETS DO NOT NARROW THE GAME LOG. `club` is decidable from the
// split alone (`split.opponent.id`), so it filters before the schedule join and
// the sheet pulls the schedule for a handful of games — that is the lineup
// page's one door, and it stays cheap. Every other facet either reads a
// SCHEDULE field the split does not carry (`venue`, and `dayNight`, which the
// game log reports wrongly — verified 2026-09-02) or is one of nine doors on
// the player page's card, where nine narrow fetches would repeat the same join
// nine times. Those share ONE career join instead (fetch.js memoizes it), and
// pay for themselves from the second door on.
//
// Class: spoiler-free (spoiler-manifest.json). Nothing here reads a score, a
// date cutoff or a reveal mark: it is a description of a question, handed to
// the module that already owns the answer's gate.
import { askableGameTypes, POSTSEASON, REGULAR_SEASON } from './rows.js'

// "2024-09-29" -> 0 (Sunday) .. 6. Manual y/m/d at midday UTC, the same
// timezone-proof construction dayBefore uses in rows.js: a local-midnight Date
// would land a west-coast night game on the previous weekday.
export function weekdayOf(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

// "2024-09-29" -> 9. Read off the string rather than a Date for the same reason.
export function monthOf(iso) {
  return Number(String(iso).slice(5, 7))
}

// A facet a LIST asks TWICE: once per group, and once with NO group named —
// the sheet's own listing pass, which must come back with every row the list
// can describe. Naming no group therefore keeps every row that HAS one, which
// is never "none" (an empty list) and never "all" (a list with a group for the
// rows that belong to none). Both list facets are built from this, so the
// second one cannot forget the case the first one needed.
function groupKeep(key, read) {
  return key == null ? (r) => read(r) != null : (r) => read(r) === key
}

// The plan for one facet, or the everything-plan when `facet` is null.
// `narrowsSplits` tells fetch.js which of its two paths this facet earns: the
// club path filters the game log first, everything else joins the career once.
// The game types a facet asks the log for when it means to count EVERY kind of
// game — the calendar doors, and since #1048/#998 the two lists. Already
// normalized to the four rounds rather than the umbrella 'P', which a pitching
// log answers for every row and so empties the sheet (rows.js's POSTSEASON).
// Null when the facet did not ask, which leaves the fetch on its default
// regular season and on the join every other door is sharing.
function widenedTypes(facet) {
  return facet.postseason ? [...REGULAR_SEASON, ...POSTSEASON] : null
}

export function facetPlan(facet) {
  const plan = { opponentId: null, gameTypes: null, keep: null, narrowsSplits: false, needsLineups: false }
  if (!facet) return plan
  switch (facet.kind) {
    case 'club':
      // The only facet that narrows the fetch: one club, a handful of games.
      return { ...plan, opponentId: facet.opponentId ?? null, narrowsSplits: true }
    case 'venue':
      // WHICH PARK, off the SCHEDULE record's own venue and never off opponent
      // + isHome, which is wrong at a neutral site — London, Mexico City, a
      // hurricane relocation. One park's games, or, with no park named, every
      // row that has one: this facet backs the By ballpark LIST (#998) as well
      // as a single park's sheet.
      //
      // IT COUNTS OCTOBER, like the calendar doors and for the same reason: a
      // park does not stop being Dodger Stadium because the game was a division
      // series. Measured 2026-09-17 — Betts at Globe Life Field is 9
      // regular-season games and 16 postseason ones, so the regular season
      // alone would state 9 of 25. No park is ever ADDED by this (every
      // postseason park was one he also played at in the summer, over three
      // careers checked); the counts are what it corrects.
      return {
        ...plan,
        gameTypes: widenedTypes(facet),
        keep: groupKeep(facet.venueId ?? null, (r) => r.venueId),
      }
    case 'surface':
      // GRASS OR ARTIFICIAL TURF, as the park was THAT SEASON. The schedule
      // record carries it under `hydrate=venue(fieldInfo)` and it is
      // season-correct, not today's answer: Chase Field reads Grass for 2016
      // and 2018 and Artificial Turf from 2019, which is exactly when it was
      // relaid (verified 2026-09-15 on real gamePks at that park). A static
      // surface table would have called every one of those 2016 games turf.
      //
      // THE DOOR AND THE ROWS AGREE, and for once exactly: MLB's `g`/`t`
      // career aggregate matched the joined rows on Yelich to the game (this is
      // the SURFACE pair, which reads the regular season only — the calendar
      // doors above span the postseason too) —
      // 1,671 grass and 54 turf on both sides — and Frelick by one. That puts
      // this pair with the calendar doors rather than with home/road, and the
      // reason is the same: a park's surface in a given season is a fact both
      // sides read off the same venue record.
      return { ...plan, keep: (r) => r.surface === facet.value }
    case 'month':
      // OCTOBER IS THE MONTH THIS EXISTS FOR. A month is a fact about the date,
      // and a date does not stop being October because the game was a division
      // series — so a calendar door marked `postseason` widens the FETCH to
      // both and keeps whatever lands in its month. The predicate is unchanged;
      // it never asked what kind of game it was.
      return { ...plan, gameTypes: widenedTypes(facet), keep: (r) => monthOf(r.date) === Number(facet.month) }
    case 'dayNight':
      return { ...plan, keep: (r) => r.dayNight === facet.value }
    case 'weekday':
      // Same for a Sunday in the World Series (see 'month' above).
      return { ...plan, gameTypes: widenedTypes(facet), keep: (r) => weekdayOf(r.date) === Number(facet.day) }
    case 'side':
      // `isHome` is on the split too, but the row's `home` is derived from the
      // SCHEDULE's away/home clubs, which is the same fact checked against the
      // record that also supplied the score. One source, no way to disagree.
      //
      // THE DOOR'S FIGURE COMES FROM MLB'S AGGREGATE, THESE ROWS FROM MLB'S
      // PER-GAME FLAG, AND THE TWO DIFFER ON A RELOCATED GAME. Both are stock:
      // statsapi ignores `sitCodes` on the game log (verified 2026-09-03 — a
      // season's log returns all 158 rows whether or not `h` is asked for), so
      // there is no per-game situation list to adopt and the aggregate cannot
      // be reconciled row by row. Measured over five careers, they agree
      // season by season except where a home game was moved: Braun matches in
      // 9 of his 10 seasons and differs by one in 2020. Career totals land 1
      // to 5 games apart (Yelich 849 vs 853, Betts 818 vs 818, Peterson 78 vs
      // 79). ADR-0069 records it. Do NOT try to close the gap with a third
      // definition: deriving "his club's park that season" and counting that
      // was tried, and it counts the 2020-21 Blue Jays' Buffalo and Dunedin
      // home games as road games — 44 games wrong on Guerrero alone.
      return { ...plan, keep: (r) => r.home === Boolean(facet.home) }
    case 'started':
      // Pitchers only: the hitting game log carries no gamesStarted, so a
      // hitter's `started` is null and this facet keeps nothing. That is the
      // right answer rather than a crash — the substitute facet (#1003) reads
      // the box score, not this flag.
      return { ...plan, keep: (r) => r.started === Boolean(facet.value) }
    case 'lineupStart':
      // WAS HIS NAME ON THE CARD? A hitter's game log carries no gamesStarted
      // (the `started` case above is pitchers only), and statsapi publishes no
      // started/substitute situation code for a hitter — `situationCodes` has
      // 602 entries and not one of them is it (verified 2026-09-15). The
      // answer is the SCHEDULE's own `hydrate=lineups`, the nine names a side,
      // and `needsLineups` is what makes fetch.js go and get them.
      //
      // `positionsPlayed` will NOT answer this, and that is the trap worth
      // recording twice: a hitter's first position is 'PH' or 'PR' only when
      // he entered as a pinch hitter or runner. A pure defensive replacement
      // enters and his list reads ['C'], indistinguishable from a start — 63
      // games wrong on one career, 25 on another. Use the lineups.
      //
      // A row the lineups could not answer for is `null` and belongs to
      // NEITHER door, which is the app's degrade-gracefully rule: a game with
      // no lineup posted is not evidence that he came off the bench.
      return { ...plan, needsLineups: true, keep: (r) => r.lineupStart === Boolean(facet.value) }
    case 'lineupSpot':
      // WHERE HE HIT THAT DAY (#1048). The same lineup arrays the facet above
      // reads, one question further in: they are already in BATTING ORDER —
      // index 0 is the leadoff man, checked against a boxscore's own
      // `battingOrder` on gamePk 747043 — so the slot costs nothing the start
      // did not already cost, and the two share one pass.
      //
      // THIS IS NOT NINE DOORS, AND MLB'S OWN SPLIT IS WHY. `sitCodes=b1…b9`
      // return clean career rows and count something else: a game with a PLATE
      // APPEARANCE in that slot, which a pinch hitter earns in the slot he hit
      // for. Yelich reads 18 at b9 and started there 0 times. A door labelled
      // from the aggregate over rows built from the lineups would open EMPTY
      // on the very slots a reader is most likely to tap, so the figures come
      // from the rows instead and the nine live behind one door as a LIST
      // (boxlines/fold.js, ADR-0069's 2026-09-16 amendment).
      //
      // NO SPOT NAMED is the list's own question: every row that HAS a slot,
      // which is what the sheet asks for while it is listing. It still costs
      // the lineups pass — without it every row comes back with a null slot and
      // the list folds to nothing — and it keeps no more than the list can
      // describe, so the widest this facet ever reaches is the games he
      // started.
      //
      // IT COUNTS OCTOBER TOO, and the lineups are there to say where he hit:
      // every postseason game carries a full card, measured over three careers
      // on 2026-09-17 (Yelich 27 of 27, Betts 91 of 91, Arenado 8 of 8). That
      // mattered more here than for a park — a game with no lineup has a null
      // slot and would leave the list silently.
      return {
        ...plan,
        gameTypes: widenedTypes(facet),
        needsLineups: true,
        keep: groupKeep(facet.spot == null ? null : Number(facet.spot), (r) => r.lineupSpot),
      }
    case 'pinchHit':
      // HE CAME UP OFF THE BENCH. The hitting game log's `positionsPlayed`
      // lists the positions he played in the ORDER he played them, so the
      // first entry is how he ENTERED: ['PH'] is a pinch hitter who was then
      // lifted, ['PH', 'LF'] one who stayed in the field.
      //
      // #1002 specified this facet as one boxscore per candidate game —
      // `battingOrder` and `gameStatus.isSubstitute` — capped at 40 with a
      // "Show older", because ADR-0069's framework map costed it that way. It
      // does not cost that. The game log already carries the answer, so there
      // is no cap, no paging and no per-game fetch: this is a `keep` over the
      // join every other door on the card is already paying for.
      //
      // Measured against MLB's own `pH` career split, 2026-09-14: Vazquez 55
      // rows against a door of 55, Yelich 46 against 45. The one extra is a
      // game he was announced for and never completed a plate appearance in —
      // MLB's aggregate counts appearances, these rows count entrances. Over
      // three careers, 'PH' never appeared anywhere but first in the list, so
      // reading [0] and asking `includes` are the same question here; [0] is
      // the one that stays right if a fourth career disagrees.
      return { ...plan, keep: (r) => r.positions?.[0] === 'PH' }
    case 'gameTypes':
      // No `keep`: the game types are applied where they belong, in
      // matchingSplits, so a non-regular row is never built in the first place.
      // They also reach the fetch, which must ASK for them — a game log is
      // regular-season-only until the call names the rounds (fetch.js).
      //
// The types a postseason door passes are rows.js's POSTSEASON, the four
      // rounds. `askableGameTypes` rewrites the umbrella 'P' to them if a
      // caller asks that way: 'P' selects the same games, but a PITCHING game
      // log echoes it back as every row's type, which this filter then drops —
      // an empty sheet for a pitcher and a full one for a hitter, off one door.
      // The measurement is in rows.js.
      return { ...plan, gameTypes: facet.types?.length ? askableGameTypes(facet.types) : null }
    default:
      // An unknown facet keeps nothing rather than everything. A typo in a
      // future facet issue shows as an empty sheet, never as a full one.
      return { ...plan, keep: () => false }
  }
}
