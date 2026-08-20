import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dedupeTransactions,
  filterStoryworthy,
  groupIntoStories,
  buildCutline,
  bucketToOrg,
  loadMoreTeamTransactions,
} from '../src/api/teamTransactions.js'

// ---------------------------------------------------------------------------
// Real fixture rows — the Brewers' (team id 158) actual statsapi transactions
// for 2026-06-24 through 2026-07-15, pulled live against
// https://statsapi.mlb.com/api/v1/transactions?startDate=2026-06-24&endDate=2026-07-15&teamId=158
// on 2026-07-15 while verifying .scratch/team-transactions/data-layer-scope.md.
// Trimmed to the dates that exercise each documented case; every field is
// copied verbatim from the live response (ids, descriptions, team ids).
// ---------------------------------------------------------------------------

const BREWERS = { id: 158, name: 'Milwaukee Brewers' }
const NASHVILLE = { id: 556, name: 'Nashville Sounds' }
const ACL = { id: 406, name: 'ACL Brewers' }
const ASTROS = { id: 117, name: 'Houston Astros' }
const ROYALS = { id: 118, name: 'Kansas City Royals' }
const ATHLETICS = { id: 133, name: 'Athletics' }

// 2026-08-11, verified live: the Brewers signed Bryse Wilson and designated
// Lyon Richardson, and the ATHLETICS claimed Drew Rom off waivers FROM the
// Brewers. `CLW` is the second of only two codes naming two different MLB
// clubs (`TR` is the other — docs/transactions-wire.md §3), so this single row
// buckets into both orgs' files and has to read in opposite directions there.
const AUG11_ROM_CLAIM = [
  {
    id: 937019, typeCode: 'SFA', date: '2026-08-11', effectiveDate: '2026-08-11',
    person: { id: 669060, fullName: 'Bryse Wilson' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers signed free agent RHP Bryse Wilson.',
  },
  {
    id: 937020, typeCode: 'DES', date: '2026-08-11', effectiveDate: '2026-08-11',
    person: { id: 680689, fullName: 'Lyon Richardson' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers designated RHP Lyon Richardson for assignment.',
  },
  {
    id: 937021, typeCode: 'CLW', date: '2026-08-11', effectiveDate: '2026-08-11',
    person: { id: 680723, fullName: 'Drew Rom' }, fromTeam: BREWERS, toTeam: ATHLETICS,
    description: 'Athletics claimed LHP Drew Rom off waivers from Milwaukee Brewers.',
  },
]

// 2026-06-24: a solo signing + a solo suspension (no corollary for either).
const JUN24 = [
  {
    id: 922372, typeCode: 'SFA', date: '2026-06-24', effectiveDate: '2026-06-24',
    person: { id: 657265, fullName: 'Peter Strzelecki' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers signed free agent RHP Peter Strzelecki to a minor league contract.',
  },
  {
    id: 921822, typeCode: 'SU', date: '2026-06-24', effectiveDate: '2026-06-24',
    person: { id: 682842, fullName: 'Abner Uribe' }, toTeam: BREWERS,
    description: 'RHP Abner Uribe suspended.',
  },
]

// 2026-06-28: the same Logan Henderson rehab assignment logged 3 times —
// Pass A's byte-identical-repeat case (different ids, identical everything
// else). ASG rows are noise regardless (never a story), so this is exercised
// through dedupeTransactions directly rather than the full pipeline.
const JUN28_HENDERSON_TRIPLE = [
  {
    id: 923296, typeCode: 'ASG', date: '2026-06-28', effectiveDate: '2026-06-28',
    person: { id: 701656, fullName: 'Logan Henderson' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers sent RHP Logan Henderson on a rehab assignment to Nashville Sounds.',
  },
  {
    id: 923290, typeCode: 'ASG', date: '2026-06-28', effectiveDate: '2026-06-28',
    person: { id: 701656, fullName: 'Logan Henderson' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers sent RHP Logan Henderson on a rehab assignment to Nashville Sounds.',
  },
  {
    id: 926482, typeCode: 'ASG', date: '2026-06-28', effectiveDate: '2026-06-28',
    person: { id: 701656, fullName: 'Logan Henderson' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers sent RHP Logan Henderson on a rehab assignment to Nashville Sounds.',
  },
]

// 2026-07-07: 8 raw rows — a genuine 3-player shuffle (2 up, 1 down), an IL
// placement paired with its replacement, a rail-less IL-to-IL transfer, and a
// duplicate rehab ASG pair (same content, different ids).
const JUL07 = [
  {
    id: 925596, typeCode: 'SC', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 666152, fullName: 'David Hamilton' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers placed 3B David Hamilton on the 10-day injured list. Strained left hamstring.',
  },
  {
    id: 925551, typeCode: 'ASG', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 692230, fullName: 'Carlos Rodriguez' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers sent RHP Carlos Rodriguez on a rehab assignment to Nashville Sounds.',
  },
  {
    id: 925595, typeCode: 'SC', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 663604, fullName: 'Brandon Lockridge' }, toTeam: BREWERS,
    description:
      'Milwaukee Brewers transferred LF Brandon Lockridge from the 10-day injured list to the 60-day injured list. Right knee laceration and contusion.',
  },
  {
    id: 925534, typeCode: 'ASG', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 692230, fullName: 'Carlos Rodriguez' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers sent RHP Carlos Rodriguez on a rehab assignment to Nashville Sounds.',
  },
  {
    id: 925597, typeCode: 'SE', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 675659, fullName: 'Greg Jones' }, fromTeam: NASHVILLE, toTeam: BREWERS,
    description: 'Milwaukee Brewers selected the contract of LF Greg Jones from Nashville Sounds.',
  },
  {
    id: 925498, typeCode: 'OPT', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 663368, fullName: 'Blake Perkins' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers optioned CF Blake Perkins to Nashville Sounds.',
  },
  {
    id: 925499, typeCode: 'CU', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 688107, fullName: 'Robert Gasser' }, fromTeam: ACL, toTeam: BREWERS,
    description: 'Milwaukee Brewers recalled LHP Robert Gasser from ACL Brewers.',
  },
  {
    id: 925497, typeCode: 'CU', date: '2026-07-07', effectiveDate: '2026-07-07',
    person: { id: 800325, fullName: 'Luis Lara' }, fromTeam: NASHVILLE, toTeam: BREWERS,
    description: 'Milwaukee Brewers recalled CF Luis Lara from Nashville Sounds.',
  },
]

// 2026-07-12: 6 raw rows — a trade with its 40-man-clearing DFA, a
// same-player double-move (activated off the IL then immediately optioned
// back down the same day), a solo option, and a rail-less IL-to-IL transfer.
const JUL12 = [
  {
    id: 927071, typeCode: 'SC', date: '2026-07-12', effectiveDate: '2026-07-12',
    person: { id: 689441, fullName: 'Coleman Crow' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers activated RHP Coleman Crow from the 15-day injured list.',
  },
  {
    id: 927068, typeCode: 'DES', date: '2026-07-12', effectiveDate: '2026-07-12',
    person: { id: 675659, fullName: 'Greg Jones' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers designated LF Greg Jones for assignment.',
  },
  {
    id: 927069, typeCode: 'SC', date: '2026-07-12', effectiveDate: '2026-07-12',
    person: { id: 605540, fullName: 'Brandon Woodruff' }, toTeam: BREWERS,
    description:
      'Milwaukee Brewers transferred RHP Brandon Woodruff from the 15-day injured list to the 60-day injured list. Right shoulder inflammation.',
  },
  {
    id: 927073, typeCode: 'TR', date: '2026-07-12', effectiveDate: '2026-07-12',
    person: { id: 669699, fullName: 'Braden Shewmake' }, fromTeam: ASTROS, toTeam: BREWERS,
    description: 'Houston Astros traded SS Braden Shewmake to Milwaukee Brewers.',
  },
  {
    id: 927074, typeCode: 'OPT', date: '2026-07-12', effectiveDate: '2026-07-12',
    person: { id: 668831, fullName: 'Garrett Stallings' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers optioned RHP Garrett Stallings to Nashville Sounds.',
  },
  {
    id: 927072, typeCode: 'OPT', date: '2026-07-12', effectiveDate: '2026-07-12',
    person: { id: 689441, fullName: 'Coleman Crow' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers optioned RHP Coleman Crow to Nashville Sounds.',
  },
]

// 2026-07-10: an unrelated same-day DFA, option, and free-agent signing —
// a signing should still cluster into a shuffle with other same-day churn
// (a DES + an OPT is both an add-less "out" pair; the SFA is the day's only
// "in", so all three combine into one shuffle).
const JUL10 = [
  {
    id: 926755, typeCode: 'DES', date: '2026-07-10', effectiveDate: '2026-07-10',
    person: { id: 668834, fullName: 'Easton McGee' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers designated RHP Easton McGee for assignment.',
  },
  {
    id: 926753, typeCode: 'SFA', date: '2026-07-10', effectiveDate: '2026-07-10',
    person: { id: 669060, fullName: 'Bryse Wilson' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers signed free agent RHP Bryse Wilson.',
  },
  {
    id: 926754, typeCode: 'OPT', date: '2026-07-10', effectiveDate: '2026-07-10',
    person: { id: 680723, fullName: 'Drew Rom' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers optioned LHP Drew Rom to Nashville Sounds.',
  },
]

// 2026-07-14: the Easton McGee trade logged twice, once per team's
// perspective — the second copy missing `person` entirely.
// 2026-07-15: a real 2-for-1 (plus cash) trade — verified live. Each of the
// three named players gets his own raw row (all sharing one description,
// written from the Astros' side), plus a 4th person-less mirror copy that
// Pass B's dedupe drops.
const JUL15_MULTI_PLAYER = [
  {
    id: 930001, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    person: { id: 700501, fullName: 'Jadyn Fielder' }, fromTeam: BREWERS, toTeam: ASTROS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
  {
    id: 930002, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    fromTeam: ASTROS, toTeam: BREWERS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
  {
    id: 930003, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    person: { id: 700502, fullName: 'Colton Gordon' }, fromTeam: ASTROS, toTeam: BREWERS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
  {
    id: 930004, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    person: { id: 700503, fullName: 'Lance McCullers Jr.' }, fromTeam: ASTROS, toTeam: BREWERS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
]

const JUL14_MCGEE_MIRROR = [
  {
    id: 927453, typeCode: 'TR', date: '2026-07-14', effectiveDate: '2026-07-14',
    person: { id: 668834, fullName: 'Easton McGee' }, fromTeam: BREWERS, toTeam: ROYALS,
    description: 'Milwaukee Brewers traded RHP Easton McGee to Kansas City Royals for cash.',
  },
  {
    id: 927453, typeCode: 'TR', date: '2026-07-14', effectiveDate: '2026-07-14',
    fromTeam: ROYALS, toTeam: BREWERS,
    description: 'Milwaukee Brewers traded RHP Easton McGee to Kansas City Royals for cash.',
  },
]

// ---------------------------------------------------------------------------
// §2 De-dupe
// ---------------------------------------------------------------------------

test('dedupeTransactions Pass A collapses a byte-identical triple with different ids', () => {
  const result = dedupeTransactions(JUN28_HENDERSON_TRIPLE)
  assert.equal(result.length, 1)
  assert.equal(result[0].person.fullName, 'Logan Henderson')
})

test('dedupeTransactions Pass A collapses a byte-identical pair (Rodriguez rehab, Jul 7)', () => {
  const rodriguezRows = JUL07.filter((t) => t.person?.fullName === 'Carlos Rodriguez')
  assert.equal(rodriguezRows.length, 2)
  const result = dedupeTransactions(rodriguezRows)
  assert.equal(result.length, 1)
})

test('dedupeTransactions Pass B collapses a trade logged from both perspectives, keeping the named copy', () => {
  const result = dedupeTransactions(JUL14_MCGEE_MIRROR)
  assert.equal(result.length, 1)
  assert.equal(result[0].person?.fullName, 'Easton McGee')
  assert.equal(result[0].fromTeam.id, 158)
})

test('dedupeTransactions does not flatten a genuine multi-person same-day/clubPair event', () => {
  // Synthetic: two DIFFERENT players both recalled from the same affiliate on
  // the same day — same (date, typeCode, clubPair) as the trade-mirror case,
  // but two real people, so both must survive.
  const rows = [
    {
      id: 1, typeCode: 'CU', date: '2026-08-01', effectiveDate: '2026-08-01',
      person: { id: 111, fullName: 'Player One' }, fromTeam: NASHVILLE, toTeam: BREWERS,
      description: 'Milwaukee Brewers recalled RHP Player One from Nashville Sounds.',
    },
    {
      id: 2, typeCode: 'CU', date: '2026-08-01', effectiveDate: '2026-08-01',
      person: { id: 222, fullName: 'Player Two' }, fromTeam: NASHVILLE, toTeam: BREWERS,
      description: 'Milwaukee Brewers recalled LHP Player Two from Nashville Sounds.',
    },
  ]
  const result = dedupeTransactions(rows)
  assert.equal(result.length, 2)
})

// ---------------------------------------------------------------------------
// §4 Noise filter
// ---------------------------------------------------------------------------

test('filterStoryworthy drops every ASG row (rehab or plain affiliate assignment)', () => {
  const kept = filterStoryworthy(dedupeTransactions(JUN28_HENDERSON_TRIPLE))
  assert.equal(kept.length, 0)
})

test('filterStoryworthy keeps IL placement/activation/transfer SC rows but drops a plain non-IL SC', () => {
  const placement = JUL07.find((t) => t.person?.fullName === 'David Hamilton')
  const transfer = JUL07.find((t) => t.person?.fullName === 'Brandon Lockridge')
  const plainActivation = {
    id: 999, typeCode: 'SC', date: '2026-06-25', effectiveDate: '2026-06-25',
    person: { id: 682842, fullName: 'Abner Uribe' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers activated RHP Abner Uribe.', // no "injured list" — a reinstatement, not an IL move
  }
  const kept = filterStoryworthy([placement, transfer, plainActivation], { orgId: 158 })
  assert.deepEqual(kept.map((t) => t.id), [placement.id, transfer.id])
})

test('filterStoryworthy drops a MiLB affiliate\'s own IL placement even though it buckets to the org', () => {
  // A minor leaguer placed on HIS OWN affiliate's injured list — toTeam is
  // Nashville Sounds (556), never the Brewers' MLB club (158) directly.
  // bucketToOrg keeps it (556 maps to org 158 via affilToOrg), but it never
  // touched the MLB roster, so it must not become a team-transactions story.
  const milbPlacement = {
    id: 777, typeCode: 'SC', date: '2026-06-20', effectiveDate: '2026-06-20',
    person: { id: 999001, fullName: 'Akil Baddoo' }, toTeam: NASHVILLE,
    description: 'Nashville Sounds placed OF Akil Baddoo on the 7-day injured list.',
  }
  const mlbPlacement = JUL07.find((t) => t.person?.fullName === 'David Hamilton') // toTeam 158
  const withOrgGate = filterStoryworthy([milbPlacement, mlbPlacement], { orgId: 158 })
  assert.deepEqual(withOrgGate.map((t) => t.id), [mlbPlacement.id])
  // No orgId given (e.g. a caller that hasn't been updated) keeps both —
  // documents that the gate is opt-in via ctx, not a hardcoded assumption.
  const withoutGate = filterStoryworthy([milbPlacement, mlbPlacement])
  assert.equal(withoutGate.length, 2)
})

test('filterStoryworthy drops REL/SU rows logged entirely at a single affiliate', () => {
  // Real rows, verified live 2026-07-15 against the league-wide feed: a
  // release or suspension can be logged with NO fromTeam and a toTeam that's
  // only ever the affiliate itself — these never carry the MLB org id on
  // either side, unlike a trade/call-up/option, which always name the MLB
  // club on one side. REL/SU are in the typeCode whitelist, so without the
  // org-touch gate these would incorrectly become this org's stories.
  const affiliateRelease = {
    id: 1001, typeCode: 'REL', date: '2026-07-08', effectiveDate: '2026-07-08',
    person: { id: 999002, fullName: 'Melvin Hernandez' }, toTeam: { id: 249, name: 'Wilson Warbirds' },
    description: 'Wilson Warbirds released RHP Melvin Hernandez.',
  }
  const affiliateSuspension = {
    id: 1002, typeCode: 'SU', date: '2026-06-16', effectiveDate: '2026-06-16',
    person: { id: 999003, fullName: 'Marco Dinges' }, toTeam: { id: 572, name: 'Wisconsin Timber Rattlers' },
    description: 'C Marco Dinges suspended.',
  }
  const mlbRelease = { ...affiliateRelease, id: 1003, toTeam: BREWERS, description: 'Milwaukee Brewers released RHP Melvin Hernandez.' }
  const kept = filterStoryworthy([affiliateRelease, affiliateSuspension, mlbRelease], { orgId: 158 })
  assert.deepEqual(kept.map((t) => t.id), [mlbRelease.id])
})

test('filterStoryworthy keeps a DFA (elected free agency) row even though it only touches the org via an affiliate', () => {
  // Real row, verified live league-wide 2026-07-16: "elected free agency" is
  // logged with toTeam the outrighted player's MINOR-LEAGUE club (Nashville
  // Sounds, 556), never the MLB parent (158) directly — unlike REL/SU above,
  // this is the NORMAL shape for every DFA row, not an occasional affiliate-
  // only outlier, so it's exempt from the direct-touch gate.
  const affiliateDfa = {
    id: 928036, typeCode: 'DFA', date: '2026-07-16', effectiveDate: '2026-07-16',
    person: { id: 675659, fullName: 'Greg Jones' }, toTeam: NASHVILLE,
    description: 'LF Greg Jones elected free agency.',
  }
  const kept = filterStoryworthy([affiliateDfa], { orgId: 158 })
  assert.deepEqual(kept.map((t) => t.id), [affiliateDfa.id])
})

test('filterStoryworthy suppresses an undebuted free-agent signing but keeps a debuted one', () => {
  // Real rows, verified live 2026-05-28: an org-depth minor-league signing —
  // no structural difference from a real NRI signing in the raw feed (it
  // legitimately carries toTeam=158), so debut status (ctx.debutedIds, a
  // plain personId Set — absence means "not known to have debuted," whether
  // genuinely undebuted or simply not resolved this run) is the only signal.
  const undebuted = {
    id: 2001, typeCode: 'SFA', date: '2026-05-28', effectiveDate: '2026-05-28',
    person: { id: 999010, fullName: 'Deivy Gonzalez' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers signed free agent RHP Deivy Gonzalez to a minor league contract.',
  }
  const debuted = {
    id: 2002, typeCode: 'SFA', date: '2026-05-28', effectiveDate: '2026-05-28',
    person: { id: 668834, fullName: 'Easton McGee' }, toTeam: BREWERS, // a real MLB arm, per JUL10/JUL14 fixtures
    description: 'Milwaukee Brewers signed free agent RHP Easton McGee to a major league contract.',
  }
  const debutedIds = new Set([668834])
  const kept = filterStoryworthy([undebuted, debuted], { orgId: 158, debutedIds })
  assert.deepEqual(kept.map((t) => t.id), [debuted.id])

  // Every other typeCode is unaffected by debutedIds, even for an undebuted
  // player — a call-up/selection IS the debut (or immediately precedes it).
  const recall = {
    id: 2004, typeCode: 'CU', date: '2026-05-28', effectiveDate: '2026-05-28',
    person: { id: 999012, fullName: 'Debut Day Rookie' }, fromTeam: NASHVILLE, toTeam: BREWERS,
    description: 'Milwaukee Brewers recalled RHP Debut Day Rookie from Nashville Sounds.',
  }
  assert.deepEqual(filterStoryworthy([recall], { orgId: 158, debutedIds }).map((t) => t.id), [recall.id])
})

test('filterStoryworthy keeps every whitelisted typeCode and drops an unlisted one', () => {
  const trade = JUL12.find((t) => t.typeCode === 'TR')
  const unlisted = { ...trade, id: 12345, typeCode: 'NC', description: 'New contract stuff.' }
  const kept = filterStoryworthy([trade, unlisted], { orgId: 158 })
  assert.deepEqual(kept.map((t) => t.id), [trade.id])
})

test('bucketToOrg keeps rows touching the org directly or via its own affiliate, drops one that touches neither', () => {
  const affilToOrg = new Map([[556, 158], [406, 158]])
  const ownRow = JUL07.find((t) => t.person?.fullName === 'David Hamilton') // toTeam 158
  const affiliateRow = JUL07.find((t) => t.person?.fullName === 'Blake Perkins') // fromTeam 158, toTeam 556
  const unrelated = {
    id: 555, typeCode: 'TR', date: '2026-07-07',
    fromTeam: ASTROS, toTeam: ROYALS, // neither side is 158 or one of its affiliates
    description: 'Houston Astros traded a player to Kansas City Royals.',
  }
  const kept = bucketToOrg([ownRow, affiliateRow, unrelated], 158, affilToOrg)
  assert.deepEqual(kept.map((t) => t.id), [ownRow.id, affiliateRow.id])
})

// ---------------------------------------------------------------------------
// §3 Story grouping — the real Jul 12 / Jul 7 / Jun 24 / Jul 14 fixtures
// ---------------------------------------------------------------------------

function storiesFor(rawRows, orgId = 158) {
  const kept = filterStoryworthy(dedupeTransactions(rawRows), { orgId })
  return groupIntoStories(kept, { positions: {}, orgId })
}

test('Jul 12: trade+clear, same-player double-move, solo option, transfer with its own photo — in that order', () => {
  const days = storiesFor(JUL12)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.deepEqual(
    stories.map((s) => [s.type, s.rail.length]),
    [['trade', 2], ['roster-move', 1], ['roster-move', 1], ['roster-move', 1]],
  )

  const trade = stories[0]
  assert.deepEqual(trade.rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'In', 'Shewmake'],
    ['out', 'Out', 'Jones'],
  ])
  assert.equal(
    trade.cutline.map((s) => s.text).join(''),
    'Acquired SS Braden Shewmake from the Houston Astros; designated LF Greg Jones for assignment.',
  )
  const astrosSeg = trade.cutline.find((s) => s.text === 'Houston Astros')
  assert.equal(astrosSeg.teamId, 117)

  const doubleMove = stories[1]
  assert.deepEqual(doubleMove.rail[0], {
    role: 'out', banner: 'Down', playerId: 689441, name: 'Coleman Crow',
    surname: 'Crow', pos: 'RHP', tintTeamId: 158, isMlb: false,
  })
  assert.equal(
    doubleMove.cutline.map((s) => s.text).join(''),
    'Optioned RHP Coleman Crow to Nashville Sounds (activated from the 15-day injured list first).',
  )
  assert.equal(doubleMove.cutline.filter((s) => s.playerId === 689441).length, 1)
  const nashvilleSeg = doubleMove.cutline.find((s) => s.text === 'Nashville Sounds')
  assert.equal(nashvilleSeg.teamId, 556)

  const soloOption = stories[2]
  assert.deepEqual(soloOption.rail[0], {
    role: 'out', banner: 'Down', playerId: 668831, name: 'Garrett Stallings',
    surname: 'Stallings', pos: 'RHP', tintTeamId: 158, isMlb: false,
  })

  const transfer = stories[3]
  assert.deepEqual(transfer.rail, [{
    role: 'move', banner: 'IL-60', playerId: 605540, name: 'Brandon Woodruff',
    surname: 'Woodruff', pos: 'RHP', tintTeamId: 158, isMlb: false,
  }])
  assert.equal(
    transfer.cutline.map((s) => s.text).join(''),
    'Transferred RHP Brandon Woodruff from the 15-day injured list to the 60-day injured list. Right shoulder inflammation.',
  )
})

// A rail slot's tint is always the MLB parent org, so the slot has to carry
// the player's own MLB status — Headshot would otherwise read that tint as
// "confirmed major-leaguer" and drop his MiLB photo rung.
test('a rail slot flags a confirmed major-leaguer from ctx.debutedIds, not the tint club', () => {
  const kept = filterStoryworthy(dedupeTransactions(JUL12), { orgId: 158 })
  const railOf = (days) => days.flatMap((d) => d.stories.flatMap((s) => s.rail))

  const rail = railOf(groupIntoStories(kept, { positions: {}, orgId: 158, debutedIds: new Set([689441]) }))
  const crow = rail.find((s) => s.playerId === 689441)
  const stallings = rail.find((s) => s.playerId === 668831)
  assert.equal(crow.tintTeamId, 158)
  assert.equal(stallings.tintTeamId, 158)
  assert.equal(crow.isMlb, true)
  assert.equal(stallings.isMlb, false)

  // No signal at all never claims MLB: falling back to a real MiLB face beats
  // dropping straight to the club logo.
  const blind = railOf(groupIntoStories(kept, { positions: {}, orgId: 158 }))
  assert.equal(blind.find((s) => s.playerId === 689441).isMlb, false)
})

test('Jul 7: injured-list+replacement, 3-player shuffle, transfer with its own photo', () => {
  const days = storiesFor(JUL07)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.deepEqual(stories.map((s) => s.type), ['injured-list', 'shuffle', 'roster-move'])

  const il = stories[0]
  assert.deepEqual(il.rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'Up', 'Jones'],
    ['out', 'IL-10', 'Hamilton'],
  ])

  const shuffle = stories[1]
  assert.deepEqual(shuffle.rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'Up', 'Gasser'],
    ['in', 'Up', 'Lara'],
    ['out', 'Down', 'Perkins'],
  ])
  // Two different affiliates in one story (Gasser from ACL Brewers, Lara from
  // and Perkins to Nashville Sounds) — every mention gets its own team link.
  const aclSegs = shuffle.cutline.filter((s) => s.text === 'ACL Brewers')
  const nashvilleSegs = shuffle.cutline.filter((s) => s.text === 'Nashville Sounds')
  assert.equal(aclSegs.length, 1)
  assert.equal(aclSegs[0].teamId, 406)
  assert.equal(nashvilleSegs.length, 2)
  assert.deepEqual(nashvilleSegs.map((s) => s.teamId), [556, 556])

  const transfer = stories[2]
  assert.deepEqual(transfer.rail.map((r) => [r.role, r.banner, r.surname]), [['move', 'IL-60', 'Lockridge']])
  assert.match(transfer.cutline.map((s) => s.text).join(''), /Brandon Lockridge/)
})

test('cutlineShuffle keeps a trailing DFA clause\'s leading position abbreviation intact', () => {
  // Real bug, verified live 2026-04-23 (team 110): a shuffle's non-first
  // clause is lowerFirst'd for mid-sentence flow, which is correct for an
  // ordinary verb ("optioned...") but wrong for a DFA row — it has no
  // leading club name to strip, so it starts with a position abbreviation
  // ("C Old Vet elected free agency."), and lowerFirst mangled that into
  // "c Old Vet elected free agency."
  const recall = {
    id: 1, typeCode: 'CU', date: '2026-07-17', effectiveDate: '2026-07-17',
    person: { id: 900001, fullName: 'New Guy' }, fromTeam: NASHVILLE, toTeam: BREWERS,
    description: 'Milwaukee Brewers recalled RHP New Guy from Nashville Sounds.',
  }
  const dfa = {
    id: 2, typeCode: 'DFA', date: '2026-07-17', effectiveDate: '2026-07-17',
    person: { id: 900002, fullName: 'Old Vet' }, toTeam: NASHVILLE,
    description: 'C Old Vet elected free agency.',
  }
  const days = storiesFor([recall, dfa])
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'shuffle')
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Recalled RHP New Guy from Nashville Sounds; C Old Vet elected free agency.',
  )
})

test('Jul 10: a same-day DFA + option + signing cluster into one shuffle', () => {
  const days = storiesFor(JUL10)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'shuffle')
  assert.deepEqual(stories[0].rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'Up', 'Wilson'],
    ['out', 'Down', 'McGee'],
    ['out', 'Down', 'Rom'],
  ])
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Signed free agent RHP Bryse Wilson; designated RHP Easton McGee for assignment; optioned LHP Drew Rom to Nashville Sounds.',
  )
})

test('Jun 24: a solo signing and a solo suspension, not merged into one story', () => {
  const days = storiesFor(JUN24)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.deepEqual(stories.map((s) => s.type), ['signing', 'suspension'])
  assert.equal(stories[0].rail[0].banner, 'In')
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Signed free agent RHP Peter Strzelecki to a minor league contract.',
  )
  assert.equal(stories[1].rail[0].banner, 'Out')
})

test('Jul 14: the two-perspective trade mirror de-dupes to one trade-away story', () => {
  const days = storiesFor(JUL14_MCGEE_MIRROR)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'trade')
  assert.deepEqual(stories[0].rail, [{
    role: 'out', banner: 'Out', playerId: 668834, name: 'Easton McGee',
    surname: 'McGee', pos: 'RHP', tintTeamId: 158, isMlb: false,
  }])
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Traded RHP Easton McGee to the Kansas City Royals for cash.',
  )
})

test('Jul 15: a real 2-for-1 (plus cash) trade merges into ONE story, not three', () => {
  const days = storiesFor(JUL15_MULTI_PLAYER)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'trade')
  // Rail/cutline order follows the raw feed's own row order (Gordon's row
  // precedes McCullers Jr.'s — verified live), not the description's naming
  // order.
  assert.deepEqual(stories[0].rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'In', 'Gordon'],
    ['in', 'In', 'McCullers Jr.'],
    ['out', 'Out', 'Fielder'],
  ])
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Acquired LHP Colton Gordon and RHP Lance McCullers Jr. from the Houston Astros for OF Jadyn Fielder.',
  )
  // Fielder's own name must NOT appear in his own "for" clause (the
  // self-reference bug the real fixture originally exposed).
  const fielderMentions = stories[0].cutline.filter((s) => s.playerId === 700501)
  assert.equal(fielderMentions.length, 1)
})

test('Jul 15: a trade leg immediately optioned the same day still joins the trade story, not a Crow-style double-move', () => {
  // Real bug, verified live 2026-07-15: every player in a multi-player trade
  // gets the SAME fromTeam/toTeam (the deal's acting clubs), not his own
  // direction — Gordon's TR row reads toTeam=Brewers same as McCullers'. When
  // Gordon is ALSO optioned to Nashville the same day, rowDirection sees a
  // same-person in+out pair and Step 1's Crow-case logic used to steal him
  // out of the pool before Step 2's trade grouping ever ran, leaving him
  // rendered as an unrelated solo "Optioned to Nashville" story instead of
  // inside the trade.
  const gordonOption = {
    id: 930010, typeCode: 'OPT', date: '2026-07-15', effectiveDate: '2026-07-15',
    person: { id: 700502, fullName: 'Colton Gordon' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers optioned LHP Colton Gordon to Nashville Sounds.',
  }
  const days = storiesFor([...JUL15_MULTI_PLAYER, gordonOption])
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.deepEqual(stories.map((s) => s.type), ['trade', 'roster-move'])

  const trade = stories[0]
  assert.deepEqual(trade.rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'In', 'Gordon'],
    ['in', 'In', 'McCullers Jr.'],
    ['out', 'Out', 'Fielder'],
  ])
  assert.equal(
    trade.cutline.map((s) => s.text).join(''),
    'Acquired LHP Colton Gordon and RHP Lance McCullers Jr. from the Houston Astros for OF Jadyn Fielder.',
  )

  const optionStory = stories[1]
  assert.deepEqual(optionStory.rail, [{
    role: 'out', banner: 'Down', playerId: 700502, name: 'Colton Gordon',
    surname: 'Gordon', pos: 'LHP', tintTeamId: 158, isMlb: false,
  }])
})

test('Aug 11: a waiver claim reads as a DEPARTURE on the club that lost the player', () => {
  // Real bug, verified live 2026-08-11: `CLW` sat in IN_CODES, so a claim read
  // as an arrival for BOTH clubs it names. The Brewers' own card announced
  // "claimed LHP Drew Rom off waivers from Milwaukee Brewers" over an "Up"
  // banner — the club that LOST him claiming it had gained him.
  const days = storiesFor(AUG11_ROM_CLAIM)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'shuffle')
  assert.deepEqual(stories[0].rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'Up', 'Wilson'],
    ['out', 'Down', 'Richardson'],
    // "Out", not "Down": a claim crosses ORGS, so it is never a rung on this
    // club's own ladder the way an option or an outright is.
    ['out', 'Out', 'Rom'],
  ])
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Signed free agent RHP Bryse Wilson; designated RHP Lyon Richardson for assignment;'
      + ' lost LHP Drew Rom to the Athletics on a waiver claim.',
  )
  // Rom is the club's loss here, so he is never the headline name.
  const romSeg = stories[0].cutline.find((s) => s.playerId === 680723)
  assert.equal(romSeg.emphasis, 'secondary')
  assert.equal(stories[0].cutline.find((s) => s.text === 'Athletics')?.teamId, 133)
})

test('Aug 11: the SAME waiver-claim row reads as an ARRIVAL on the claiming club', () => {
  const days = storiesFor(AUG11_ROM_CLAIM, 133)
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'roster-move')
  assert.deepEqual(stories[0].rail.map((r) => [r.role, r.banner, r.surname]), [
    ['in', 'In', 'Rom'],
  ])
  // The feed's own sentence already reads from the claiming club's side, so
  // this half needs no rebuilt lead — just its acting club stripped.
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Claimed LHP Drew Rom off waivers from Milwaukee Brewers.',
  )
  assert.equal(stories[0].cutline.find((s) => s.playerId === 680723)?.emphasis, 'primary')
})

test('Jul 16: an outright assignment + same-day elected free agency merge into one departure card', () => {
  // Real rows, verified live 2026-07-16: outrighted to Nashville, then
  // elected free agency the same day (a vested veteran declining the
  // assignment) — two separate raw rows for the same person/day that must
  // read as one card, not two disconnected "Down" stories.
  const outright = {
    id: 928035, typeCode: 'OUT', date: '2026-07-16', effectiveDate: '2026-07-16',
    person: { id: 675659, fullName: 'Greg Jones' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers sent LF Greg Jones outright to Nashville Sounds.',
  }
  const dfa = {
    id: 928036, typeCode: 'DFA', date: '2026-07-16', effectiveDate: '2026-07-16',
    person: { id: 675659, fullName: 'Greg Jones' }, toTeam: NASHVILLE,
    description: 'LF Greg Jones elected free agency.',
  }
  const days = storiesFor([outright, dfa])
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'roster-move')
  assert.deepEqual(stories[0].rail, [{
    role: 'out', banner: 'Out', playerId: 675659, name: 'Greg Jones',
    surname: 'Jones', pos: 'LF', tintTeamId: 158, isMlb: false,
  }])
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Sent LF Greg Jones outright to Nashville Sounds; elected free agency.',
  )
  assert.equal(stories[0].cutline.filter((s) => s.playerId === 675659).length, 1)
  const nashvilleSeg = stories[0].cutline.find((s) => s.text === 'Nashville Sounds')
  assert.equal(nashvilleSeg.teamId, 556)
})

test('cutlineDeparture falls back safely when the DFA row\'s embedded name spelling differs from person.fullName', () => {
  // Real bug, verified live 2026-05-08 (team 144): person.fullName is "José
  // Azócar" but the DFA row's own description spells it "Azocar" (no
  // accent) — the exact-match label strip can't find "José Azócar" inside
  // that text, so it falls through to the raw description ("LF José Azocar
  // elected free agency."), which still starts with the position
  // abbreviation. Must not get lowerFirst'd into "lF José Azocar...".
  const outright = {
    id: 1, typeCode: 'OUT', date: '2026-07-18', effectiveDate: '2026-07-18',
    person: { id: 640492, fullName: 'José Azócar' }, fromTeam: BREWERS, toTeam: NASHVILLE,
    description: 'Milwaukee Brewers sent LF José Azócar outright to Nashville Sounds.',
  }
  const dfa = {
    id: 2, typeCode: 'DFA', date: '2026-07-18', effectiveDate: '2026-07-18',
    person: { id: 640492, fullName: 'José Azócar' }, toTeam: NASHVILLE,
    description: 'LF Jose Azocar elected free agency.',
  }
  const days = storiesFor([outright, dfa])
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'Sent LF José Azócar outright to Nashville Sounds; LF Jose Azocar elected free agency.',
  )
})

test('Jul 16: a lone DFA row (no same-day outright/release) still shows as its own story', () => {
  const dfa = {
    id: 928036, typeCode: 'DFA', date: '2026-07-16', effectiveDate: '2026-07-16',
    person: { id: 675659, fullName: 'Greg Jones' }, toTeam: NASHVILLE,
    description: 'LF Greg Jones elected free agency.',
  }
  const days = storiesFor([dfa])
  assert.equal(days.length, 1)
  const { stories } = days[0]
  assert.equal(stories.length, 1)
  assert.equal(stories[0].type, 'roster-move')
  assert.equal(
    stories[0].cutline.map((s) => s.text).join(''),
    'LF Greg Jones elected free agency.',
  )
})

test('days sort newest first, and multiple fixture days combine correctly', () => {
  const days = storiesFor([...JUL12, ...JUL07, ...JUN24])
  assert.deepEqual(days.map((d) => d.date), ['2026-07-12', '2026-07-07', '2026-06-24'])
})

// ---------------------------------------------------------------------------
// buildCutline — standalone, against hand-built story drafts
// ---------------------------------------------------------------------------

test('buildCutline: a pure trade-away pulls no secondary clause', () => {
  const row = JUL14_MCGEE_MIRROR[0]
  const segs = buildCutline({ storyType: 'trade', rows: [{ row, role: 'out' }] }, { orgId: 158 })
  assert.equal(segs.map((s) => s.text).join(''), 'Traded RHP Easton McGee to the Kansas City Royals for cash.')
  const emphasized = segs.find((s) => s.emphasis === 'primary')
  assert.equal(emphasized.text, 'Easton McGee')
  assert.equal(emphasized.playerId, 668834)
})

test('buildCutline: injured-list without a replacement has no secondary clause', () => {
  const row = JUL07.find((t) => t.person?.fullName === 'David Hamilton')
  const segs = buildCutline({ storyType: 'injured-list', rows: [{ row, role: 'out' }] }, {})
  assert.equal(
    segs.map((s) => s.text).join(''),
    'Placed 3B David Hamilton on the 10-day injured list (strained left hamstring).',
  )
})

// ---------------------------------------------------------------------------
// §5 Reader — per-club, per-season pagination over a mocked fetch
// ---------------------------------------------------------------------------

// Keyed season -> teamId -> file, matching the shard layout on disk. A season
// present with no entry for the club still resolves (an empty shard); only a
// season absent altogether 404s.
function mockFetch(filesBySeason) {
  return async (url) => {
    const m = String(url).match(/team-transactions\/(\d+)\/(\d+)\.json/)
    const season = m ? Number(m[1]) : null
    const teamId = m ? Number(m[2]) : null
    const bySeason = season != null ? filesBySeason[season] : undefined
    if (bySeason === undefined) return { ok: false, status: 404 }
    return { ok: true, json: async () => bySeason[teamId] ?? { days: [] } }
  }
}

// PAGE_DAYS is 45 and not parameterized, so a fixture exercising "still more
// in this same file" / "still more after crossing one season" needs to
// actually clear that page size — a couple of hand-picked days isn't enough
// to distinguish "ran out" from "paged normally".
function syntheticDays(count, startYear, startMonth) {
  const days = []
  let y = startYear
  let m = startMonth
  for (let i = 0; i < count; i++) {
    const date = `${y}-${String(m).padStart(2, '0')}-01`
    days.push({ date, stories: [] })
    m -= 1
    if (m === 0) { m = 12; y -= 1 }
  }
  return days
}

test('loadMoreTeamTransactions returns the current season, trimmed to a cutoff, and reports hasMore', async () => {
  const originalFetch = globalThis.fetch
  // 3 days after the cutoff (excluded) + 50 days at/before it (well over
  // PAGE_DAYS, so the page fills from this one file without touching another).
  const afterCutoff = syntheticDays(3, 2026, 12)
  const atOrBeforeCutoff = syntheticDays(50, 2026, 7)
  globalThis.fetch = mockFetch({
    9101: { 158: { days: [...afterCutoff, ...atOrBeforeCutoff] } },
  })
  try {
    const cutoff = atOrBeforeCutoff[0].date
    const page = await loadMoreTeamTransactions(158, { season: 9101, index: 0 }, cutoff)
    assert.equal(page.days.length, 45)
    assert.ok(page.days.every((d) => d.date <= cutoff))
    assert.deepEqual(page.days.map((d) => d.date), atOrBeforeCutoff.slice(0, 45).map((d) => d.date))
    assert.equal(page.cursor.season, 9101)
    assert.equal(page.cursor.index, 45) // relative to the cutoff-filtered array, not the raw one
    assert.equal(page.hasMore, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loadMoreTeamTransactions crosses into the prior season once the current one is exhausted', async () => {
  const originalFetch = globalThis.fetch
  const currentSeasonDays = syntheticDays(10, 2026, 4) // fewer than PAGE_DAYS
  const priorSeasonDays = syntheticDays(50, 2025, 9) // plenty left over after topping up the page
  globalThis.fetch = mockFetch({
    9201: { 158: { days: currentSeasonDays } },
    9200: { 158: { days: priorSeasonDays } },
  })
  try {
    const page = await loadMoreTeamTransactions(158, { season: 9201, index: 0 }, null)
    assert.equal(page.days.length, 45)
    assert.deepEqual(
      page.days.map((d) => d.date),
      [...currentSeasonDays, ...priorSeasonDays.slice(0, 35)].map((d) => d.date),
    )
    assert.equal(page.cursor.season, 9200)
    assert.equal(page.cursor.index, 35)
    assert.equal(page.hasMore, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loadMoreTeamTransactions reports hasMore:false once a season file 404s (no earlier history)', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch({
    2026: { 158: { days: [{ date: '2026-04-01', stories: [] }] } },
  })
  try {
    const page = await loadMoreTeamTransactions(158, { season: 2025, index: 0 }, null)
    assert.deepEqual(page.days, [])
    assert.equal(page.hasMore, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a club with an EMPTY shard is not the end of its history — paging crosses that season', async () => {
  const originalFetch = globalThis.fetch
  // The generator writes a file for every org every season, so a club that
  // made no storyworthy move in 9301 has an empty one. Reading that as "no
  // more history" would hide the year before it — the one difference between
  // an empty shard and a missing season.
  const priorSeasonDays = syntheticDays(3, 2024, 9)
  // A club id of its own: loadSeasonFile's session cache is keyed
  // season+club and shared across this file's tests.
  globalThis.fetch = mockFetch({
    2025: { 159: { days: [] } },
    2024: { 159: { days: priorSeasonDays } },
  })
  try {
    const page = await loadMoreTeamTransactions(159, { season: 2025, index: 0 }, null)
    assert.deepEqual(page.days.map((d) => d.date), priorSeasonDays.map((d) => d.date))
    assert.equal(page.hasMore, false) // 2023 has no file at all — that is the end
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('loadMoreTeamTransactions retries a transient season-file failure in the same session', async () => {
  const originalFetch = globalThis.fetch
  let currentSeasonCalls = 0
  globalThis.fetch = async (url) => {
    const season = Number(String(url).match(/team-transactions\/(\d+)\//)?.[1])
    if (season === 2026) {
      currentSeasonCalls += 1
      if (currentSeasonCalls === 1) return { ok: false, status: 503 }
      return {
        ok: true,
        json: async () => ({ days: [{ date: '2026-07-15', stories: [] }] }),
      }
    }
    return { ok: false, status: 404 }
  }
  try {
    await assert.rejects(loadMoreTeamTransactions(158, { season: 2026, index: 0 }, null))

    const retried = await loadMoreTeamTransactions(158, { season: 2026, index: 0 }, null)
    assert.deepEqual(retried.days.map((d) => d.date), ['2026-07-15'])
    assert.equal(currentSeasonCalls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ---------------------------------------------------------------------------
// Coverage: the two families the noise filter dropped for structural reasons
// rather than editorial ones (issue #772 segment 1). Every row below is
// verbatim from a live 60-day league-wide pull on 2026-08-20; the counts cited
// in the comments come from .scratch/home-transactions/probe-coverage.mjs and
// probe-bare-activation.mjs, which regenerate them.
// ---------------------------------------------------------------------------

const METS = { id: 121, name: 'New York Mets' }
const BLUE_CRABS = { id: 5433, name: 'Southern Maryland Blue Crabs' }
const CARDINALS = { id: 138, name: 'St. Louis Cardinals' }
const MONARCHS = { id: 1885, name: 'Kansas City Monarchs' }
const YANKEES = { id: 147, name: 'New York Yankees' }
const MARLINS = { id: 146, name: 'Miami Marlins' }
const WHITE_SOX = { id: 145, name: 'Chicago White Sox' }
const MARINERS = { id: 136, name: 'Seattle Mariners' }

const ACQ_DARDEN = {
  id: 920771, typeCode: 'ACQ', date: '2026-06-21', effectiveDate: '2026-06-21',
  person: { id: 831590, fullName: 'Taylor Darden' }, fromTeam: BLUE_CRABS, toTeam: METS,
  description: 'New York Mets acquired 2B Taylor Darden from the Southern Maryland Blue Crabs of the Atlantic League.',
}
const OBT_FELTMAN = {
  id: 926970, typeCode: 'OBT', date: '2026-07-10', effectiveDate: '2026-07-11',
  person: { id: 664687, fullName: 'Durbin Feltman' }, fromTeam: MONARCHS, toTeam: CARDINALS,
  description: 'St. Louis Cardinals obtain RHP Durbin Feltman from Kansas City Monarchs.',
}

const PATERNITY_SANCHEZ = [
  {
    id: 921332, typeCode: 'SC', date: '2026-06-23', effectiveDate: '2026-06-23',
    person: { id: 645305, fullName: 'Ali Sánchez' }, toTeam: YANKEES,
    description: 'New York Yankees placed C Ali Sánchez on the paternity list.',
  },
  {
    id: 922613, typeCode: 'SC', date: '2026-06-26', effectiveDate: '2026-06-26',
    person: { id: 645305, fullName: 'Ali Sánchez' }, toTeam: YANKEES,
    description: 'New York Yankees activated C Ali Sánchez from the paternity list.',
  },
]
const BEREAVEMENT_MEYER = {
  id: 921007, typeCode: 'SC', date: '2026-06-22', effectiveDate: '2026-06-22',
  person: { id: 676974, fullName: 'Max Meyer' }, toTeam: MARLINS,
  description: 'Miami Marlins placed RHP Max Meyer on the bereavement list.',
}
const RESTRICTED_ABREU = {
  id: 921066, typeCode: 'SC', date: '2026-06-22', effectiveDate: '2026-06-22',
  person: { id: 650556, fullName: 'Bryan Abreu' }, fromTeam: ASTROS, toTeam: ASTROS,
  description: 'Houston Astros placed RHP Bryan Abreu on the restricted list.',
}

// 2026-08-02, verbatim: the White Sox activated Luis Castillo the same day
// they traded for him, and again the next day. The bare "activated X" row
// names no list and is an ECHO of a move the feed already tells — measured
// over 60 live days, 95 of 110 such MLB rows echo a trade (70), a waiver claim
// (12) or a recall/selection/signing (13). It must stay dropped.
const AUG02_CASTILLO = [
  {
    id: 934000, typeCode: 'TR', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 622491, fullName: 'Luis Castillo' }, fromTeam: MARINERS, toTeam: WHITE_SOX,
    description: 'Seattle Mariners traded RHP Luis Castillo to Chicago White Sox for RHP Seranthony Domínguez, C Boston Smith, RF Nolan Jones and cash.',
  },
  {
    id: 934008, typeCode: 'SC', date: '2026-08-02', effectiveDate: '2026-08-02',
    person: { id: 622491, fullName: 'Luis Castillo' }, toTeam: WHITE_SOX,
    description: 'Chicago White Sox activated RHP Luis Castillo.',
  },
]

test('an independent-league acquisition is a story, and reads as an arrival from outside the org', () => {
  // `ACQ`/`OBT`/`PUR`/`CP` are one concept in four codes (docs/transactions-
  // wire.md §3) — a player arriving from outside affiliated ball. None was on
  // the whitelist. Verified over 60 live days: all 31 rows are shaped
  // fromTeam=non-MLB, toTeam=MLB, so unlike TR/CLW they name a single major-
  // league club and carry no direction ambiguity.
  const days = storiesFor([ACQ_DARDEN], 121)
  assert.equal(days.length, 1)
  const [story] = days[0].stories
  assert.equal(story.type, 'roster-move')
  // "In", not "Up": he arrives from outside the organisation entirely, so this
  // is never a rung on the club's own ladder — the same reasoning as a claim.
  assert.deepEqual(story.rail.map((r) => [r.role, r.banner, r.surname]), [['in', 'In', 'Darden']])
  assert.equal(
    story.cutline.map((s) => s.text).join(''),
    'Acquired 2B Taylor Darden from the Southern Maryland Blue Crabs of the Atlantic League.',
  )
  // The source club is an independent-league team with no page in this app —
  // it must never be linkified the way an affiliate or a trade partner is.
  assert.equal(story.cutline.some((s) => s.teamId === 5433), false)
})

test('`OBT` is the same event as `ACQ` in a different verb, and groups the same way', () => {
  const days = storiesFor([OBT_FELTMAN], 138)
  const [story] = days[0].stories
  assert.deepEqual(story.rail.map((r) => [r.role, r.banner, r.surname]), [['in', 'In', 'Feltman']])
  // "Obtained", not the wire's own "obtain": `OBT` is the single code written
  // in the present tense, and every other clause on the card reads past.
  assert.equal(
    story.cutline.map((s) => s.text).join(''),
    'Obtained RHP Durbin Feltman from Kansas City Monarchs.',
  )
  assert.equal(story.cutline.some((s) => s.teamId === 1885), false)
})

test('the paternity, bereavement and restricted lists are stories in both directions', () => {
  // These take a player off the ACTIVE roster exactly as the injured list
  // does, but the shared `mentionsInjuredList` test does not match them, so
  // every one dropped. 47 MLB rows over 60 live days, evenly split between
  // placements and activations. Each names its own list, so — unlike a bare
  // activation — none of them can echo a story the feed already tells.
  const days = storiesFor(PATERNITY_SANCHEZ, 147)
  assert.deepEqual(days.map((d) => d.date), ['2026-06-26', '2026-06-23'])

  const [activation] = days[0].stories
  assert.deepEqual(activation.rail.map((r) => [r.role, r.banner, r.surname]), [['in', 'Up', 'Sánchez']])
  assert.equal(
    activation.cutline.map((s) => s.text).join(''),
    'Activated C Ali Sánchez from the paternity list.',
  )

  const [placement] = days[1].stories
  // A dedicated banner, for the same reason the injured list gets `IL-15`
  // rather than "Down": it says WHY he is off the roster, and this is not a
  // demotion to the minors.
  assert.deepEqual(placement.rail.map((r) => [r.role, r.banner, r.surname]), [['out', 'PAT', 'Sánchez']])
  assert.equal(
    placement.cutline.map((s) => s.text).join(''),
    'Placed C Ali Sánchez on the paternity list.',
  )
})

test('the bereavement and restricted lists carry their own banners too', () => {
  const [bereavement] = storiesFor([BEREAVEMENT_MEYER], 146)[0].stories
  assert.deepEqual(bereavement.rail.map((r) => [r.role, r.banner, r.surname]), [['out', 'BRV', 'Meyer']])
  assert.equal(
    bereavement.cutline.map((s) => s.text).join(''),
    'Placed RHP Max Meyer on the bereavement list.',
  )

  // Verbatim: a restricted-list placement carries the SAME club as fromTeam
  // and toTeam, which the direct-touch gate and stripLeadingClub both survive.
  const [restricted] = storiesFor([RESTRICTED_ABREU], 117)[0].stories
  assert.deepEqual(restricted.rail.map((r) => [r.role, r.banner, r.surname]), [['out', 'RES', 'Abreu']])
  assert.equal(
    restricted.cutline.map((s) => s.text).join(''),
    'Placed RHP Bryan Abreu on the restricted list.',
  )
})

test('a bare "activated X" row stays dropped — it echoes the trade it accompanies', () => {
  // The single most common shape of this row (70 of 110 over 60 live days).
  // Keeping it would print the deadline's biggest deal twice: once as the
  // trade, once as a content-free "Activated RHP Luis Castillo."
  const kept = filterStoryworthy(dedupeTransactions(AUG02_CASTILLO), { orgId: 145 })
  assert.deepEqual(kept.map((t) => t.typeCode), ['TR'])

  const [story] = storiesFor(AUG02_CASTILLO, 145)[0].stories
  assert.equal(story.type, 'trade')
  assert.deepEqual(story.rail.map((r) => r.surname), ['Castillo'])
})

test('an all-star sweep and an unexplained roster-status row are still not stories', () => {
  // Guards the widened SC branch against the two shapes it must not admit.
  const allStars = {
    id: 3001, typeCode: 'SC', date: '2026-07-14', effectiveDate: '2026-07-14',
    person: { id: 999020, fullName: 'A Star' }, toTeam: BREWERS,
    description: 'Milwaukee Brewers all-stars activated.',
  }
  const opaque = {
    id: 3002, typeCode: 'SC', date: '2026-07-14', effectiveDate: '2026-07-14',
    person: { id: 999021, fullName: 'Nate Pearson' }, toTeam: BREWERS,
    description: 'RHP Nate Pearson roster status changed by Milwaukee Brewers.',
  }
  assert.deepEqual(filterStoryworthy([allStars, opaque], { orgId: 158 }), [])
})
