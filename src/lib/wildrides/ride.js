// WILD RIDES: one game's ride, built from its /winProbability feed. Pure, shared by
// scripts/gen-wild-rides.mjs (which keeps only a summary of each game) and the page
// (which builds the full ride for the one game picked, client-direct like all game data).
//
// A season page, not a scoring surface: finals open plainly (root CLAUDE.md, the spoiler rule).

// Every key the ride reads off a win-probability entry. statsapi's `fields=` filter
// matches key names at any depth, so a nested read needs each name on its path listed.
export const RIDE_FIELDS = [
  'homeTeamWinProbability', 'about', 'inning', 'isTopInning', 'count', 'outs',
  'matchup', 'batter', 'pitcher', 'id', 'fullName', 'postOnFirst', 'postOnSecond', 'postOnThird',
  'result', 'event', 'eventType', 'description', 'awayScore', 'homeScore',
  'playEvents', 'hitData', 'coordinates', 'coordX', 'coordY', 'launchAngle', 'trajectory',
]

export const BEATS = 6

const lastName = (n) => (n ?? '').split(' ').filter((w) => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)).slice(-1)[0] ?? ''
const VERB = {
  home_run: 'homers', single: 'singles', double: 'doubles', triple: 'triples', walk: 'walks',
  intent_walk: 'is walked', hit_by_pitch: 'is hit by a pitch', sac_fly: 'hits a sac fly',
  field_error: 'reaches on an error', grounded_into_double_play: 'grounds into a double play',
  double_play: 'hits into a double play', field_out: 'is out', force_out: 'is forced out',
  fielders_choice: 'reaches on a fielder’s choice', fielders_choice_out: 'is out on a fielder’s choice',
  sac_bunt: 'bunts them over', wild_pitch: 'scores on a wild pitch',
}
const BASES = ['1st', '2nd', '3rd']
function situation(outs, on) {
  const r = BASES.filter((_, i) => on[i])
  const men = r.length === 0 ? 'bases empty' : r.length === 3 ? 'bases loaded' : `${r.length === 1 ? 'runner' : 'runners'} on ${r.join(' & ')}`
  return `${outs} out, ${men}`
}

// The game after a play, packed in one integer:
// inning*2^16 + top*2^15 + outs*2^13 + bases*2^10 + away*2^5 + home. Bases: 1st=1, 2nd=2, 3rd=4.
// A score is capped at 31 runs a side (a 5-bit field); no MLB game has gone past 30.
export function encodeState({ inning, top, outs, bases, away, home }) {
  return inning * 65536 + (top ? 32768 : 0) + Math.min(3, outs) * 8192 + bases * 1024 + Math.min(31, away) * 32 + Math.min(31, home)
}
// Before the first play (v undefined): 0–0, top of the 1st.
export function decodeState(v) {
  if (v == null) return { inning: 1, top: true, outs: 0, bases: { first: false, second: false, third: false }, away: 0, home: 0 }
  const b = (v >> 10) & 7
  return {
    inning: Math.floor(v / 65536),
    top: !!(v & 32768),
    outs: (v >> 13) & 3,
    bases: { first: !!(b & 1), second: !!(b & 2), third: !!(b & 4) },
    away: (v >> 5) & 31,
    home: v & 31,
  }
}

// `meta`: { gamePk, date, venue, away, home, score: [away, home], homeWon }.
// Null when the feed has too few plays to be a game (a suspended or empty feed).
export function buildRide(feed, meta) {
  const plays = (Array.isArray(feed) ? feed : []).filter((e) => typeof e?.homeTeamWinProbability === 'number')
  if (plays.length < 2) return null
  let prev = 50
  const steps = plays.map((e, i) => {
    const home = e.homeTeamWinProbability
    const s = { i, e, home, from: prev, delta: home - prev }
    prev = home
    return s
  })
  const { homeWon } = meta
  const line = [50, ...steps.map((s) => Math.round(s.home))]
  const swing = Math.round(steps.reduce((t, s) => t + Math.abs(s.delta), 0))
  const top = [...steps].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, BEATS)
  const decider = top[0]?.i
  const lastI = steps.length - 1
  const beats = top
    .sort((a, b) => a.i - b.i)
    .map(({ i, e, from, home }) => {
      const m = e.matchup ?? {}
      const hit = (e.playEvents ?? []).filter((p) => p.hitData?.coordinates?.coordX != null).at(-1)?.hitData
      const isTop = !!e.about?.isTopInning
      const p = plays[i - 1]
      const sameHalf = p && p.about?.inning === e.about?.inning && p.about?.isTopInning === isTop
      const pm = sameHalf ? (p.matchup ?? {}) : {}
      const type = e.result?.eventType ?? ''
      return {
        idx: i + 1, // this play's point in `line` (line[0] is first pitch, even)
        title:
          type === 'strikeout'
            ? `${lastName(m.pitcher?.fullName)} strikes out ${lastName(m.batter?.fullName)}`
            : `${lastName(m.batter?.fullName)} ${VERB[type] ?? (e.result?.event ?? '').toLowerCase()}`,
        situation: situation(sameHalf ? (p.count?.outs ?? 0) : 0, [pm.postOnFirst, pm.postOnSecond, pm.postOnThird]),
        walkoff: i === lastI && !isTop && homeWon,
        inning: e.about?.inning ?? 1,
        top: isTop,
        batter: { id: m.batter?.id, name: m.batter?.fullName ?? '' },
        pitcher: { id: m.pitcher?.id, name: m.pitcher?.fullName ?? '' },
        event: e.result?.event ?? '',
        type,
        desc: e.result?.description ?? '',
        score: [e.result?.awayScore ?? 0, e.result?.homeScore ?? 0],
        spray: hit ? [hit.coordinates.coordX, hit.coordinates.coordY] : null,
        launchAngle: hit?.launchAngle ?? null,
        trajectory: hit?.trajectory ?? null,
        // the batting team's win chance, before and after
        from: Math.round(isTop ? 100 - from : from),
        to: Math.round(isTop ? 100 - home : home),
        decider: i === decider,
      }
    })
  const states = steps.map(({ e }) => {
    const m = e.matchup ?? {}
    return encodeState({
      inning: e.about?.inning ?? 1,
      top: !!e.about?.isTopInning,
      outs: e.count?.outs ?? 0,
      bases: (m.postOnFirst ? 1 : 0) | (m.postOnSecond ? 2 : 0) | (m.postOnThird ? 4 : 0),
      away: e.result?.awayScore ?? 0,
      home: e.result?.homeScore ?? 0,
    })
  })
  // Every play that changed the score: [inning, top ? 1 : 0, away, home].
  const scoring = []
  let pa = 0
  let ph = 0
  for (const { e } of steps) {
    const a = e.result?.awayScore ?? pa
    const h = e.result?.homeScore ?? ph
    if (a !== pa || h !== ph) scoring.push([e.about?.inning ?? 1, e.about?.isTopInning ? 1 : 0, a, h])
    pa = a
    ph = h
  }
  const winnerLine = line.map((h) => (homeWon ? h : 100 - h))
  return {
    ...meta,
    innings: plays.at(-1)?.about?.inning ?? 9,
    swing,
    low: Math.min(...winnerLine.slice(1, -1)),
    line,
    states,
    scoring,
    beats,
  }
}
