// The Awards module's pure view (#2018): the ledger, ranked, cut to the cap, with the words drawn
// from counts. awards.js shapes the ledger (awardsView); this only ranks, cuts and labels.
import { rankAwards } from '../../../../../api/person/awards.js'

// awards.js's tier keys (TIER_BY_KEY) in the design's words. An unknown key reads Other.
const TIER_WORD = {
  yearEnd: 'Year-end',
  allStar: 'All-Star',
  inSeason: 'In-season',
  press: 'Press',
  intl: 'International',
  minors: 'Minors',
}
export const tierWord = (tier) => TIER_WORD[tier] ?? 'Other'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// `order` is the parsed site order (parseAwardOrder), `cap` how many awards get a table.
// No category gives null, so the module reports empty.
export function awardsModView(ledger, { order, cap }) {
  if (!ledger?.categories?.length) return null
  const ranked = rankAwards(ledger.categories, order).map((c) => ({
    key: c.key,
    label: c.label,
    count: c.count,
    tier: c.tier,
    tierWord: tierWord(c.tier),
    whens: c.rows.map((r) => r.when).join(', '),
    rows: c.rows.map((r, i) => ({ key: `${r.date}-${i}`, when: r.when, teamId: r.teamId, teamName: r.teamName, orgId: r.orgId })),
  }))
  const tabled = ranked.slice(0, cap)
  const rest = ranked.slice(cap)
  const restSelections = rest.reduce((n, c) => n + c.count, 0)
  return {
    tag: `${tabled.length} of ${ledger.totals.categories} · ${plural(ledger.totals.selections, 'selection', 'selections')}`,
    tabled,
    rest,
    restSelections,
    doorOpen: rest.length ? `Show the other ${plural(rest.length, 'award', 'awards')} — ${plural(restSelections, 'selection', 'selections')}` : '',
  }
}
