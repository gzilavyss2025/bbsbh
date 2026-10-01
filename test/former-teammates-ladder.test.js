// THE FORMER TEAMMATES LADDER (teammateLadder + layout.js). Each player and
// each club is one node; each pair is one edge on its best third club; a tie
// to tonight's own org is a badge on the player, not an edge. Real shards are
// frozen under test/fixtures/former-teammates/ (the live ones leave the
// nightly window after three days).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { formerTeammatePairs, teammateLadder } from '../src/api/formerTeammates.js'
import { clubShortName, ladderGeometry, ladderLayout, seasonRange, SIDEWAYS_MIN, traceOf } from '../src/components/team/ladder/layout.js'

const AWAY = 111
const HOME = 147
const club = (teamId, teamName, seasons, level = 'MLB') => ({ teamId, teamName, level, seasons })
const farm = (teamId, teamName, seasons, level, orgId) => ({ ...club(teamId, teamName, seasons, level), orgId })
const player = (id, name, teamId, pos = 'P') => ({ id, name, pos, teamId })
const pair = (a, b, clubs, score = 50) => ({ a, b, clubs, score })
const names = { [AWAY]: 'Boston Red Sox', [HOME]: 'New York Yankees' }

const story = player(6, 'Trevor Story', AWAY, 'SS')
const gray = player(10, 'Sonny Gray', AWAY)
const cole = player(5, 'Gerrit Cole', HOME)
const whitlock = player(2, 'Garrett Whitlock', AWAY)
const ikf = player(4, 'Isiah Kiner-Falefa', AWAY, '2B')
const contreras = player(9, 'Willson Contreras', AWAY, '1B')
const mcmahon = player(7, 'Ryan McMahon', HOME, '3B')
const volpe = player(8, 'Anthony Volpe', HOME, 'SS')
const sanchez = player(1, 'Ali Sánchez', HOME, 'C')
const goldschmidt = player(11, 'Paul Goldschmidt', HOME, '1B')
const rockies = club(115, 'Colorado Rockies', [2017, 2021])
const cardinals = club(138, 'St. Louis Cardinals', [2023, 2024])
const scranton = (seasons, level = 'AAA') => farm(531, 'Scranton/Wilkes-Barre RailRiders', seasons, level, HOME)
const redSox = (seasons) => club(AWAY, 'Boston Red Sox', seasons)
const worcester = farm(533, 'Worcester Red Sox', [2022], 'AAA', AWAY)
const yankees = (seasons) => club(HOME, 'New York Yankees', seasons)

// A frozen shard, read through the same path the card uses.
const fixture = (key, away, home) => {
  const shard = JSON.parse(readFileSync(new URL(`./fixtures/former-teammates/${key}.json`, import.meta.url)))
  return teammateLadder(formerTeammatePairs({ matchups: { [key]: shard.matchup } }, away, home), away, home)
}
const PADRES_BREWERS = fixture('135-158', 135, 158)
const RAYS_YANKEES = fixture('139-147', 139, 147)

test('nothing in, nothing out', () => {
  const empty = { groups: [], edges: [], clubs: {}, players: {}, formerOnly: [] }
  assert.deepEqual(teammateLadder([], AWAY, HOME), empty)
  assert.deepEqual(teammateLadder(undefined, AWAY, HOME), empty)
})

test('a pair on a third club is one edge, away player to home player', () => {
  const l = teammateLadder([pair(mcmahon, story, [rockies], 107)], AWAY, HOME)
  assert.deepEqual(l.edges, [{ away: story.id, home: mcmahon.id, club: 115, seasons: [2017, 2021] }])
  assert.deepEqual(l.groups, [{ away: [story.id], clubs: [115], home: [mcmahon.id], pinned: false, score: 107 }])
  assert.deepEqual(l.clubs[115], { teamId: 115, teamName: 'Colorado Rockies', level: 'MLB', seasons: [2017, 2021] })
  assert.deepEqual(l.players[story.id], {
    id: story.id,
    name: story.name,
    pos: 'SS',
    teamId: AWAY,
    starting: false,
    side: 'away',
    former: null,
  })
  assert.equal(l.players[mcmahon.id].side, 'home')
})

test('a pair on a third club and tonight’s club is one edge, on the third club', () => {
  const both = pair(story, mcmahon, [rockies, club(HOME, 'New York Yankees', [2024])])
  const l = teammateLadder([both], AWAY, HOME, undefined, names)
  assert.deepEqual(
    l.edges.map((e) => e.club),
    [115],
  )
  assert.equal(l.players[story.id].former, null, 'no badge: the pair is already an edge')
})

test('Buehler & May file under the Dodgers ’19–’22, their longest MLB stint', () => {
  const edge = PADRES_BREWERS.edges.find((e) => [e.away, e.home].includes(621111))
  assert.equal(edge.club, 119)
  assert.deepEqual(edge.seasons, [2019, 2020, 2021, 2022])
})

test('each club’s years are the union across its pairs; there is still one edge per pair', () => {
  const ties = [
    pair(story, mcmahon, [cardinals]),
    pair(contreras, goldschmidt, [club(138, 'St. Louis Cardinals', [2021, 2023])]),
  ]
  const l = teammateLadder(ties, AWAY, HOME)
  assert.deepEqual(l.clubs[138].seasons, [2021, 2023, 2024])
  assert.equal(l.edges.length, 2)
})

test('a club’s level is the highest level it was shared at', () => {
  const ties = [
    pair(story, mcmahon, [club(900, 'Isotopes', [2019], 'AA')]),
    pair(contreras, goldschmidt, [club(900, 'Isotopes', [2020], 'AAA')]),
  ]
  assert.equal(teammateLadder(ties, AWAY, HOME).clubs[900].level, 'AAA')
})

test('every player and every club is one node, in one group', () => {
  for (const l of [PADRES_BREWERS, RAYS_YANKEES]) {
    const inGroups = l.groups.flatMap((g) => [...g.away, ...g.home])
    assert.equal(new Set(inGroups).size, inGroups.length, 'no player in two groups')
    const clubIds = l.groups.flatMap((g) => g.clubs)
    assert.equal(new Set(clubIds).size, clubIds.length, 'no club in two groups')
    const sorted = (list) => list.map(Number).sort((x, y) => x - y)
    assert.deepEqual(sorted(clubIds), sorted(Object.keys(l.clubs)))
    assert.deepEqual(sorted([...inGroups, ...l.formerOnly]), sorted(Object.keys(l.players)))
  }
})

test('the node and edge counts match the frozen shards', () => {
  assert.deepEqual(
    [PADRES_BREWERS.edges.length, PADRES_BREWERS.groups.length, Object.keys(PADRES_BREWERS.clubs).length],
    [19, 6, 13],
  )
  assert.equal(Object.keys(PADRES_BREWERS.players).length, 25, "24 in groups, plus Lockridge")
  assert.deepEqual(
    [RAYS_YANKEES.edges.length, RAYS_YANKEES.groups.length, Object.keys(RAYS_YANKEES.clubs).length],
    [28, 2, 18],
  )
})

test('groups are the connected components of the player–club graph', () => {
  for (const l of [PADRES_BREWERS, RAYS_YANKEES]) {
    for (const g of l.groups) {
      // Walk out from the first club along the edges: it must reach the whole group.
      const reached = new Set()
      const queue = [`c${g.clubs[0]}`]
      while (queue.length) {
        const k = queue.pop()
        if (reached.has(k)) continue
        reached.add(k)
        for (const e of l.edges) {
          const ends = [`p${e.away}`, `c${e.club}`, `p${e.home}`]
          if (ends.includes(k)) queue.push(...ends)
        }
      }
      const want = [...g.away.map((i) => `p${i}`), ...g.home.map((i) => `p${i}`), ...g.clubs.map((i) => `c${i}`)]
      assert.deepEqual([...reached].sort(), want.sort())
    }
  }
})

test('a tie to tonight’s own org is a badge on the player who left it', () => {
  const l = teammateLadder([pair(whitlock, sanchez, [redSox([2024, 2025])])], AWAY, HOME, undefined, names)
  assert.deepEqual(l.edges, [])
  assert.deepEqual(l.groups, [])
  assert.deepEqual(l.formerOnly, [sanchez.id], 'Sánchez left the Red Sox; he is on the home side')
  assert.deepEqual(l.players[sanchez.id].former, {
    orgId: AWAY,
    teamName: 'Boston Red Sox',
    seasons: [2024, 2025],
    farmOnly: false,
  })
  assert.equal(l.players[whitlock.id], undefined, 'the player who stayed gets no node')
})

test('badge years are the union across his mates; farmOnly needs every stint on a farm club', () => {
  const ties = [pair(whitlock, volpe, [scranton([2019, 2020])], 30), pair(ikf, volpe, [scranton([2021], 'AA')], 20)]
  const farmOnly = teammateLadder(ties, AWAY, HOME, undefined, names)
  assert.deepEqual(farmOnly.players[whitlock.id].former, {
    orgId: HOME,
    teamName: 'New York Yankees system',
    seasons: [2019, 2020],
    farmOnly: true,
  })
  const mlb = pair(whitlock, sanchez, [club(HOME, 'New York Yankees', [2022])], 10)
  const mixed = teammateLadder([...ties, mlb], AWAY, HOME, undefined, names).players[whitlock.id].former
  assert.deepEqual(mixed, { orgId: HOME, teamName: 'New York Yankees', seasons: [2019, 2020, 2022], farmOnly: false })
})

test('a player with a former tie and an elsewhere tie is one node: a badge and an edge', () => {
  const ties = [pair(story, mcmahon, [rockies], 100), pair(whitlock, mcmahon, [redSox([2025])], 40)]
  const l = teammateLadder(ties, AWAY, HOME, undefined, names)
  assert.equal(l.edges.length, 1)
  assert.deepEqual(l.formerOnly, [], 'his edge keeps him in a group')
  assert.equal(l.groups.length, 1)
  assert.deepEqual(l.groups[0].home, [mcmahon.id])
  assert.equal(l.players[mcmahon.id].former.orgId, AWAY)
})

test('a former-only player goes into formerOnly and has no edges (Lockridge, Padres–Brewers)', () => {
  assert.deepEqual(PADRES_BREWERS.formerOnly, [663604])
  assert.equal(PADRES_BREWERS.players[663604].former.orgId, 135)
  assert.deepEqual(
    PADRES_BREWERS.edges.filter((e) => [e.away, e.home].includes(663604)),
    [],
  )
})

test('a group with a pair who both start is pinned first, and starters are marked', () => {
  const ties = [pair(story, mcmahon, [rockies], 100), pair(contreras, goldschmidt, [cardinals], 10)]
  const l = teammateLadder(ties, AWAY, HOME, new Set([contreras.id, goldschmidt.id, story.id]))
  assert.deepEqual(
    l.groups.map((g) => [g.clubs[0], g.pinned]),
    [
      [138, true],
      [115, false],
    ],
    'one Rockie starts; both Cardinals do',
  )
  assert.equal(l.players[contreras.id].starting, true)
  assert.equal(l.players[mcmahon.id].starting, false)
})

test('groups with no pinned pair run best score first', () => {
  const ties = [pair(contreras, goldschmidt, [cardinals], 10), pair(story, mcmahon, [rockies], 100)]
  assert.deepEqual(
    teammateLadder(ties, AWAY, HOME).groups.map((g) => g.score),
    [100, 10],
  )
})

test('a shard stored the other way round gives the same ladder', () => {
  const bare = ({ id, name, pos }) => ({ id, name, pos })
  const shard = (teamA, teamB, a, b) => ({
    matchups: {
      [`${AWAY}-${HOME}`]: {
        teamA,
        teamB,
        kind: 'teammates',
        rows: [{ a: bare(a), b: bare(b), score: 40, shared: [rockies] }],
      },
    },
  })
  const fwd = teammateLadder(formerTeammatePairs(shard(AWAY, HOME, story, mcmahon), AWAY, HOME), AWAY, HOME)
  const back = teammateLadder(formerTeammatePairs(shard(HOME, AWAY, mcmahon, story), AWAY, HOME), AWAY, HOME)
  assert.deepEqual(back, fwd)
  assert.deepEqual(back.edges, [{ away: story.id, home: mcmahon.id, club: 115, seasons: [2017, 2021] }])
})

test('on a MiLB matchup, tonight’s own club reads as itself, never as a “system”', () => {
  const NASHVILLE = 556
  const IOWA = 451
  const left = player(20, 'Left Nashville', IOWA)
  const stayed = player(21, 'Still a Sound', NASHVILLE)
  const sounds = farm(NASHVILLE, 'Nashville Sounds', [2025], 'AAA', 158)
  const milbNames = { [NASHVILLE]: 'Sounds', [IOWA]: 'Cubs' }
  const l = teammateLadder([pair(left, stayed, [sounds])], NASHVILLE, IOWA, undefined, milbNames)
  assert.deepEqual(l.players[left.id].former, { orgId: NASHVILLE, teamName: 'Sounds', seasons: [2025], farmOnly: false })
})

// --- the band layout ---

const LAYOUTS = [PADRES_BREWERS, RAYS_YANKEES].map((l) => [l, ladderLayout(l)])
const totalCrossings = (lay) => lay.bands.reduce((n, b) => n + b.crossings, 0)

test('layout: no two nodes in one column are closer than one row, and all stay inside their band', () => {
  for (const [, lay] of LAYOUTS) {
    for (const band of lay.bands) {
      for (const col of [band.L, band.C, band.R]) {
        const rows = Object.values(col).sort((x, y) => x - y)
        rows.forEach((r, i) => {
          assert.ok(r >= 0 && r <= band.rows - 1, `row ${r} outside 0..${band.rows - 1}`)
          if (i) assert.ok(r - rows[i - 1] >= 1, 'nodes closer than one row')
        })
      }
    }
  }
})

test('layout: every node is placed once, and the bands stack without a gap', () => {
  for (const [l, lay] of LAYOUTS) {
    const sorted = (list) => list.map(Number).sort((x, y) => x - y)
    assert.deepEqual(
      sorted(lay.bands.flatMap((b) => [...Object.keys(b.L), ...Object.keys(b.R)])),
      sorted(l.groups.flatMap((g) => [...g.away, ...g.home])),
    )
    assert.deepEqual(
      sorted(lay.bands.flatMap((b) => Object.keys(b.C))),
      sorted(Object.keys(l.clubs)),
    )
    lay.bands.forEach((b, i) => assert.equal(b.top, lay.bands.slice(0, i).reduce((n, x) => n + x.rows, 0)))
    assert.equal(lay.rows, lay.bands.reduce((n, b) => n + b.rows, 0))
  }
})

// Pinned on the frozen shards: a change here is a layout change to look at.
test('layout: crossings on the frozen shards', () => {
  assert.equal(totalCrossings(LAYOUTS[0][1]), 3)
  assert.equal(totalCrossings(LAYOUTS[1][1]), 29)
})

// --- carried over from the crossroads rows (teammateCrossroads, now gone) ---

test('every pair on one third club shares its club node; a player in two pairs is one node', () => {
  const l = teammateLadder([pair(contreras, goldschmidt, [cardinals], 99), pair(gray, goldschmidt, [cardinals], 60)], AWAY, HOME)
  assert.deepEqual(Object.keys(l.clubs), ['138'])
  assert.deepEqual(l.groups[0].away, [contreras.id, gray.id], 'best score first')
  assert.deepEqual(l.groups[0].home, [goldschmidt.id])
  assert.equal(l.groups[0].score, 99)
})

test('the player who left is found by org, from either side', () => {
  const l = teammateLadder([pair(story, cole, [worcester])], AWAY, HOME, undefined, names)
  assert.deepEqual(l.formerOnly, [cole.id], 'Cole left the Red Sox system')
  assert.deepEqual(l.players[cole.id].former, {
    orgId: AWAY,
    teamName: 'Boston Red Sox system',
    seasons: [2022],
    farmOnly: true,
  })
  assert.equal(l.players[story.id], undefined)
})

test('a missing team name falls back to the shared club’s own name', () => {
  const l = teammateLadder([pair(whitlock, volpe, [scranton([2019])])], AWAY, HOME)
  assert.equal(l.players[whitlock.id].former.teamName, 'Scranton/Wilkes-Barre RailRiders')
})

test('a shard with no orgId files a farm club as an edge, as before', () => {
  const bare = { ...scranton([2019]) }
  delete bare.orgId
  const l = teammateLadder([pair(whitlock, volpe, [bare])], AWAY, HOME, undefined, names)
  assert.deepEqual(l.formerOnly, [])
  assert.deepEqual(
    l.edges.map((e) => e.club),
    [531],
  )
  assert.equal(l.clubs[531].teamName, 'Scranton/Wilkes-Barre RailRiders')
})

test('a farm club of a THIRD org is an edge', () => {
  const phillies = farm(1234, 'Lehigh Valley IronPigs', [2019], 'AAA', 143)
  const l = teammateLadder([pair(story, mcmahon, [phillies])], AWAY, HOME, undefined, names)
  assert.deepEqual(l.edges, [{ away: story.id, home: mcmahon.id, club: 1234, seasons: [2019] }])
})

test('former-only players run starters first, then best score first', () => {
  // Pairs arrive best score first. Cole (id 5) outscores Kiner-Falefa (id 4).
  const ties = [pair(story, cole, [worcester], 90), pair(ikf, sanchez, [yankees([2022])], 5)]
  assert.deepEqual(teammateLadder(ties, AWAY, HOME, undefined, names).formerOnly, [cole.id, ikf.id])
  const l = teammateLadder(ties, AWAY, HOME, new Set([ikf.id]), names)
  assert.deepEqual(l.formerOnly, [ikf.id, cole.id], 'Kiner-Falefa starts')
  assert.equal(l.players[ikf.id].starting, true)
})

test('a shard stored the other way round still badges the player who left', () => {
  const bare = ({ id, name, pos }) => ({ id, name, pos })
  const data = {
    matchups: {
      [`${AWAY}-${HOME}`]: {
        teamA: HOME,
        teamB: AWAY,
        kind: 'teammates',
        // a = Sánchez (on HOME), b = Whitlock (on AWAY); they shared AWAY '25.
        rows: [{ a: bare(sanchez), b: bare(whitlock), score: 40, shared: [redSox([2025])] }],
      },
    },
  }
  const l = teammateLadder(formerTeammatePairs(data, AWAY, HOME), AWAY, HOME, undefined, names)
  assert.deepEqual(l.formerOnly, [sanchez.id], 'Sánchez left the Red Sox; Whitlock is still one')
  assert.equal(l.players[sanchez.id].side, 'home')
})

// #1353: a pair's club is chosen by level, then seasons shared, then recency.
// Read through a shard so formerTeammatePairs does the sorting.
const shownClub = (shared) => {
  const bare = ({ id, name, pos }) => ({ id, name, pos })
  const data = {
    matchups: {
      [`${AWAY}-${HOME}`]: {
        teamA: AWAY,
        teamB: HOME,
        kind: 'teammates',
        rows: [{ a: bare(story), b: bare(mcmahon), score: 50, shared }],
      },
    },
  }
  return teammateLadder(formerTeammatePairs(data, AWAY, HOME), AWAY, HOME).edges.map((e) => e.club)
}

test('two clubs at one level: the longer stint wins over the more recent one', () => {
  const dodgers = club(119, 'Los Angeles Dodgers', [2019, 2020, 2021, 2022])
  const cubs = club(112, 'Chicago Cubs', [2025])
  assert.deepEqual(shownClub([cubs, dodgers]), [119])
})

test('level still comes first: one MLB season beats two AAA seasons', () => {
  const mlb = club(115, 'Colorado Rockies', [2025])
  const aaa = club(1234, 'Albuquerque Isotopes', [2023, 2024], 'AAA')
  assert.deepEqual(shownClub([aaa, mlb]), [115])
})

test('same level and same season count: the more recent club still wins', () => {
  const older = club(115, 'Colorado Rockies', [2017, 2018])
  const newer = club(138, 'St. Louis Cardinals', [2023, 2024])
  assert.deepEqual(shownClub([older, newer]), [138])
})

// --- the trace ---

const ANDUJAR = 609280
const BAUERS = 641343
const SANCHEZ = 596142
const WILSON = 669060
const KING = 650633

test('tracing a player lights only his real partners, never a clubmate he did not overlap', () => {
  const t = traceOf(PADRES_BREWERS, `p${ANDUJAR}`)
  for (const id of [ANDUJAR, SANCHEZ, BAUERS, WILSON]) assert.ok(t.nodes.has(`p${id}`), `p${id} lit`)
  assert.ok(!t.nodes.has(`p${KING}`), 'King shares the Yankees box with Andujar but is not his pair')
  assert.ok(t.segments.has(`R147-${SANCHEZ}`), 'Yankees to Sánchez')
  assert.ok(t.segments.has(`R531-${BAUERS}`), 'Bauers lights through the RailRiders, their real tie')
  assert.ok(!t.segments.has(`R147-${BAUERS}`), 'not through the Yankees: King’s tie, not Andujar’s')
  assert.deepEqual(
    [...t.nodes].filter((k) => k[0] === 'c').sort(),
    ['c134', 'c147', 'c531'],
  )
})

test('tracing a club lights every pair on it', () => {
  const t = traceOf(PADRES_BREWERS, 'c147')
  for (const id of [ANDUJAR, KING, SANCHEZ, BAUERS]) assert.ok(t.nodes.has(`p${id}`), `p${id} lit`)
  assert.ok(t.segments.has(`R147-${BAUERS}`))
  assert.ok(!t.segments.has(`R531-${BAUERS}`))
})

test('a former-only player traces to himself; no key traces nothing', () => {
  assert.deepEqual([...traceOf(PADRES_BREWERS, 'p663604').nodes], ['p663604'])
  assert.equal(traceOf(PADRES_BREWERS, null), null)
})

// --- the pixel geometry ---

const columnsOf = (l) => ladderLayout(l).rows + l.formerOnly.length

test('geometry: sideways only when the card is wide AND every column gets 54px', () => {
  assert.equal(columnsOf(PADRES_BREWERS), 16)
  assert.equal(columnsOf(RAYS_YANKEES), 19)
  assert.equal(ladderGeometry(PADRES_BREWERS, 896).sideways, true)
  assert.equal(ladderGeometry(RAYS_YANKEES, 896).sideways, false, '19 × 54 = 1026 > 896')
  assert.equal(ladderGeometry(PADRES_BREWERS, 328).sideways, false)
  assert.equal(ladderGeometry(PADRES_BREWERS, SIDEWAYS_MIN - 1).sideways, false, 'a tablet-width card stays vertical')
})

test('geometry: the phone columns are 92 | 30 | 84 | 30 | 92 at 328px', () => {
  const g = ladderGeometry(PADRES_BREWERS, 328)
  const lefts = (side) => [...new Set(g.players.filter((p) => p.side === side).map((p) => p.box.left))]
  assert.deepEqual(lefts('away'), [0])
  assert.deepEqual(lefts('home'), [236])
  assert.ok(g.players.every((p) => p.box.width === 92 && p.box.height === 34))
  assert.ok(g.clubs.every((c) => c.box.left === 122 && c.box.width === 84 && c.box.height === 30))
})

test('geometry: a wider vertical card widens the club boxes, up to 120px', () => {
  const g = ladderGeometry(RAYS_YANKEES, 894)
  assert.equal(g.sideways, false)
  assert.ok(g.clubs.every((c) => c.box.width === 120 && c.box.left === (894 - 120) / 2))
})

test('geometry: sideways is 352px tall, one column per ladder row plus the former-only column', () => {
  const g = ladderGeometry(PADRES_BREWERS, 896)
  assert.equal(g.height, 352)
  assert.ok(g.players.every((p) => p.box.width === 56))
})

test('geometry: every node sits inside the card, and no two nodes in one lane overlap', () => {
  for (const l of [PADRES_BREWERS, RAYS_YANKEES]) {
    for (const width of [328, 600, 896, 1100]) {
      const g = ladderGeometry(l, width)
      for (const { box } of [...g.players, ...g.clubs]) {
        assert.ok(box.left >= -1e-9 && box.left + box.width <= width + 1e-9, `inside ${width}px across`)
        assert.ok(box.top >= 0 && box.top + box.height <= g.height, `inside ${g.height}px down`)
      }
      const lanes = [g.clubs, ...['away', 'home'].map((s) => g.players.filter((p) => p.side === s))]
      const [start, size] = g.sideways ? ['left', 'width'] : ['top', 'height']
      for (const lane of lanes) {
        const spans = lane.map(({ box }) => [box[start], box[start] + box[size]]).sort((x, y) => x[0] - y[0])
        spans.forEach(([s], i) => i && assert.ok(s >= spans[i - 1][1] - 1e-9, `overlap at ${width}px`))
      }
      assert.equal(g.players.length, Object.keys(l.players).length, 'every player drawn')
      assert.equal(g.clubs.length, Object.keys(l.clubs).length, 'every club drawn')
    }
  }
})

test('geometry: one line per distinct player–club link', () => {
  const g = ladderGeometry(PADRES_BREWERS, 328)
  const keys = new Set(PADRES_BREWERS.edges.flatMap((e) => [`L${e.away}-${e.club}`, `R${e.club}-${e.home}`]))
  assert.deepEqual(g.segments.map((s) => s.key).sort(), [...keys].sort())
  assert.ok(g.segments.every((s) => /^M[\d.]+ [\d.]+ C/.test(s.d)))
})

// --- the labels ---

test('a club box shows the club’s nickname, kept as it was in those seasons', () => {
  const mariners = { name: 'Seattle Mariners', teamName: 'Mariners' }
  assert.equal(clubShortName('Seattle Mariners', mariners), 'Mariners')
  const ponies = { name: 'Binghamton Rumble Ponies', teamName: 'Rumble Ponies' }
  assert.equal(clubShortName('Binghamton Mets', ponies), 'Mets', 'the name it had then, less the city')
  assert.equal(clubShortName('Oakland Athletics', { name: 'Athletics', teamName: 'Athletics' }), 'Athletics', 'a club with no city now')
  assert.equal(clubShortName('Seattle Mariners', undefined), 'Seattle Mariners', 'an unknown club keeps the full name')
})

test('seasons read as a two-digit span', () => {
  assert.equal(seasonRange([2023, 2022]), '’22–’23')
  assert.equal(seasonRange([2021]), '’21')
  assert.equal(seasonRange([]), '')
})
