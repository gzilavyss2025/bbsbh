// Per-game "call-out" enrichment, read from a static same-origin file
// (public/data/callouts/<MMDDYYYY>.json) rather than assembled live.
//
// The file is precomputed the night before by scripts/gen-callouts.mjs (see
// .github/workflows/update-nightly-data.yml) for that day's slate — MLB plus
// the four full-season MiLB levels — season leaders, streaks, and situational
// team records for every club playing, joined per gamePk. Same
// build-time-fetch pattern as war.js / minors-leaders.js; every value in it is
// a SEASON AGGREGATE, so it's spoiler-free — the app's spoiler-safety comes
// from WHERE each note renders (inside a revealed play card, or on an extras
// page), never from this data. Since it covers MiLB it runs ~0.5-1 MB per
// date, so it's kept OUT of the PWA precache and fetched at runtime (see
// vite.config.js), like vs-team-splits.json.
//
// Degrades to an empty games map before the file exists or on any failure — a
// game with no bundle simply shows no notes (un-generated dates, MiLB games in
// files predating the MiLB expansion, a failed nightly run). Cached in-memory
// per date for the session, since a given day's file only changes once (the
// pre-dawn cron).
const cache = new Map() // urlDate (MMDDYYYY) -> { games }

export async function fetchCallouts(urlDate) {
  if (!urlDate) return { games: {} }
  if (cache.has(urlDate)) return cache.get(urlDate)
  let result = { games: {} }
  try {
    const res = await fetch(`/data/callouts/${urlDate}.json`)
    if (res.ok) {
      const data = await res.json()
      result = { games: data.games ?? {} }
    }
  } catch {
    // leave the empty default — no notes rather than a broken view
  }
  cache.set(urlDate, result)
  return result
}

// This game's bundle, or null when the file didn't cover it. Shape (all keys
// present, values possibly empty) — see scripts/gen-callouts.mjs's header for
// how each family is derived:
//   { sportId (the game's level — 1 MLB, 11-14 MiLB),
//     dayNight ('day'|'night'|'' — the schedule endpoint's own copy of
//       gameData.datetime.dayNight, so the note builders can say "today" vs
//       "tonight" without needing the whole feed; see select.js's dayWordFor),
//     away:{teamId,name}, home:{teamId,name},
//     bullpen?:{ avgPitches, windowDays } — the level's average-reliever pitch
//       count over the trailing window (the workload note's peer figure),
//     leaders:{ [playerId]: { team, cats:{ hr, doubles, ... } } },
//     pitcherLeaders:{ [playerId]: { team, cats:{ so_p } } },
//     streaks:{ [playerId]: { onBase?, onBaseStart? ('YYYY-MM-DD', the
//       streak's first game), stolenBase? } },
//     homerRecords:{ [playerId]: 'W-L' },
//     situational:{ [playerId]: { risp?, vl?, vr? } }, each { avg, ops },
//     hitterLines:{ [playerId]: { season, career } }, each
//       { pa, ab, h, hr, bb, xbh, avg } | null — the baselines the
//       vs-opponent note is judged against (see callout-notes.js); MLB only,
//     birthdays:[ playerId ] (whose birthday is today),
//     birthdayStats:{ [playerId]: { avg, h, ab, hr, g } } (career line on his
//       birthday, a subset of `birthdays` that cleared the sample floors; MLB
//       only, like every career-derived family),
//     starterRecords:{ [pitcherId]: { homeAway?:{home,away},
//       teamStarts?:{w,l}, sixIp?, tenK?, cgShutout?, scorelessStreak?,
//       recentAppearances?, recentPitches?, reliever? (true),
//       pitchedYesterday? (true), backToBack?:{g,era,restEra},
//       leverage?:{ahead,behind,tied} (each {avg,ops,ip}|null — opponents'
//       line with his club ahead/behind/tied),
//       tto?:{1,2,3} (each {pa,ab,h,avg,ops} — opponents' line the 1st/2nd/
//       3rd+ time through the order; probable starters only) } } — one entry
//       per ROSTERED pitcher on either club, not just the day's probable
//       starters; teamStarts is the CLUB's W-L in his starts (numbers, so
//       tonight's result can fold in),
//     milestones:{ [playerId]: { stat, label, value, threshold, remaining } }
//       — the nearest round career-total milestone (see MILESTONE_DEFS,
//       src/api/person.js) any rostered hitter or pitcher is within a single
//       game's plausible reach of, for the lineup-staging pill; MLB only,
//     teamRecords:{ away:{extraInning,oneRun (MLB only — standings splits),
//       scoringFirst,opponentScoringFirst,
//       leadAfter:{[inning]:'W-L'}, leadAfterFull:{[inning]:{w,l}},
//       inningRuns:{[inning]:{f,a,g}} (runs for/against + games sampled,
//       innings 1–9), runsScored:{[bucket]:'W-L'},
//       runsAllowedByInning:{[inning]:'W-L'}, comeback}, home:{…} } }
//
// Fields newer than a given date's committed file simply aren't there (the
// nightly cron regenerates future dates only) — every consumer null-guards, so
// a stale bundle just means fewer notes, never a crash.
export function calloutsForGame(data, gamePk) {
  return data?.games?.[gamePk] ?? null
}

// The lineup-staging pill text for one player, or null when he's not within
// plausible reach of a milestone tonight (no bundle, a MiLB game — milestones
// are career-based and so MLB-only — or simply not close). Takes the
// already-resolved per-game bundle (`calloutsForGame`'s
// return — the same shape GameView threads down as `gameCallouts`/`callouts`
// to InningViewer/BoxScore), not the raw fetched data + gamePk. "4 H shy of
// 2,000 for his career" — see MILESTONE_DEFS for the stat/label table.
export function milestoneTextFor(bundle, playerId) {
  const m = bundle?.milestones?.[playerId]
  if (!m) return null
  const label = m.remaining === 1 ? m.label.replace(/s$/, '') : m.label
  return `${m.remaining} ${label} shy of ${m.threshold.toLocaleString('en-US')} for his career`
}
