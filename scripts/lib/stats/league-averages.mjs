// One season's league AVG and ERA from its team splits (teams/stats, sportIds=1).
// Pure: the generator and the browser reader both import it, so there is one copy.
//
// Weighted, never a mean of team averages: AVG = sum(H) / sum(AB), and
// ERA = 9 * sum(ER) / sum(IP) with IP counted in outs (innings come in thirds).
// A figure the feed does not carry is null, never 0. The 1901 pitching splits
// report earnedRuns 0 beside 1,158 IP, and 1911, 1914, 1915 and 1920-1948 carry
// only part of them (1925: 4,789 ER of 18,659 R). In a real season earned runs are
// about 88% of runs, so a total under 70% of runs reads as "not recorded".
import { ipToOuts } from '../../../src/lib/math/innings.js'

const sum = (splits, key) => (splits ?? []).reduce((n, s) => n + (Number(s.stat?.[key]) || 0), 0)
const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places

export function leagueAveragesOf({ hitting, pitching } = {}) {
  const atBats = sum(hitting, 'atBats')
  const outs = (pitching ?? []).reduce((n, s) => n + ipToOuts(s.stat?.inningsPitched), 0)
  const earned = sum(pitching, 'earnedRuns')
  const recorded = earned >= 0.7 * sum(pitching, 'runs')
  return {
    avg: atBats ? round(sum(hitting, 'hits') / atBats, 3) : null,
    era: outs && earned && recorded ? round((27 * earned) / outs, 2) : null,
  }
}
