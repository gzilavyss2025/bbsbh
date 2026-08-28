// Throwaway probe: does a Triple-A feed carry ABS challenges in the shape
// challenges.js parses, and what are its sport ids + challenge-remaining rules?
import { selectChallengeState } from '../../src/api/challenges.js'

const PKS = process.argv.slice(2).map(Number)
for (const pk of PKS) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)
  const feed = await res.json()
  const gd = feed.gameData
  console.log('='.repeat(70))
  console.log(pk, gd.game?.type, gd.datetime?.officialDate)
  console.log('  away sport', JSON.stringify(gd.teams?.away?.sport), 'home sport', JSON.stringify(gd.teams?.home?.sport))
  console.log('  away', gd.teams?.away?.id, gd.teams?.away?.name, '| home', gd.teams?.home?.id, gd.teams?.home?.name)
  const st = selectChallengeState(feed, Infinity, 'bottom')
  for (const side of ['away', 'home']) {
    const o = st[side].outcomes
    console.log(`  ${side} (${st[side].teamId}): ${o.length} challenges,`,
      o.map((c) => `${c.half[0]}${c.inning} ${c.playerName} ${c.outcome}${c.isHeuristic ? '*' : ''}`).join(' | '))
    console.log(`    fails=${o.filter((c) => c.outcome === 'fail').length}`)
  }
  // raw review types present anywhere
  const types = new Map()
  for (const p of feed.liveData?.plays?.allPlays ?? []) {
    const rs = [p.reviewDetails, ...(p.playEvents ?? []).map((e) => e.reviewDetails)].filter(Boolean)
    for (const r of rs) types.set(r.reviewType, (types.get(r.reviewType) ?? 0) + 1)
  }
  console.log('  reviewType counts:', JSON.stringify([...types]))
  // boxscore info notes mentioning challenge
  const notes = []
  for (const k of ['info', 'gameNotes']) {
    for (const n of feed.liveData?.boxscore?.[k] ?? []) {
      if (/challenge/i.test(`${n.label} ${n.value}`)) notes.push(`${n.label}: ${n.value}`)
    }
  }
  for (const side of ['away', 'home']) {
    for (const n of feed.liveData?.boxscore?.teams?.[side]?.info ?? []) {
      for (const f of n.fieldList ?? []) {
        if (/challenge/i.test(`${f.label} ${f.value}`)) notes.push(`${side} ${f.label}: ${f.value}`)
      }
    }
  }
  console.log('  challenge notes:', notes.length ? notes : '(none)')
}
