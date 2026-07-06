// Running pitching lines, gated by what the user has revealed.
//
// SPOILER NOTE — read before touching this. A pitcher's line (IP/R/ER/H…) is
// score-revealing, so it is driven entirely by the reveal high-water mark
// (`revealedThrough`, the furthest half-inning the user has uncovered — see
// InningViewer / RollingLine). Stats are accumulated ONLY from plays in revealed
// half-innings, so nothing from a sealed inning ever reaches the DOM. Runs and
// earned runs are attributed to the play's `responsiblePitcher` (so inherited
// runners are charged correctly), and a pitcher whose whole outing is already
// revealed uses his exact boxscore line; a still-active pitcher mid-outing uses
// the partial computed from revealed plays only.

// A total order over half-innings: top of the 1st = 0, bottom = 1, top of the
// 2nd = 2, … Lets a single number express "revealed through here".
export function halfIndex(inning, half /* 'top' | 'bottom' */) {
  return (inning - 1) * 2 + (half === 'top' ? 0 : 1)
}

function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

// Per-team pitching lines for every pitcher who has appeared in a revealed
// half-inning. `revealedThrough` is a half-index (see halfIndex); pass -1 for
// "nothing revealed". Returns { away: [...], home: [...] } in the order pitchers
// entered, each row: { id, last, first, jersey, hand, ip, pitches, bf, h, r,
// er, bb, k }.
export function computePitcherLines(feed, revealedThrough) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const players = feed?.gameData?.players ?? {}
  const boxTeams = feed?.liveData?.boxscore?.teams ?? {}

  const acc = {} // pitcherId -> partial stat accumulator over revealed plays
  const firstIdx = {} // pitcherId -> first half-index he threw in (spoiler-free)
  const lastIdx = {} // pitcherId -> last half-index he threw in (spoiler-free)
  const get = (id, side) =>
    (acc[id] ??= { id, side, outs: 0, pitches: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, k: 0 })

  let curHalf = null
  let outsBefore = 0
  for (const p of plays) {
    const inn = p?.about?.inning
    const half = p?.about?.halfInning
    if (!inn || !half) continue
    const i = halfIndex(inn, half)
    const pid = p?.matchup?.pitcher?.id

    // Appearance span reads innings only — safe to compute over every play.
    if (pid) {
      if (firstIdx[pid] == null || i < firstIdx[pid]) firstIdx[pid] = i
      if (lastIdx[pid] == null || i > lastIdx[pid]) lastIdx[pid] = i
    }

    if (i > revealedThrough) continue // sealed inning — never accumulate it
    if (!pid) continue

    const side = half === 'top' ? 'home' : 'away' // pitching side works this half
    const a = get(pid, side)

    if (p.result?.type === 'atBat') a.bf += 1
    a.pitches += (p.playEvents ?? []).filter((e) => e.isPitch).length

    const ev = p.result?.eventType
    if (ev === 'single' || ev === 'double' || ev === 'triple' || ev === 'home_run') a.h += 1
    if (ev === 'walk' || ev === 'intent_walk') a.bb += 1
    if (ev === 'strikeout' || ev === 'strikeout_double_play') a.k += 1

    for (const rn of p.runners ?? []) {
      const md = rn.details
      if (md?.isScoringEvent && rn.movement?.end === 'score') {
        const rp = md.responsiblePitcher?.id ?? pid
        const ra = get(rp, side)
        ra.r += 1
        if (md.earned) ra.er += 1
      }
    }

    // Outs (for IP) = the running out count's delta within the half-inning.
    const hk = `${inn}-${half}`
    if (curHalf !== hk) {
      curHalf = hk
      outsBefore = 0
    }
    const outsAfter = p.count?.outs ?? outsBefore
    a.outs += Math.max(0, outsAfter - outsBefore)
    outsBefore = outsAfter
  }

  const out = { away: [], home: [] }
  for (const side of ['away', 'home']) {
    const team = boxTeams[side]
    const order = team?.pitchers ?? []
    const boxPlayers = team?.players ?? {}
    for (const id of order) {
      if (firstIdx[id] == null || firstIdx[id] > revealedThrough) continue // not revealed yet

      const person = players[`ID${id}`] ?? {}
      const box = boxPlayers[`ID${id}`] ?? {}
      const a = acc[id] ?? { outs: 0, pitches: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, k: 0 }
      const s = box.stats?.pitching ?? {}

      // Whole outing revealed → exact boxscore line; otherwise the running
      // partial from revealed plays only (never past the reveal mark).
      const fullyRevealed = lastIdx[id] <= revealedThrough
      const line = fullyRevealed
        ? {
            ip: s.inningsPitched ?? outsToIp(a.outs),
            pitches: s.numberOfPitches ?? s.pitchesThrown ?? a.pitches,
            bf: s.battersFaced ?? a.bf,
            h: s.hits ?? a.h,
            r: s.runs ?? a.r,
            er: s.earnedRuns ?? a.er,
            bb: s.baseOnBalls ?? a.bb,
            k: s.strikeOuts ?? a.k,
          }
        : {
            ip: outsToIp(a.outs),
            pitches: a.pitches,
            bf: a.bf,
            h: a.h,
            r: a.r,
            er: a.er,
            bb: a.bb,
            k: a.k,
          }

      out[side].push({
        id,
        last: (person.lastName ?? person.boxscoreName ?? person.fullName ?? '').trim(),
        first: (person.firstName ?? '').trim(),
        jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
        hand: person.pitchHand?.code ?? '', // 'L' | 'R'
        ...line,
      })
    }
  }
  return out
}
