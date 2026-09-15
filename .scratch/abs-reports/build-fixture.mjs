// Builds test/fixtures/abs-denominators.json — the two response shapes the
// denominator work (#1058, #1062) and the dead-game fix (#1073) have to read
// correctly, captured from real games so the unit suite never touches the
// network.
//
//   node .scratch/abs-reports/build-fixture.mjs
//
// ONE file rather than several, because test/fixtures/ holds 8 entries against
// check-dir-size's cap of 12 (ADR-0038). Two keys inside it:
//
// `linescores` — six real games covering every shape the final-inning
// extraction must handle. The trap this exists for: a Final game whose home
// club did not need to bat carries NO `runs` key on the last inning's `home`
// object, which is the only way to tell a skipped bottom half from a played
// one. `isTopInning` agrees but is a state flag, not a record of what happened.
//
// `roster` — one club's fullSeason roster hydrate, trimmed to the stat paths
// the exposure sweep reads. The trap: a TRADED player returns one split per
// club PLUS an aggregate whose `team` is undefined, so a sweep that takes
// `splits[0]` attributes his whole season to one club. Match on `split.team.id`.
import { writeFileSync } from 'node:fs'

const LINESCORES = [
  { pk: 824872, why: 'home club did not bat in the 9th — last inning home object has no runs key' },
  { pk: 823413, why: 'regulation, bottom of the 9th played out' },
  { pk: 814842, why: 'Cancelled: Rain — abstractGameState Final, zero innings, zero challenges (#1073)' },
  { pk: 815811, why: 'Suspended: Rain — abstractGameState Live, swept anyway, permanently incomplete (#1073)' },
]

async function feed(pk) {
  const r = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)
  if (!r.ok) throw new Error(`${pk}: ${r.status}`)
  return r.json()
}

const linescores = []
for (const { pk, why } of LINESCORES) {
  const f = await feed(pk)
  const ls = f?.liveData?.linescore ?? {}
  linescores.push({
    gamePk: pk,
    why,
    status: {
      abstractGameState: f?.gameData?.status?.abstractGameState ?? null,
      detailedState: f?.gameData?.status?.detailedState ?? null,
    },
    linescore: {
      currentInning: ls.currentInning ?? null,
      scheduledInnings: ls.scheduledInnings ?? null,
      isTopInning: ls.isTopInning ?? null,
      // Only the last two innings are kept: the extraction reads the final one,
      // and the one before it proves a full inning's shape for contrast.
      innings: (ls.innings ?? []).slice(-2).map((i) => ({
        num: i.num,
        away: i.away ? { runs: i.away.runs ?? null } : null,
        // Deliberately NOT defaulted: the absence of `runs` is the signal.
        home: i.home ? (Object.prototype.hasOwnProperty.call(i.home, 'runs') ? { runs: i.home.runs } : {}) : null,
      })),
      inningCount: (ls.innings ?? []).length,
    },
  })
}

// Any club with a mid-season acquisition works; 114 (Cleveland) carried three
// catchers this season, one of them traded in, which is the shape that matters.
const TEAM = 114
const rosterUrl =
  `https://statsapi.mlb.com/api/v1/teams/${TEAM}/roster?rosterType=fullSeason&season=2026` +
  `&hydrate=person(stats(type=season,group=[hitting,fielding],season=2026,sportId=1))`
const rr = await (await fetch(rosterUrl)).json()

const roster = {
  teamId: TEAM,
  url: rosterUrl,
  why: 'fullSeason hydrate; a traded player carries one split per club plus an aggregate with no team',
  players: (rr.roster ?? [])
    .map((p) => {
      const groups = p.person?.stats ?? []
      const pick = (name) =>
        (groups.find((g) => g.group?.displayName === name)?.splits ?? []).map((s) => ({
          teamId: s.team?.id ?? null,
          position: s.position?.abbreviation ?? null,
          numberOfPitches: s.stat?.numberOfPitches ?? null,
          plateAppearances: s.stat?.plateAppearances ?? null,
          innings: s.stat?.innings ?? null,
          gamesStarted: s.stat?.gamesStarted ?? null,
        }))
      return {
        id: p.person?.id,
        name: p.person?.fullName,
        position: p.position?.abbreviation ?? null,
        hitting: pick('hitting'),
        fielding: pick('fielding'),
      }
    })
    // Keep the file small: every catcher, plus anyone whose splits span more
    // than one club (the traded case), plus two ordinary hitters for contrast.
    .filter((p, i, all) => {
      const traded = new Set(p.hitting.map((s) => s.teamId).filter(Boolean)).size > 1
      const catcher = p.fielding.some((s) => s.position === 'C')
      return traded || catcher || (p.hitting.length > 0 && i < 2)
    }),
}

const out = {
  note: 'Captured by .scratch/abs-reports/build-fixture.mjs. Re-run to refresh.',
  capturedAt: new Date().toISOString().slice(0, 10),
  linescores,
  roster,
}
writeFileSync('test/fixtures/abs-denominators.json', JSON.stringify(out, null, 2) + '\n')
console.log(
  `wrote test/fixtures/abs-denominators.json — ${linescores.length} linescores, ${roster.players.length} players`,
)
for (const l of linescores) {
  const last = l.linescore.innings[l.linescore.innings.length - 1]
  const bottomPlayed = last && last.home && Object.prototype.hasOwnProperty.call(last.home, 'runs')
  console.log(
    `  ${l.gamePk} ${String(l.status.detailedState).padEnd(18)} inning=${l.linescore.currentInning} bottomPlayed=${bottomPlayed}`,
  )
}
