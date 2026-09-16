// HOW MUCH BASEBALL A MAN SAW, which is the denominator questions 5 and 6 of
// the ABS report need and nothing else in this job carries. The fourth pure
// part of gen-abs-challenges.mjs (rows.mjs makes the rows, bank.mjs replays the
// bank, export.mjs ships the file).
//
// "Yelich challenged 14 times" is a fact about how often he played, not about
// how often he argues. Divided by the pitches he saw it becomes a habit: a
// batter challenges about once every 40 plate appearances, a catcher about
// once every 8 innings caught. THE SPREAD IS SO WIDE THAT THE MEAN DESCRIBES
// NOBODY — seven qualified hitters never challenged once all season, and one
// called for 32 in 1,085 pitches — which is the finding, and it needs the
// denominator to exist at all.
//
// THE ONE NEW FETCH IN THE WHOLE JOB. Everything else on this report costs
// `--export-only`; this costs one roster call a club a level, about 60 in
// total. Verified against the live API before it was relied on:
//
//   /api/v1/teams/{teamId}/roster?rosterType=fullSeason&season={season}
//     &hydrate=person(stats(type=season,group=[hitting,fielding],season={season},sportId={1|11}))
//
// One call carries everything: the hitting split has `numberOfPitches` and
// `plateAppearances`, and the fielding splits carry `innings` and
// `gamesStarted` PER POSITION, so a catcher's innings come from the split
// whose `position.abbreviation` is C.
//
// NOTHING IN STATSAPI COUNTS PITCHES RECEIVED. There is no catcher equivalent
// of `numberOfPitches`, and the honest options are innings caught or games
// started behind the plate. This uses innings caught, and the surface has to
// LABEL IT AS THAT — a catcher's per-9 and a batter's per-1,000-pitches cannot
// be compared straight across, and quietly reusing the batter number for a
// catcher would invent a figure MLB does not publish.

// A SEASON SNAPSHOT, NOT AN APPEND-ONLY LEDGER. A player's totals grow all
// year, so a re-run REPLACES a club's rows rather than adding to them. That is
// the opposite of how abs_challenges works, and it is why the sweep deletes a
// club's rows before it writes them.

// The position whose innings stand in for pitches received.
export const CATCHER = 'C'

// INNINGS ARE WRITTEN IN OUTS, NOT IN DECIMALS. `innings: "1020.2"` is 1020 and
// TWO THIRDS, not 1020.2 — the digit after the point is a count of outs, and
// across a whole Brewers roster the only fractional parts that appear are 0, 1
// and 2, which is what proves it. parseFloat would quietly under-count every
// catcher on the board by up to half an inning.
//
// Anything that is not that shape returns null rather than a guess, including
// a third of an inning written as `.3`, which would mean the notation had
// changed under us.
export function inningsFromOuts(text) {
  if (text == null) return null
  const m = /^(\d+)(?:\.(\d))?$/.exec(String(text).trim())
  if (!m) return null
  const outs = Number(m[2] ?? 0)
  if (outs > 2) return null
  return Number(m[1]) + outs / 3
}

// A stat group off one hydrated person, by name.
function groupOf(person, name) {
  return (person?.stats ?? []).find((s) => s.group?.displayName === name)
}

// THE AGGREGATE SPLIT HAS NO `team` KEY AT ALL, and it is listed FIRST. A
// traded player carries one split per club plus that total — Bo Naylor's reads
// 94 PA with no team, then 90 for Cleveland and 4 for Milwaukee — so matching
// on `split.team?.id` both skips the aggregate and attributes the exposure to
// the right club. 39 MLB players challenged under more than one club this
// season, and a reader that took the first split would credit every one of
// them to a total they did not earn at that club.
//
// Only THIS club's splits are kept. A traded man appears on both clubs'
// fullSeason rosters, so each club's own call writes only its own rows and the
// delete-then-insert per club stays clean.
function splitsForTeam(group, teamId) {
  return (group?.splits ?? []).filter((sp) => sp.team?.id === teamId)
}

// One club's roster response turned into exposure rows.
//
// EVERY MAN ON THE ROSTER GETS A ROW, including one who never challenged and
// one who never batted. A board built only from the players who challenged
// cannot answer "how many never did", and the answer — seven qualified hitters
// — is half of what question 5 is asking.
//
// A pitcher with no hitting split is not an error: he has no `numberOfPitches`
// and no `plateAppearances`, and those stay null rather than becoming zero,
// because a null divides to "no rate" and a zero divides to infinity.
export function exposureRowsFor(roster, { season, level, teamId }) {
  const out = []
  for (const entry of roster?.roster ?? []) {
    const person = entry?.person
    if (person?.id == null) continue

    const hitting = splitsForTeam(groupOf(person, 'hitting'), teamId)
    const fielding = splitsForTeam(groupOf(person, 'fielding'), teamId)
    const behindPlate = fielding.filter((sp) => sp.position?.abbreviation === CATCHER)

    // Summed rather than taken, because a split is per position and a man can
    // hold more than one. In practice hitting is one split a club.
    const sum = (rows, key) => {
      let total = null
      for (const r of rows) {
        const v = r.stat?.[key]
        if (v == null) continue
        total = (total ?? 0) + Number(v)
      }
      return total
    }
    let catcherInnings = null
    for (const sp of behindPlate) {
      const innings = inningsFromOuts(sp.stat?.innings)
      if (innings != null) catcherInnings = (catcherInnings ?? 0) + innings
    }

    out.push({
      season,
      level,
      team_id: teamId,
      player_id: person.id,
      name: person.fullName ?? '',
      position: entry.position?.abbreviation ?? '',
      pitches: sum(hitting, 'numberOfPitches'),
      plate_appearances: sum(hitting, 'plateAppearances'),
      catcher_innings: catcherInnings,
      catcher_starts: sum(behindPlate, 'gamesStarted'),
    })
  }
  return out
}

// Every club's rows folded into one figure per player, which is what a season
// board divides by. A man traded midseason has his two clubs added together:
// the board asks how often HE calls for a review, not how often he did it in
// one uniform.
export function exposureByPlayer(rows) {
  const out = new Map()
  for (const r of rows ?? []) {
    const cur = out.get(r.player_id) ?? {
      pitches: null, plateAppearances: null, catcherInnings: null, catcherStarts: null,
    }
    const add = (a, b) => (b == null ? a : (a ?? 0) + Number(b))
    cur.pitches = add(cur.pitches, r.pitches)
    cur.plateAppearances = add(cur.plateAppearances, r.plate_appearances)
    cur.catcherInnings = add(cur.catcherInnings, r.catcher_innings)
    cur.catcherStarts = add(cur.catcherStarts, r.catcher_starts)
    out.set(r.player_id, cur)
  }
  return out
}

// THE TWO RATES, AND THEY ARE NOT THE SAME KIND OF NUMBER.
//
// A batter's is per 1,000 pitches seen — a real count of the pitches he stood
// in against. A catcher's is per 9 innings caught, a stand-in, because nothing
// counts the pitches he received. They are both "how often does he ask", and
// they are NOT comparable across the two, which is why they are named
// separately here rather than shipped as one `rate` column that a surface
// could put in one sorted list.
//
// EACH RATE COUNTS ONLY THE CHALLENGES ITS OWN DENOMINATOR CAN EXPLAIN, and
// this is the trap the whole module exists to avoid. A catcher who also hits
// is TWO challengers: Francisco Alvarez called for 102 reviews, some standing
// at the plate and some squatting behind it, and dividing all 102 by the
// pitches he saw as a BATTER invents a man who argues with every other pitch
// he sees. So `byRole` is his split, not his total — the batter rate takes his
// batter challenges over his pitches seen, the catcher rate his catcher
// challenges over his innings caught, and neither borrows the other's
// numerator.
//
// Null when the denominator is missing or nought, never zero and never
// Infinity: "he never batted" and "he batted and never asked" are different
// facts, and a board that printed both as 0.0 would lose the more interesting
// one. A denominator of nought with challenges against it stays null too,
// because a rate out of no opportunity is not a large number, it is no number.
export function exposureRates(byRole, exposure) {
  // THE DENOMINATOR DECIDES WHETHER THERE IS A NUMBER AT ALL, and a missing
  // numerator over a real denominator is a REAL ZERO. A man who saw a thousand
  // pitches and never once argued is the finding, not a gap: four qualified
  // MLB hitters are in exactly that position, and three of them leave no
  // challenge row anywhere for a board to find them by.
  const per = (n, d, scale) => (d != null && d > 0 ? ((n ?? 0) / d) * scale : null)
  const counts = byRole ?? {}
  return {
    pitches: exposure?.pitches ?? null,
    plateAppearances: exposure?.plateAppearances ?? null,
    catcherInnings: exposure?.catcherInnings ?? null,
    catcherStarts: exposure?.catcherStarts ?? null,
    // His own split, carried beside the rates so a surface can show what each
    // one was computed from rather than taking it on trust.
    asBatter: counts.batter ?? 0,
    asCatcher: counts.catcher ?? 0,
    asPitcher: counts.pitcher ?? 0,
    per1000Pitches: per(counts.batter, exposure?.pitches, 1000),
    perPlateAppearance: per(counts.batter, exposure?.plateAppearances, 1),
    per9Caught: per(counts.catcher, exposure?.catcherInnings, 9),
  }
}
