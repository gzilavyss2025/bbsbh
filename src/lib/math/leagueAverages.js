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

export function leagueAveragesOf({ hitting, pitching } = {}) {
  const atBats = sum(hitting, 'atBats')
  const outs = (pitching ?? []).reduce((n, s) => n + ipToOuts(s.stat?.inningsPitched), 0)
  const earned = sum(pitching, 'earnedRuns')
  const recorded = earned >= 0.7 * sum(pitching, 'runs')
  const pa = sum(hitting, 'plateAppearances')
  const [so, bb, tb, hr] = ['strikeOuts', 'baseOnBalls', 'totalBases', 'homeRuns'].map((k) => sum(hitting, k))
  const hits = sum(hitting, 'hits')
  const counted = (hitting ?? []).filter((s) => s.stat?.numberOfPitches >= 3 * s.stat?.plateAppearances)
  // Opponent OPS from the pitching splits of the clubs that carry total bases (1913, 1959, 1972 have a few stray ones).
  const whole = (pitching ?? []).filter((s) => s.stat?.totalBases >= s.stat?.hits)
  const [pAb, pH, pBb, pHbp, pSf, pTb] = ['atBats', 'hits', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'totalBases'].map((k) => sum(whole, k))
  const obpDen = pAb + pBb + pHbp + pSf
  return {
    avg: atBats ? round(hits / atBats, 3) : null,
    era: outs && earned && recorded ? round((27 * earned) / outs, 2) : null,
    k: ratio(so, pa, 3),
    bb: ratio(bb, pa, 3),
    kbb: so > 0 && bb > 0 && pa ? round((so - bb) / pa, 3) : null, // can be negative: bb above so (1950)
    bbk: ratio(bb, so, 2),
    iso: ratio(tb - hits, atBats, 3), // total bases missing makes tb - hits negative: null
    babip: so > 0 ? ratio(hits - hr, atBats - so - hr + sum(hitting, 'sacFlies'), 3) : null,
    // Pitch counts reached part of the clubs for a few seasons, and 1950 has a stray 1, 1975-79 count
    // about 1.5 a PA: divide by the PA of the clubs whose count is real (a club never averages under 3 a PA).
    ppa: ratio(sum(counted, 'numberOfPitches'), sum(counted, 'plateAppearances'), 2),
    ops: pTb > 0 && obpDen > 0 && pAb > 0 ? round((pH + pBb + pHbp) / obpDen + pTb / pAb, 3) : null,
  }
}

// A league rate as printed: AVG ".248", ERA "4.17".
export const rateText = (n, group) => (group === 'pitching' ? n.toFixed(2) : n.toFixed(3).slice(1))
