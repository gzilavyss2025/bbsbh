// How a player joined his organization, and his draft pedigree. Pure: the
// generator (scripts/trade/gen-trade-pedigree.mjs) runs it over statsapi's
// /people?hydrate=draft,transactions, and the trade card reads its output.

// Transaction codes that bring a player into a club from somewhere else.
const INTO = {
  TR: 'trade',
  CLW: 'waivers',
  R5: 'rule5',
  R5M: 'rule5',
  PUR: 'purchase',
  SFA: 'fa',
}

const ageOn = (birthDate, date) => {
  if (!birthDate || !date) return null
  const b = new Date(birthDate), d = new Date(date)
  let a = d.getUTCFullYear() - b.getUTCFullYear()
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) a -= 1
  return a
}

// The pick that counts: the most recent draft he was taken in.
export function draftOf(person) {
  const d = [...(person?.drafts ?? [])].sort((a, b) => Number(b.year) - Number(a.year))[0]
  if (!d) return null
  return {
    year: Number(d.year),
    round: d.pickRound ?? null,
    pick: d.pickNumber ?? null,
    teamId: d.team?.id ?? null,
  }
}

// { kind, date, fromId } for the latest event that brought him into `orgId`
// from outside it. kind: 'draft' | 'trade' | 'intl' | 'fa' | 'waivers' |
// 'rule5' | 'purchase' | 'signed'. An international amateur is an SFA signing
// at 18 or younger by a player born outside the US; any other SFA is 'fa'.
export function acquisitionOf(person, orgId, { orgOf = new Map() } = {}) {
  const inOrg = (teamId) => teamId != null && (orgOf.get(teamId) ?? teamId) === orgId
  const events = []
  for (const t of person?.transactions ?? []) {
    const kind = INTO[t.typeCode]
    if (!kind || !inOrg(t.toTeam?.id) || inOrg(t.fromTeam?.id)) continue
    const young = (ageOn(person.birthDate, t.date) ?? 99) <= 18
    const intl = kind === 'fa' && young && person.birthCountry && person.birthCountry !== 'USA'
    events.push({ kind: intl ? 'intl' : kind, date: t.date, fromId: t.fromTeam?.id ?? null })
  }
  for (const d of person?.drafts ?? []) {
    if (inOrg(d.team?.id)) events.push({ kind: 'draft', date: `${d.year}-07-01`, fromId: null })
  }
  if (!events.length) {
    // A signing with no other trail: a drafted player's own signing, or a re-sign.
    const sgn = (person?.transactions ?? []).find((t) => t.typeCode === 'SGN' && inOrg(t.toTeam?.id))
    return sgn ? { kind: 'signed', date: sgn.date, fromId: null } : null
  }
  events.sort((a, b) => (a.date < b.date ? 1 : -1))
  return events[0]
}

// How the card says it: "Drafted 2021 · Rd 1, No. 15", "Trade from CWS · 2025".
export const HOW_LABEL = {
  draft: 'Drafted',
  trade: 'Trade',
  intl: 'Intl signing',
  fa: 'Free agent',
  waivers: 'Waiver claim',
  rule5: 'Rule 5',
  purchase: 'Purchased',
  signed: 'Signed',
}

const yy = (y) => `'${String(y).slice(-2)}`

// One short line for the card: how he joined, then his draft pick when it is a
// different fact. "Drafted R1 #15 '21", "Trade · CWS '25 · R1 #3 '19",
// "Intl signing '24". `abbr(teamId)` names a club.
export function pedigreeLine(how, draft, abbr = () => null) {
  const pick = draft ? `R${draft.round} #${draft.pick} ${yy(draft.year)}` : null
  if (!how) return pick ? `Drafted ${pick}` : null
  if (how.kind === 'draft') return pick ? `Drafted ${pick}` : `Drafted ${yy(how.date.slice(0, 4))}`
  const from = how.fromId ? abbr(how.fromId) : null
  const head = [HOW_LABEL[how.kind] ?? 'Joined', from].filter(Boolean).join(' · ')
  return [`${head} ${yy(how.date.slice(0, 4))}`, pick].filter(Boolean).join(' · ')
}
