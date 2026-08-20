import assert from 'node:assert/strict'
import test from 'node:test'
import { assignRowOwners, groupLeagueWide } from '../src/api/transactions/league.js'

// ---------------------------------------------------------------------------
// The league-wide grouping pass (issue #772, segment 2).
//
// A home feed cannot be a MERGE of the thirty per-club story files: the study
// measured 24 of 193 cross-club duplicates that shared no story key, because
// the two clubs grouped one move differently. This pass instead gives every
// raw row exactly ONE owning club and then runs the same grouper per owner,
// so a row is never grouped twice and there is nothing to de-duplicate.
//
// Every fixture is verbatim from a 60-day league-wide pull on 2026-08-20
// (.scratch/home-transactions/probe-league-grouping.mjs; numbers in
// segment2-numbers.md). Over that window: 12,035 raw rows named one org,
// 3,883 named none, and 293 named two — every one of the 293 a `TR` (253) or a
// `CLW` (40), which is what makes single ownership decidable at all.
// ---------------------------------------------------------------------------

const MARINERS = { id: 136, name: 'Seattle Mariners' }
const WHITE_SOX = { id: 145, name: 'Chicago White Sox' }
const CUBS = { id: 112, name: 'Chicago Cubs' }
const BLUE_JAYS = { id: 141, name: 'Toronto Blue Jays' }
const BREWERS = { id: 158, name: 'Milwaukee Brewers' }
const ATHLETICS = { id: 133, name: 'Athletics' }
const PHILLIES = { id: 143, name: 'Philadelphia Phillies' }
const BRAVES = { id: 144, name: 'Atlanta Braves' }
const LEHIGH_VALLEY = { id: 1410, name: 'Lehigh Valley IronPigs' }
const GWINNETT = { id: 431, name: 'Gwinnett Stripers' }
const FIREBIRDS = { id: 6102, name: 'Orleans Firebirds' }

// The three MLB clubs and the two affiliates these fixtures touch. The real
// pass takes the full thirty and the full 291-affiliate parent map, both of
// which the generator already fetches.
const MLB_TEAM_IDS = [112, 133, 136, 141, 143, 144, 145, 158]
const AFFIL_TO_ORG = new Map([[1410, 143], [431, 144]])
const ctx = { mlbTeamIds: MLB_TEAM_IDS, affilToOrg: AFFIL_TO_ORG, positions: {} }

// 2026-08-02, verbatim: five rows for one deal, all carrying the one sentence,
// one of them naming nobody. The wire writes "{sender} traded X to
// {recipient}", so the White Sox are the acquiring club — even though Seattle
// took three players back and a headcount would have crowned Seattle.
const CASTILLO_TRADE = [
  {
    id: 934000, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 622491, fullName: 'Luis Castillo' }, fromTeam: MARINERS, toTeam: WHITE_SOX,
    description: 'Seattle Mariners traded RHP Luis Castillo to Chicago White Sox for RHP Seranthony Domínguez, C Boston Smith, RF Nolan Jones and cash.',
  },
  {
    id: 934000, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    fromTeam: WHITE_SOX, toTeam: MARINERS,
    description: 'Seattle Mariners traded RHP Luis Castillo to Chicago White Sox for RHP Seranthony Domínguez, C Boston Smith, RF Nolan Jones and cash.',
  },
  {
    id: 934000, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 622554, fullName: 'Seranthony Domínguez' }, fromTeam: WHITE_SOX, toTeam: MARINERS,
    description: 'Seattle Mariners traded RHP Luis Castillo to Chicago White Sox for RHP Seranthony Domínguez, C Boston Smith, RF Nolan Jones and cash.',
  },
  {
    id: 934000, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 666134, fullName: 'Nolan Jones' }, fromTeam: WHITE_SOX, toTeam: MARINERS,
    description: 'Seattle Mariners traded RHP Luis Castillo to Chicago White Sox for RHP Seranthony Domínguez, C Boston Smith, RF Nolan Jones and cash.',
  },
  {
    id: 934000, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 695722, fullName: 'Boston Smith' }, fromTeam: WHITE_SOX, toTeam: MARINERS,
    description: 'Seattle Mariners traded RHP Luis Castillo to Chicago White Sox for RHP Seranthony Domínguez, C Boston Smith, RF Nolan Jones and cash.',
  },
]

// 2026-08-11, verbatim: the ONE row the wire logs for a waiver claim.
const ROM_CLAIM = {
  id: 937021, typeCode: 'CLW', date: '2026-08-11', effectiveDate: '2026-08-11',
  person: { id: 680723, fullName: 'Drew Rom' }, fromTeam: BREWERS, toTeam: ATHLETICS,
  description: 'Athletics claimed LHP Drew Rom off waivers from Milwaukee Brewers.',
}

// 2026-08-02, verbatim: the Cubs and the Blue Jays made TWO trades on one day,
// so the two sentences lead with different clubs and neither side is "the"
// acquiring club. The existing grouper keys a trade on date + club pair, so
// both deals already read as one story — this pass only decides whose story.
const CUBS_JAYS_DOUBLE = [
  {
    id: 934123, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 592791, fullName: 'Jameson Taillon' }, fromTeam: CUBS, toTeam: BLUE_JAYS,
    description: 'Chicago Cubs traded RHP Jameson Taillon and cash to Toronto Blue Jays for Player To Be Named Later.',
  },
  {
    id: 934197, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 703520, fullName: 'Brett Bateman' }, fromTeam: CUBS, toTeam: BLUE_JAYS,
    description: 'Toronto Blue Jays traded RHP Kevin Gausman to Chicago Cubs for CF Brett Bateman and SS Ty Southisene.',
  },
  {
    id: 934197, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 807257, fullName: 'Ty Southisene' }, fromTeam: CUBS, toTeam: BLUE_JAYS,
    description: 'Toronto Blue Jays traded RHP Kevin Gausman to Chicago Cubs for CF Brett Bateman and SS Ty Southisene.',
  },
  {
    id: 934197, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 592332, fullName: 'Kevin Gausman' }, fromTeam: BLUE_JAYS, toTeam: CUBS,
    description: 'Toronto Blue Jays traded RHP Kevin Gausman to Chicago Cubs for CF Brett Bateman and SS Ty Southisene.',
  },
]

// 2026-08-05, verbatim: a free-agency election logged against the Triple-A
// club, never the major-league parent. `DFA` is exempt from the direct-touch
// gate for exactly this reason, and that exemption is only safe because the
// caller resolved an org first.
const TRIVINO_ELECTION = {
  id: 935748, typeCode: 'DFA', date: '2026-08-05', effectiveDate: '2026-08-05',
  person: { id: 642152, fullName: 'Lou Trivino III' }, toTeam: LEHIGH_VALLEY,
  description: 'RHP Lou Trivino III elected free agency.',
}

// 2026-06-22, verbatim: a release filed entirely at a Triple-A club. It
// resolves to an org, so the pass sees it — and the direct-touch gate must
// still drop it, because no major-league roster changed.
const AFFILIATE_RELEASE = {
  id: 921110, typeCode: 'REL', date: '2026-06-22', effectiveDate: '2026-06-22',
  person: { id: 663536, fullName: 'Tristin English' }, toTeam: GWINNETT,
  description: 'Gwinnett Stripers released OF Tristin English.',
}

// 2026-06-21, verbatim: a summer-collegiate row. Most of the wire looks like
// this — 3,883 of 16,211 rows in the window name no major-league org at all.
const NO_ORG_ROW = {
  id: 920852, typeCode: 'SC', date: '2026-06-21', effectiveDate: '2026-06-21',
  person: { id: 834576, fullName: 'LJ Cormier' }, toTeam: FIREBIRDS,
  description: 'Orleans Firebirds activated RHP LJ Cormier.',
}

const textOf = (story) => story.cutline.map((s) => s.text).join('')
const ownerIds = (rows) => rows.map((t) => assignRowOwners(rows, ctx).get(t) ?? null)

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

test('a row naming one club belongs to that club; a row naming none belongs to nobody', () => {
  const owners = assignRowOwners([TRIVINO_ELECTION, AFFILIATE_RELEASE, NO_ORG_ROW], ctx)
  assert.equal(owners.get(TRIVINO_ELECTION), 143)
  assert.equal(owners.get(AFFILIATE_RELEASE), 144)
  assert.equal(owners.has(NO_ORG_ROW), false)
})

test('a waiver claim belongs to the CLAIMING club, so the wire\'s own sentence is already right', () => {
  assert.equal(assignRowOwners([ROM_CLAIM], ctx).get(ROM_CLAIM), 133)
})

test('a trade belongs to the club the wire\'s sentence does not lead with', () => {
  // Measured over all 92 trade groups in the window: 253 of 253 `TR` rows lead
  // with one of their own two clubs, that club sends a named player in 92 of
  // 92 groups, and it only receives in 0 of 92. So the leading club is the
  // sender, every time — and the other club is the one acquiring.
  //
  // A headcount is the obvious alternative and it is wrong: it disagrees on 26
  // of the 60 groups it can decide, and it loses every one of them, because
  // the wire names the headline player first and the return second. Here it
  // would have headed the deadline's biggest card with Seattle, who took the
  // three prospects, rather than the club that got Luis Castillo.
  const owners = assignRowOwners(CASTILLO_TRADE, ctx)
  for (const row of CASTILLO_TRADE) assert.equal(owners.get(row), 145)
})

test('two trades between one club pair on one day fall back to the headcount', () => {
  // The only group of 92 where the leading club is ambiguous, because there
  // are two sentences leading with two different clubs. Toronto takes three of
  // the four named players, so the merged story is Toronto's.
  const owners = assignRowOwners(CUBS_JAYS_DOUBLE, ctx)
  for (const row of CUBS_JAYS_DOUBLE) assert.equal(owners.get(row), 141)
})

test('every owned row has exactly one owner', () => {
  const rows = [...CASTILLO_TRADE, ROM_CLAIM, TRIVINO_ELECTION, AFFILIATE_RELEASE, NO_ORG_ROW]
  const owners = assignRowOwners(rows, ctx)
  for (const id of ownerIds(rows)) assert.ok(id === null || Number.isInteger(id))
  assert.equal(owners.size, rows.length - 1)
})

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

test('a trade is told ONCE, from the acquiring club, with both sides in it', () => {
  const days = groupLeagueWide(CASTILLO_TRADE, ctx)
  assert.equal(days.length, 1)
  assert.equal(days[0].date, '2026-08-02')
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].teamId, 145)
  assert.equal(stories[0].type, 'trade')
  assert.equal(
    textOf(stories[0]),
    'Acquired RHP Luis Castillo from the Seattle Mariners for RHP Seranthony Domínguez,'
      + ' RF Nolan Jones and C Boston Smith.',
  )
})

test('a waiver claim is told once, by the club that gained him', () => {
  const { stories } = groupLeagueWide([ROM_CLAIM], ctx)[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].teamId, 133)
  assert.equal(textOf(stories[0]), 'Claimed LHP Drew Rom off waivers from Milwaukee Brewers.')
  assert.deepEqual(stories[0].rail.map((r) => [r.role, r.banner, r.surname]), [['in', 'In', 'Rom']])
})

test('the direct-touch gate still bites, because every story has a real orgId', () => {
  // `filterStoryworthy`'s DFA exemption is documented as safe only while its
  // caller resolves an org first. This pass does, so the affiliate-level
  // election survives and the affiliate-level release does not.
  const days = groupLeagueWide([TRIVINO_ELECTION, AFFILIATE_RELEASE, NO_ORG_ROW], ctx)
  const stories = days.flatMap((d) => d.stories)
  assert.deepEqual(stories.map((s) => [s.teamId, textOf(s)]), [
    [143, 'RHP Lou Trivino III elected free agency.'],
  ])
})

test('no event is told by two clubs, and days run newest first', () => {
  const days = groupLeagueWide([...CASTILLO_TRADE, ROM_CLAIM, TRIVINO_ELECTION], ctx)
  assert.deepEqual(days.map((d) => d.date), ['2026-08-11', '2026-08-05', '2026-08-02'])

  const stories = days.flatMap((d) => d.stories)
  const named = stories.flatMap((s) => s.rail.map((r) => r.playerId))
  assert.equal(new Set(named).size, named.length)
})

test('a day sorts its clubs by what happened, not by club id', () => {
  const days = groupLeagueWide([...CASTILLO_TRADE, ...CUBS_JAYS_DOUBLE], ctx)
  assert.equal(days.length, 1)
  // Both are trades, so the tie falls to the club id — a stable order, not a
  // claim that one deal mattered more.
  assert.deepEqual(days[0].stories.map((s) => [s.teamId, s.type]), [
    [141, 'trade'],
    [145, 'trade'],
  ])
})
