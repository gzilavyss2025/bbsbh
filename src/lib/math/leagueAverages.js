// One season's league rates (AVG, ERA and the Advanced card's) from its team splits (teams/stats, sportIds=1).
// Pure: the generator and the browser reader both import it, so there is one copy.
//
// Weighted, never a mean of team averages: AVG = sum(H) / sum(AB), and
// ERA = 9 * sum(ER) / sum(IP) with IP counted in outs (innings come in thirds).
// A figure the feed does not carry is null, never 0. The 1901 pitching splits
// report earnedRuns 0 beside 1,158 IP, and 1911, 1914, 1915 and 1920-1948 carry
// only part of them (1925: 4,789 ER of 18,659 R). In a real season earned runs are
// about 88% of runs, so a total under 70% of runs reads as "not recorded".
import { ipToOuts } from './innings.js'

const sum = (splits, key) => (splits ?? []).reduce((n, s) => n + (Number(s.stat?.[key]) || 0), 0)
const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places
// A ratio, or null when either side is 0: a feed that does not carry a count must not read as a rate.
const ratio = (num, den, places) => (num > 0 && den > 0 ? round(num / den, places) : null)

// A stat some clubs lack is a league figure only from a feed that has it for 90% of the clubs:
// those clubs' own sums, or [] (null). 1910 has strikeouts for 9 of 16 clubs, 1971 total bases for 1 of 24.
const carrying = (splits, has) => {
  const all = splits ?? []
  const some = all.filter((s) => has(s.stat ?? {}))
  return some.length && some.length >= 0.9 * all.length ? some : []
}

export function leagueAveragesOf({ hitting, pitching } = {}) {
  const atBats = sum(hitting, 'atBats')
  const outs = (pitching ?? []).reduce((n, s) => n + ipToOuts(s.stat?.inningsPitched), 0)
  const earned = sum(pitching, 'earnedRuns')
  const recorded = earned >= 0.7 * sum(pitching, 'runs')
  const pa = sum(hitting, 'plateAppearances')
  const [bb, tb] = ['baseOnBalls', 'totalBases'].map((k) => sum(hitting, k))
  const hits = sum(hitting, 'hits')
  // Strikeouts: the NL counted them from 1910, the AL from 1913.
  const k = carrying(hitting, (t) => t.strikeOuts > 0)
  const [so, kPa, kBb, kAb, kH, kHr, kSf] = ['strikeOuts', 'plateAppearances', 'baseOnBalls', 'atBats', 'hits', 'homeRuns', 'sacFlies'].map((key) => sum(k, key))
  // Pitch counts: 1950 has a stray 1, 1975-79 count about 1.5 a PA (a club never averages under 3).
  const counted = carrying(hitting, (t) => t.numberOfPitches >= 3 * t.plateAppearances)
  // Opponent OPS from the pitching splits of the clubs that carry total bases (1913, 1959, 1972 have stray ones).
  const whole = carrying(pitching, (t) => t.totalBases >= t.hits)
  const [pAb, pH, pBb, pHbp, pSf, pTb] = ['atBats', 'hits', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'totalBases'].map((key) => sum(whole, key))
  const obpDen = pAb + pBb + pHbp + pSf
  return {
    avg: atBats ? round(hits / atBats, 3) : null,
    era: outs && earned && recorded ? round((27 * earned) / outs, 2) : null,
    k: ratio(so, kPa, 3),
    bb: ratio(bb, pa, 3),
    kbb: so > 0 && kBb > 0 ? round((so - kBb) / kPa, 3) : null, // can be negative: walks above strikeouts (1950)
    bbk: ratio(kBb, so, 2),
    iso: ratio(tb - hits, atBats, 3), // total bases missing makes tb - hits negative: null
    babip: ratio(kH - kHr, kAb - so - kHr + kSf, 3),
    ppa: ratio(sum(counted, 'numberOfPitches'), sum(counted, 'plateAppearances'), 2),
    ops: pTb > 0 && obpDen > 0 && pAb > 0 ? round((pH + pBb + pHbp) / obpDen + pTb / pAb, 3) : null,
  }
}

// A league rate as printed: AVG ".248", ERA "4.17".
export const rateText = (n, group) => (group === 'pitching' ? n.toFixed(2) : n.toFixed(3).slice(1))
