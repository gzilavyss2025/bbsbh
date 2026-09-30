// THE SCORING SUMMARY — every scoring play of the game, grouped by half-inning,
// for the box score's card of the same name.
//
// REVEAL-ONLY. Every field here is a run, a running score or a sentence that
// says who drove it in. It may be called from exactly one place: the box
// score's SealBox reveal render, through `screens/boxscore/revealBoxScore.js`
// (ADR-0001/0002). The box score is already one seal over the whole game
// (ADR-0049), so there is no half clamp to apply here.
//
// THE FEED. `liveData.plays.scoringPlays` is a list of indexes into `allPlays`,
// matched on `about.atBatIndex` rather than array position (the same join
// `boxscore.js`'s playIdForWinProbEntry makes). Verified against gamePk 823035
// (MIL @ STL, 2026-07-07): eight scoring plays, each carrying `result.awayScore`
// / `result.homeScore` AFTER the play, and `runners[].movement.end === 'score'`
// for every man who crossed.
//
// WHO GETS THE FACE. The batter, unless he had no hand in the run: a run on a
// wild pitch or a steal of home, scored during a plate appearance that ended in
// a strikeout, has no RBI and the batter is not among the men who scored. Then
// the first man who scored is the player the row is about. A batter who scores
// himself on an error keeps the row, RBI or not.
//
// THE CLIP KEY is the plate appearance's LAST pitch — the same key
// `playIdForWinProbEntry` resolves, and the one `highlights.js` and
// `clipIndex.js` join on. Null on the pruned past-game feed, which lists no
// `playEvents`; callers render no Watch button for a null.
//
// Returns [{ inning, half, teamId, abbr, awayScore, homeScore, plays: [...] }]
// in game order, `awayScore`/`homeScore` being the score after the group's last
// play. Never throws on a thin feed; a scoreless game is [].

function terminalPlayId(play) {
  const pitches = (play?.playEvents ?? []).filter((e) => e?.isPitch)
  return pitches.at(-1)?.playId ?? null
}

// The man the row is about — see "WHO GETS THE FACE" above.
function responsibleMan(play) {
  const batter = play?.matchup?.batter
  const scorers = (play?.runners ?? [])
    .filter((r) => r?.movement?.end === 'score')
    .map((r) => r?.details?.runner)
    .filter((r) => r?.id != null)
  const batterHadAHand = (play?.result?.rbi ?? 0) > 0 || scorers.some((r) => r.id === batter?.id)
  if (batter?.id != null && (batterHadAHand || scorers.length === 0)) return batter
  return scorers[0] ?? batter ?? null
}

export function computeScoringSummary(feed) {
  const plays = feed?.liveData?.plays
  const indexes = plays?.scoringPlays
  if (!Array.isArray(indexes) || indexes.length === 0) return []
  const byIndex = new Map((plays.allPlays ?? []).map((p) => [p?.about?.atBatIndex, p]))
  const teams = feed?.gameData?.teams ?? {}

  const groups = []
  for (const idx of indexes) {
    const p = byIndex.get(idx)
    if (!p) continue
    const inning = p.about?.inning ?? null
    const half = p.about?.isTopInning ? 'top' : 'bottom'
    const team = teams[half === 'top' ? 'away' : 'home'] ?? {}
    const awayScore = p.result?.awayScore ?? null
    const homeScore = p.result?.homeScore ?? null
    const who = responsibleMan(p)

    let group = groups.at(-1)
    if (!group || group.inning !== inning || group.half !== half) {
      group = { inning, half, teamId: team.id ?? null, abbr: team.abbreviation ?? '', awayScore, homeScore, plays: [] }
      groups.push(group)
    }
    group.awayScore = awayScore
    group.homeScore = homeScore
    group.plays.push({
      atBatIndex: idx,
      playerId: who?.id ?? null,
      playerName: who?.fullName ?? '',
      event: p.result?.event ?? '',
      desc: p.result?.description ?? '',
      awayScore,
      homeScore,
      playId: terminalPlayId(p),
    })
  }
  return groups
}
