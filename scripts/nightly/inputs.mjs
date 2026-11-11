#!/usr/bin/env node
// The nightly job's input gates. A step that only prepares for games, or only
// reads finished ones, is skipped when it has nothing to work from, instead of
// rebuilding and restamping the same files all winter.
//
//   upcoming  an MLB game (spring training included) is scheduled in the next
//             UPCOMING_DAYS days: game-prep steps (notes, call-outs, matchups).
//   finals    an MLB game went Final since the last run (the heartbeat's ranAt,
//             minus a day for a late game): game-result steps.
//   finalsAaa an MLB or AAA game did: the three steps that read AAA too
//             (umpires, umpire accuracy, ABS), so an AAA-only day such as the
//             MLB All-Star break runs them without rebuilding MLB-only data.
//
// Gated on the SCHEDULE, never the calendar (the workflow header's lesson: "a
// calendar gate is not self-healing"): the night spring training appears, the
// steps run again with nothing to flip. A schedule read that fails opens its
// gate. A skipped step's datasets go to check-data-freshness.mjs as SKIPPED so
// their unmoved stamps are not read as a dead generator.
//
// Run by .github/workflows/update-nightly-data.yml; writes upcoming=, finals=
// and skipped= to $GITHUB_OUTPUT. By hand: node scripts/nightly/inputs.mjs
import { appendFileSync, readFileSync } from 'node:fs'
import { getJson } from '../lib/statsapi.mjs'

export const UPCOMING_DAYS = 14 // gen-vs-team-splits.mjs reads the next 14 days

// step id -> which gate it waits on, and the public/data datasets it writes (by
// check-data-freshness.mjs's names: a file, or a directory with a trailing /).
export const GATES = {
  'game-notes': { when: 'upcoming', datasets: ['game-notes/'] },
  callouts: { when: 'upcoming', datasets: ['callouts/'] },
  'former-teammates': { when: 'upcoming', datasets: ['former-teammates/'] },
  'career-matchups': { when: 'upcoming', datasets: ['career-matchups.json'] },
  'vs-team-splits': { when: 'upcoming', datasets: ['vs-team-splits/'] },
  umpires: { when: 'finalsAaa', datasets: ['umpires/'] },
  'umpire-accuracy': { when: 'finalsAaa', datasets: ['umpire-accuracy/'] },
  tensest: { when: 'finals', datasets: ['tensest.json', 'tensest-cutoffs.json'] },
  nuggets: { when: 'finals', datasets: ['nuggets/'] },
  'long-at-bats': { when: 'finals', datasets: ['long-at-bats/'] },
  'outfield-outs': { when: 'finals', datasets: ['outfield-outs/'] },
  fouls: { when: 'finals', datasets: ['fouls/'] },
  workload: { when: 'finals', datasets: ['workload.json', 'workload-summary.json'] },
  'run-value': { when: 'finals', datasets: ['run-value.json'] },
  'club-defense-running': { when: 'finals', datasets: ['club-defense-running.json'] },
  'season-score': { when: 'finals', datasets: ['season-score.json'] },
  'team-score': { when: 'finals', datasets: ['team-score.json'] },
  'comeback-wins': { when: 'finals', datasets: ['comeback-wins.json'] },
  'abs-challenges': { when: 'finalsAaa', datasets: ['abs/'] },
  'pitch-arsenal': { when: 'finals', datasets: ['pitch-arsenal/', 'pitch-arsenal-pool/', 'pitch-command/'] },
  'target-command': { when: 'finals', datasets: ['target-command.json'] },
  'glove-target': { when: 'finals', datasets: ['glove-target/'] },
  'command-received': { when: 'finals', datasets: ['command-received.json'] },
  spray: { when: 'finals', datasets: ['spray/'] },
  attendance: { when: 'finals', datasets: ['attendance.json'] },
  gate: { when: 'finals', datasets: ['gate.json'] },
  doubleheaders: { when: 'finals', datasets: ['doubleheaders.json'] },
  'run-differential': { when: 'finals', datasets: ['run-differential.json'] },
  'team-records': { when: 'finals', datasets: ['team-records/'] },
  'postseason-records': { when: 'finals', datasets: ['postseason-records/'] },
}

const games = (sched) => (sched?.dates ?? []).flatMap((d) => d.games ?? [])
const live = (g) => !['C', 'D'].includes(g.status?.codedGameState) // not cancelled, not postponed

// upcoming / recent: the two schedule responses, or null when the read failed.
// runAll: the workflow's run_all dispatch input. A hand run picking up a new or
// fixed generator must run it even when no game is in either window.
// recent / recentAaa: the MLB and AAA schedules since the last run. Each read
// that failed (null) opens its gate.
export function decideGates({ upcoming, recent, recentAaa, runAll = false }) {
  if (runAll) return { upcoming: true, finals: true, finalsAaa: true }
  const anyFinal = (sched) => sched == null || games(sched).some((g) => live(g) && g.status?.abstractGameCode === 'F')
  const finals = anyFinal(recent)
  return { upcoming: upcoming == null || games(upcoming).some(live), finals, finalsAaa: finals || anyFinal(recentAaa) }
}

export const skippedDatasets = (open) =>
  Object.values(GATES).filter((g) => !open[g.when]).flatMap((g) => g.datasets)

const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

async function readOrNull(path) {
  try {
    return await getJson(path)
  } catch (err) {
    console.log(`schedule read failed (${err.message}); that gate stays open`)
    return null
  }
}

async function main() {
  const now = Date.now()
  let since = iso(now - 2 * 864e5)
  try {
    since = iso(Date.parse(JSON.parse(readFileSync('scripts/data/nightly-heartbeat.json', 'utf8')).ranAt) - 864e5)
  } catch {
    // no heartbeat: look back two days
  }
  const [upcoming, recent, recentAaa] = await Promise.all([
    readOrNull(`/api/v1/schedule?sportId=1&startDate=${iso(now)}&endDate=${iso(now + UPCOMING_DAYS * 864e5)}`),
    readOrNull(`/api/v1/schedule?sportId=1&startDate=${since}&endDate=${iso(now)}`),
    readOrNull(`/api/v1/schedule?sportId=11&startDate=${since}&endDate=${iso(now)}`),
  ])
  const open = decideGates({ upcoming, recent, recentAaa, runAll: process.env.RUN_ALL === 'true' })
  const skipped = skippedDatasets(open)
  console.log(`upcoming=${open.upcoming} finals=${open.finals} finalsAaa=${open.finalsAaa} (Finals since ${since}); skipping ${skipped.length} datasets`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `upcoming=${open.upcoming}\nfinals=${open.finals}\nfinalsAaa=${open.finalsAaa}\nskipped=${skipped.join(',')}\n`)
  }
}

if (import.meta.main) await main()
