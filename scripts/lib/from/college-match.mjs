// MLB's college names -> one IPEDS school (#1526, SPEC §7.1). The API gives a name such as
// "Michigan", "Long Beach State" or "Miami (FL)" and no school id, and a state on 3% of
// records, so the match decides where a college sits on the map.
//
// First hit wins:
//   1. overrides   { apiName: unitid | null } (scripts/data/from/college-overrides.json).
//                  null means "known, not in IPEDS": the college stays off the map.
//   2. flagship    a short name that always means one school (Michigan, LSU, Notre Dame).
//   3. expansions  "UC X", "Cal State X", "X State", "CC", "JC", "St." spelled out.
//   4. exact key   a normalized IPEDS name or alias, when it names ONE school.
//   5. a hint      "(FL)" or "(Ohio)" narrows several hits to one; else the one four-year school.
// A name that none of these settles is unmatched. The nightly run lists those with their
// player counts so the overrides file can grow. The matcher never guesses.
import { STATE_NAMES } from '../../../src/lib/from/states.js'

// Puerto Rico is a country in the lists, but a college there is still a hint (SPEC D6).
const STATE = { ...STATE_NAMES, PR: 'Puerto Rico' }
const STATE_BY_NAME = Object.fromEntries(Object.entries(STATE).map(([k, v]) => [v.toLowerCase(), k]))

// Short names MLB uses for a state's flagship, or for the school a bare name always means in
// baseball. Each value is an exact IPEDS INSTNM (checked against HD2023 by test/from-college-match.test.js).
export const FLAGSHIP = {
  Alabama: 'The University of Alabama', Arizona: 'University of Arizona', Arkansas: 'University of Arkansas',
  California: 'University of California-Berkeley', Colorado: 'University of Colorado Boulder', Connecticut: 'University of Connecticut',
  Delaware: 'University of Delaware', Florida: 'University of Florida', Georgia: 'University of Georgia',
  Hawaii: 'University of Hawaii at Manoa', Idaho: 'University of Idaho', Illinois: 'University of Illinois Urbana-Champaign',
  Indiana: 'Indiana University-Bloomington', Iowa: 'University of Iowa', Kansas: 'University of Kansas',
  Kentucky: 'University of Kentucky', Maine: 'University of Maine', Maryland: 'University of Maryland-College Park',
  Massachusetts: 'University of Massachusetts-Amherst', Michigan: 'University of Michigan-Ann Arbor', Minnesota: 'University of Minnesota-Twin Cities',
  Mississippi: 'University of Mississippi', Missouri: 'University of Missouri-Columbia', Montana: 'The University of Montana',
  Nebraska: 'University of Nebraska-Lincoln', Nevada: 'University of Nevada-Reno', 'New Mexico': 'University of New Mexico-Main Campus',
  'North Carolina': 'University of North Carolina at Chapel Hill', Ohio: 'Ohio University-Main Campus', Oklahoma: 'University of Oklahoma-Norman Campus',
  Oregon: 'University of Oregon', Pittsburgh: 'University of Pittsburgh-Pittsburgh Campus', 'Rhode Island': 'University of Rhode Island',
  'South Carolina': 'University of South Carolina-Columbia', Tennessee: 'The University of Tennessee-Knoxville', Texas: 'The University of Texas at Austin',
  Utah: 'University of Utah', Vermont: 'University of Vermont', Virginia: 'University of Virginia-Main Campus',
  Washington: 'University of Washington-Seattle Campus', 'West Virginia': 'West Virginia University', Wisconsin: 'University of Wisconsin-Madison',
  Wyoming: 'University of Wyoming',
  'Southern California': 'University of Southern California', UCLA: 'University of California-Los Angeles',
  'Louisiana State': 'Louisiana State University and Agricultural & Mechanical College',
  LSU: 'Louisiana State University and Agricultural & Mechanical College', 'Notre Dame': 'University of Notre Dame', 'Holy Cross': 'College of the Holy Cross',
  'Boston College': 'Boston College', Georgetown: 'Georgetown University', Northwestern: 'Northwestern University',
  Rutgers: 'Rutgers University-New Brunswick', 'San Francisco': 'University of San Francisco', 'Central Florida': 'University of Central Florida',
  'Miami (FL)': 'University of Miami', 'Miami (OH)': 'Miami University-Oxford', 'Washington State': 'Washington State University',
  'North Carolina State': 'North Carolina State University at Raleigh', 'Penn State': 'Pennsylvania State University-Main Campus', 'Ohio State': 'Ohio State University-Main Campus',
  'Long Beach State': 'California State University-Long Beach', 'Fresno State': 'California State University-Fresno', 'Cal State Fullerton': 'California State University-Fullerton',
  'Cal Poly San Luis Obispo': 'California Polytechnic State University-San Luis Obispo', "St. John's (NY)": "St. John's University-New York", "St. Mary's (CA)": "Saint Mary's College of California",
  'Arizona State': 'Arizona State University Campus Immersion', 'Kent State': 'Kent State University at Kent', 'Southern Illinois': 'Southern Illinois University-Carbondale',
  'Texas A&M': 'Texas A & M University-College Station', 'Georgia Tech': 'Georgia Institute of Technology-Main Campus', 'Virginia Tech': 'Virginia Polytechnic Institute and State University',
}

const STOP = new Set(['the', 'university', 'of', 'college', 'at', 'main', 'campus', 'and'])
const words = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
const keyOf = (s) => words(s).filter((w) => !STOP.has(w)).join(' ')

function expansions(name) {
  const out = [name]
  let m
  if ((m = name.match(/^UC (.+)$/))) out.push(`University of California-${m[1]}`)
  if ((m = name.match(/^Cal State (.+)$/))) out.push(`California State University-${m[1]}`)
  if ((m = name.match(/^(.+) State$/))) out.push(`${m[1]} State University`, `${m[1]} State University-Main Campus`)
  if (/ CC$/.test(name)) out.push(name.replace(/ CC$/, ' Community College'), name.replace(/ CC$/, ' College'))
  if (/ JC$/.test(name)) out.push(name.replace(/ JC$/, ' Junior College'), name.replace(/ JC$/, ' College'))
  if (/^St\. /.test(name)) out.push(name.replace(/^St\. /, 'Saint '))
  return out
}

// "Miami (FL)" -> "FL"; "Miami (Ohio)" -> "OH"; no hint -> null.
function hintState(name) {
  const m = name.match(/\(([^)]+)\)\s*$/)
  if (!m) return null
  const h = m[1].trim()
  if (STATE[h.toUpperCase()]) return h.toUpperCase()
  return STATE_BY_NAME[h.toLowerCase()] ?? null
}

// `schools` is unpackSchools() output; `overrides` is { apiName: unitid | null }.
// -> { match(name) -> { unitid | null, rule, candidates? }, school(unitid) }
export function buildCollegeMatcher(schools, overrides = {}) {
  const byId = new Map(schools.map((s) => [s.unitid, s]))
  const byName = new Map(schools.map((s) => [s.name, s.unitid]))
  const byKey = new Map()
  for (const s of schools) {
    for (const n of [s.name, ...s.alias.split(/[|,;]/)]) {
      const k = keyOf(n)
      if (!k) continue
      if (!byKey.has(k)) byKey.set(k, new Set())
      byKey.get(k).add(s.unitid)
    }
  }

  function match(name) {
    if (Object.hasOwn(overrides, name)) return { unitid: overrides[name], rule: 'override' }
    if (Object.hasOwn(FLAGSHIP, name)) {
      const id = byName.get(FLAGSHIP[name])
      if (id) return { unitid: id, rule: 'flagship' }
    }
    const hint = hintState(name)
    const bare = name.replace(/\s*\([^)]*\)\s*$/, '')
    for (const cand of expansions(bare)) {
      const id = byName.get(cand)
      if (id && (!hint || byId.get(id).state === hint)) return { unitid: id, rule: 'expansion' }
    }
    for (const cand of expansions(bare)) {
      const hits = [...(byKey.get(keyOf(cand)) ?? [])].filter((id) => !hint || byId.get(id).state === hint).sort()
      if (hits.length === 1) return { unitid: hits[0], rule: hint ? 'hint' : 'exact' }
      if (hits.length > 1) {
        const four = hits.filter((id) => byId.get(id).level === '1')
        if (four.length === 1) return { unitid: four[0], rule: 'four-year' }
        return { unitid: null, rule: 'ambiguous', candidates: hits.slice(0, 5) }
      }
    }
    return { unitid: null, rule: 'none' }
  }

  return { match, school: (unitid) => byId.get(unitid) ?? null }
}
