// Pulls the three Rays-Brewers regular-season meetings (Milwaukee, 2026-03-30 to
// 04-01) from the public MLB feed, for the Film room wireframe only. Not product code.
import { writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'
const PKS = [823809, 823807, 823806]
const out = []
for (const pk of PKS) {
  const f = await getJson(`/api/v1.1/game/${pk}/feed/live`)
  const gd = f.gameData, ld = f.liveData, box = ld.boxscore
  const side = (s) => {
    const t = box.teams[s]
    const sp = t.pitchers[0]
    const p = t.players[`ID${sp}`]
    const st = p.stats.pitching
    const mix = {}
    for (const play of ld.plays.allPlays) for (const ev of play.playEvents) {
      if (ev.isPitch && play.matchup.pitcher.id === sp && ev.details?.type?.code) mix[ev.details.type.code] = (mix[ev.details.type.code] ?? 0) + 1
    }
    return {
      id: gd.teams[s].id, abbr: gd.teams[s].abbreviation, runs: ld.linescore.teams[s].runs,
      hits: ld.linescore.teams[s].hits, errors: ld.linescore.teams[s].errors,
      starter: { id: sp, name: p.person.fullName, hand: gd.players[`ID${sp}`].pitchHand.code, ip: st.inningsPitched, h: st.hits, r: st.runs, er: st.earnedRuns, bb: st.baseOnBalls, k: st.strikeOuts, pitches: st.numberOfPitches, mix },
      lineup: t.battingOrder.map((id) => { const pl = t.players[`ID${id}`]; return { id, name: gd.players[`ID${id}`].boxscoreName, pos: pl.position.abbreviation } }),
    }
  }
  const ump = box.officials.find((o) => o.officialType === 'Home Plate')?.official.fullName ?? ''
  const scoring = ld.plays.scoringPlays.map((i) => { const p = ld.plays.allPlays[i]; return { inning: `${p.about.isTopInning ? 'T' : 'B'}${p.about.inning}`, text: p.result.description } })
  const innings = ld.linescore.innings.map((i) => [i.away.runs ?? 0, i.home.runs ?? 0])
  out.push({ gamePk: pk, date: gd.datetime.officialDate, venue: gd.venue.name, ump, away: side('away'), home: side('home'), innings, scoring, decisions: { w: ld.decisions?.winner?.fullName, l: ld.decisions?.loser?.fullName, s: ld.decisions?.save?.fullName } })
}
writeFileSync(new URL('./meetings.json', import.meta.url), JSON.stringify(out, null, 1))
for (const g of out) console.log(g.date, g.away.abbr, g.away.runs, '-', g.home.runs, g.home.abbr, '|', g.away.starter.name, g.away.starter.mix, '|', g.home.starter.name, g.home.starter.mix, '| HP', g.ump, '|', g.scoring.length, 'scoring plays')
