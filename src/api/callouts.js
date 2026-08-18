// Per-game "call-out" enrichment, read from static same-origin files
// (public/data/callouts/<MMDDYYYY>/<gamePk>.json) rather than assembled live.
//
// ONE FILE PER GAME, filed under its slate date. The set is precomputed the
// night before by scripts/gen-callouts.mjs (see
// .github/workflows/update-nightly-data.yml) for that day's slate — MLB plus
// the four full-season MiLB levels — season leaders, streaks, and situational
// team records for every club playing. Same build-time-fetch pattern as
// war.js / minors-leaders.js; every value in it is a SEASON AGGREGATE, so it's
// spoiler-free — the app's spoiler-safety comes from WHERE each note renders
// (inside a revealed play card, or on an extras page), never from this data.
// Kept OUT of the PWA precache and fetched at runtime (see vite.config.js),
// like the vs-team-splits shards.
//
// Why per game: a whole slate covering MiLB runs ~0.5-1 MB per date, and the
// surface reading it hardest — the lineup page — wants exactly ONE game out of
// it. The shard name is the key that reader already holds (the gamePk it is
// showing), so a game view costs ~10 KB. The slate's day-card pass wants
// several at once and asks only for the finals it is classifying, still a
// fraction of the day.
//
// Degrades to an empty games map before the files exist or on any failure — a
// game with no bundle simply shows no notes (un-generated dates, MiLB games on
// dates predating the MiLB expansion, a failed nightly run). Cached in-memory
// per game for the session, since a date's files only change once (the
// pre-dawn cron).
const cache = new Map() // `${urlDate}:${gamePk}` -> bundle | null

async function fetchOne(urlDate, gamePk) {
  const key = `${urlDate}:${gamePk}`
  if (cache.has(key)) return cache.get(key)
  let bundle = null
  try {
    const res = await fetch(`/data/callouts/${urlDate}/${gamePk}.json`)
    if (res.ok) bundle = await res.json()
  } catch {
    // leave null — no notes rather than a broken view
  }
  cache.set(key, bundle)
  return bundle
}

// The bundles for a set of games on one date, in the `{ games }` shape
// `calloutsForGame` reads. Callers pass only the gamePks they will ask about,
// so this never pulls the rest of the slate.
export async function fetchCallouts(urlDate, gamePks) {
  if (!urlDate || !gamePks?.length) return { games: {} }
  const ids = [...new Set(gamePks.filter((pk) => pk != null).map(String))]
  const bundles = await Promise.all(ids.map((pk) => fetchOne(urlDate, pk)))
  const games = {}
  ids.forEach((pk, i) => {
    if (bundles[i]) games[pk] = bundles[i]
  })
  return { games }
}

// This game's bundle, or null when the date's set didn't cover it. Shape (all keys
// present, values possibly empty) — see scripts/gen-callouts.mjs's header for
// how each family is derived:
//   { sportId (the game's level — 1 MLB, 11-14 MiLB),
//     dayNight ('day'|'night'|'' — the schedule endpoint's own copy of
//       gameData.datetime.dayNight, so the note builders can say "today" vs
//       "tonight" without needing the whole feed; see select.js's dayWordFor),
//     away:{teamId,name}, home:{teamId,name},
//     bullpen?:{ avgPitches, windowDays } — the level's average-reliever pitch
//       count over the trailing window (the workload note's peer figure),
//     foulRate?:{ perPitch } — league fouls/pitch (4 decimals), the baseline
//       for the "team is making the starter fight" note; MLB only, from the
//       local fouls.json (gen-fouls.mjs), absent when that file is missing,
//     foulSpoilers?:{ [playerId]: { rank, perGame, fouls, g } } — this game's
//       two clubs' hitters who rank in the league's top-10 foul-per-game board
//       (qualified: g >= max(5, round(0.5·maxG)); rank 1-based, perGame to 1
//       decimal); MLB only, same fouls.json source, absent when it's missing,
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
//       tto?:{1,2,3} (each {pa,ab,h,avg,ops,ppa} — opponents' line + pitches
//       per PA the 1st/2nd/3rd+ time through the order; probable starters only),
//       pitchPace?:{n,avg,starts} (avg pitches through the first n innings of
//       his starts; probable starters only, same playLog as tto) } } — one
//       entry per ROSTERED pitcher on either club, not just the day's probable
//       starters; teamStarts is the CLUB's W-L in his starts (numbers, so
//       tonight's result can fold in),
//     milestones:{ [playerId]: { stat, label, value, threshold, remaining } }
//       — the nearest round career-total milestone (see MILESTONE_DEFS,
//       src/api/person.js) any rostered hitter or pitcher is within a single
//       game's plausible reach of, for the lineup-staging pill; MLB only,
//     teamRecords:{ away:{extraInning,oneRun (MLB only — standings splits),
//       scoringFirst,opponentScoringFirst,
//       leadAfter:{[inning]:'W-L'}, leadAfterFull:{[inning]:{w,l}},
//       tiedAfterFull:{[inning]:{w,l}} (record when tied after 6/7/8),
//       scorelessThroughFull:{[inning]:{w,l}} (record when this club is
//       scoreless through 1–6), bothScorelessThroughFull:{[inning]:{w,l}}
//       (record when the game is still 0-0 through 2–7),
//       dayOfWeek:{[0-6]:{w,l}} (record by day of week, 0=Sun…6=Sat),
//       inningRuns:{[inning]:{f,a,g}} (runs for/against + games sampled,
//       innings 1–9), runsScored:{[bucket]:'W-L'},
//       runsAllowedByInning:{[inning]:'W-L'}, comeback,
//       ranks:{[family]:{r,of,t?} | {[sub]:{r,of,t?}}} — the club's league
//       rank at its OWN level for each W-L family above, kept only where a
//       note would actually print it (top/bottom 3 of a field of 8+); see
//       callout-notes/rank.js}, home:{…} } }
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
