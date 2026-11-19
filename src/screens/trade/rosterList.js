import { sortPlayers, lineIsSmall } from '../../lib/trade/deal.js'
import { percentileFromCuts, LEVEL_OF_SPORT } from '../../lib/trade/levelPct.js'

// The trade card's roster list (src/screens/trade/TradePage.jsx): which
// players a club's roster shows (40-man, prospects, everyone), the position
// filter, the name search and every sort, including OPS / ERA within a level.

// Roster position filter. statsapi's 40-man calls every pitcher 'P'.
export const POS_GROUPS = [
  { value: 'all', label: 'All' },
  { value: 'P', label: 'Pitchers' },
  { value: 'C', label: 'Catchers' },
  { value: 'IF', label: 'Infield' },
  { value: 'OF', label: 'Outfield' },
]
// Prospect lists write pitchers as RHP/LHP; the roster writes P.
const GROUP_OF = { P: 'P', SP: 'P', RP: 'P', RHP: 'P', LHP: 'P', TWP: 'P', C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', IF: 'IF', DH: 'IF', LF: 'OF', CF: 'OF', RF: 'OF', OF: 'OF' }
const inGroup = (p, g) => g === 'all' || GROUP_OF[p.pos] === g

// Which players the roster list holds: the 40-man, the club's ranked
// prospects (on the 40-man or not), or the whole organization.
export const SHOW = [
  { value: 'forty', label: '40-man' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'all', label: 'Everyone' },
]
// Sort keys; 'line' reads OPS for hitters and ERA for pitchers.
export const SORT = [
  { value: 'name', label: 'Name' },
  { value: 'war', label: 'WAR' },
  { value: 'line', label: 'OPS / ERA' },
  { value: 'level', label: 'OPS / ERA vs level' },
  { value: 'pay', label: 'Salary' },
  { value: 'control', label: 'Control' },
  { value: 'age', label: 'Age' },
  { value: 'prospect', label: 'Prospect rank' },
]
const isPitcher = (p) => GROUP_OF[p.pos] === 'P'
// Accent- and case-blind, so "pena" finds Peña.
const fold = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() // caps-js-exempt: compares names, renders nothing
// A player's percentile within his own level (Q3, option C): a big-league
// line against MLB, else his line at his highest minor-league level. Below the
// level floor (40 PA, 30 outs) there is no percentile.
export function levelRank(p, farm, cuts) {
  if (!cuts) return null
  const mlb = p.line && (p.line.pa != null ? Number(p.line.pa) >= 40 : parseFloat(p.line.ip) >= 10)
  const pitcher = isPitcher(p)
  if (mlb) {
    const v = Number(pitcher ? p.line.era : p.line.ops)
    const pct = percentileFromCuts(v, cuts.levels?.[1]?.[pitcher ? 'era' : 'ops'], !pitcher)
    return pct == null ? null : { pct, level: 'MLB' }
  }
  const r = farm?.get(p.id)?.ranked
  if (!r || (r.isPitcher ? Number(r.outs) < 30 : Number(r.pa) < 40)) return null
  const pct = percentileFromCuts(Number(r.isPitcher ? r.era : r.ops), cuts.levels?.[r.sport]?.[r.isPitcher ? 'era' : 'ops'], !r.isPitcher)
  return pct == null ? null : { pct, level: LEVEL_OF_SPORT[r.sport] }
}

export function rosterList(data, { show, group, sort, query = '', farm = null, minimum = false, cuts = null }) {
  const prospect = (p) => p.orgRank != null || p.topRank != null
  let list = show === 'forty' ? data.forty
    : show === 'prospects' ? [...data.forty.filter(prospect), ...data.minors]
    : [...data.forty, ...data.minors, ...data.others]
  const q = fold(query.trim())
  list = list.filter((p) => inGroup(p, group) && (!q || fold(p.name).includes(q)))
  if (sort === 'line') {
    // Hitters by OPS, then pitchers by ERA, so neither number is compared with
    // the other. Within each, big-league lines come before minor-league ones:
    // a .900 OPS in Double-A is not a .900 OPS in the majors.
    const milb = (p) => (!p.line && farm?.get(p.id) ? { ...p, line: farm.get(p.id) } : null)
    // With the minimum on, a big-league line under 50 PA / 20 IP sorts after
    // the minor-league lines, as a small sample (still shown).
    const small = (p) => minimum && lineIsSmall(p.line)
    const tiers = (rows, key) => [
      ...sortPlayers(rows.filter((p) => p.line && !small(p)), key),
      ...sortPlayers(rows.map(milb).filter(Boolean), key),
      ...sortPlayers(rows.filter(small), key),
      ...rows.filter((p) => !p.line && !farm?.get(p.id)),
    ].map((p) => list.find((x) => x.id === p.id))
    return [...tiers(list.filter((p) => !isPitcher(p)), 'ops'), ...tiers(list.filter(isPitcher), 'era')]
  }
  if (sort === 'level') {
    // One list, hitters and pitchers together: each ranked only against his own level.
    const ranked = list.map((p) => ({ p, r: levelRank(p, farm, cuts) }))
    return [...ranked.filter((x) => x.r).sort((a, b) => b.r.pct - a.r.pct), ...ranked.filter((x) => !x.r)].map((x) => x.p)
  }
  return sort === 'name' ? list : sortPlayers(list, sort)
}
