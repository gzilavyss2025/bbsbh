// splitGameNotes (src/api/boxscore.js) — which club each info-block row lands
// under in the box score, and the parse that decides it.
//
// The reported bug: a Twins batter hit by TWO different Brewers pitchers read
// "Culpepper, K 2 (by Gasser, by Patrick)" and fell into the shared foot at
// the very bottom of the sheet instead of a club's own block (gamePk 823752,
// 2026-08-08). Three separate parse failures put rows in that foot, and a
// sweep of 157 real games (MLB + sportIds 11-14, 2026-08-07/08) found every
// one of them in the wild — each is pinned below with its real feed text:
//
//   HBP  10 games — a double plunk, "(by A, by B)"
//   WP   22 games — a bare count with no parenthetical, "Seymour, C 2"
//   Balk  5 games — a suffix name closing the row, "Balboni Jr."
//
// Plus one row type that was in no split set at all and so ALWAYS landed in
// the foot: "Disengagement violations".
//
// The attribution rule these tests pin: a row goes to the club of the player
// it NAMES FIRST — the man the note is about. For HBP and IBB that is the
// batter, so those two read in his club's BATTING notes; every other row
// leads with a pitcher and stays in his club's pitching notes.
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectBoxscore } from '../src/api/boxscore.js'

// A feed carrying only what splitGameNotes reads: both rosters (keyed by the
// exact boxscoreName the info text uses) and the info block itself.
function makeFeed({ away = [], home = [], info = [], awayInfo = [], homeInfo = [] }) {
  const players = {}
  const boxPlayers = { away: {}, home: {} }
  let n = 0
  for (const [side, names] of [
    ['away', away],
    ['home', home],
  ]) {
    for (const boxscoreName of names) {
      const key = `ID${(n += 1)}`
      players[key] = { id: n, boxscoreName }
      boxPlayers[side][key] = {}
    }
  }
  return {
    gameData: {
      teams: { away: { id: 142, name: 'Minnesota Twins' }, home: { id: 158, name: 'Milwaukee Brewers' } },
      players,
    },
    liveData: {
      linescore: { innings: [] },
      boxscore: {
        info,
        teams: {
          away: { team: { id: 142 }, players: boxPlayers.away, info: awayInfo, note: [] },
          home: { team: { id: 158 }, players: boxPlayers.home, info: homeInfo, note: [] },
        },
      },
    },
  }
}

const battingRows = (side) => side.notes.find((g) => g.title === 'BATTING')?.rows ?? []
const noteValue = (rows, label) => rows.find((r) => r.label === label)?.value
const footLabels = (box) => box.footNotes.map((r) => r.label)

// --- The reported bug ------------------------------------------------------

test('a batter hit twice, by two different pitchers, lands on his own club', () => {
  // gamePk 823752 verbatim. Culpepper and Martin are Twins; Contreras is a
  // Brewer. Every one of the three belongs to a club, so the foot stays empty.
  const box = selectBoxscore(
    makeFeed({
      away: ['Culpepper, K', 'Martin', 'Bradley, T'],
      home: ['Gasser', 'Patrick', 'Contreras, Wm'],
      info: [
        {
          label: 'HBP',
          value:
            'Culpepper, K 2 (by Gasser, by Patrick); Martin (by Gasser); Contreras, Wm (by Bradley, T).',
        },
      ],
    }),
  )
  assert.deepEqual(footLabels(box), [])
  assert.equal(
    noteValue(battingRows(box.away), 'HBP'),
    'Culpepper, K 2 (by Gasser, by Patrick); Martin (by Gasser).',
  )
  assert.equal(noteValue(battingRows(box.home), 'HBP'), 'Contreras, Wm (by Bradley, T).')
})

test('HBP reads in the batter club’s BATTING notes, never the pitching notes', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Culpepper, K'],
      home: ['Gasser'],
      info: [{ label: 'HBP', value: 'Culpepper, K 2 (by Gasser, by Patrick).' }],
    }),
  )
  assert.equal(noteValue(battingRows(box.away), 'HBP'), 'Culpepper, K 2 (by Gasser, by Patrick).')
  assert.deepEqual(box.away.pitchNotes, [])
  assert.deepEqual(box.home.pitchNotes, [])
  assert.deepEqual(battingRows(box.home), [])
})

test('HBP sits above the Team totals that close the BATTING group', () => {
  // The feed's own BATTING rows end with the club-level "Team RISP"/"Team LOB"
  // tallies. A per-batter note reads with the other per-batter notes, ahead of
  // them, not tacked on after the group's footer.
  const box = selectBoxscore(
    makeFeed({
      away: ['Culpepper, K'],
      home: ['Gasser'],
      info: [{ label: 'HBP', value: 'Culpepper, K (by Gasser).' }],
      awayInfo: [
        {
          title: 'BATTING',
          fieldList: [
            { label: '2B', value: 'Keaschall (16, Gasser).' },
            { label: 'Team RISP', value: '1-for-7.' },
            { label: 'Team LOB', value: '8.' },
          ],
        },
      ],
    }),
  )
  assert.deepEqual(
    battingRows(box.away).map((r) => r.label),
    ['2B', 'HBP', 'Team RISP', 'Team LOB'],
  )
})

test('an intentional walk follows its batter too', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Holliday'],
      home: ['Silseth'],
      info: [{ label: 'IBB', value: 'Holliday (by Silseth).' }],
    }),
  )
  assert.equal(noteValue(battingRows(box.away), 'IBB'), 'Holliday (by Silseth).')
  assert.deepEqual(footLabels(box), [])
})

// --- The other two parse failures the same sweep turned up ------------------

test('a wild-pitch count with no parenthetical still finds its pitcher', () => {
  // gamePk 823188. "Seymour, C 2" — two wild pitches, no "(detail)" to close
  // the entry, which is the shape 22 of 157 games carried.
  const box = selectBoxscore(
    makeFeed({
      away: ['Seymour, C'],
      home: ['Gasser'],
      info: [
        { label: 'WP', value: 'Seymour, C 2.' },
        { label: 'Balk', value: 'Gasser 2.' },
      ],
    }),
  )
  assert.deepEqual(footLabels(box), [])
  assert.equal(noteValue(box.away.pitchNotes, 'WP'), 'Seymour, C 2.')
  assert.equal(noteValue(box.home.pitchNotes, 'Balk'), 'Gasser 2.')
})

test('a suffix name closing a row keeps both its period and its club', () => {
  // gamePk 822129. The row's terminating period is the SAME character as the
  // suffix's own, so stripping one must not cost the other.
  const box = selectBoxscore(
    makeFeed({
      away: ['Serna, L', 'MacGregor', 'Balboni Jr.'],
      home: ['Gasser'],
      info: [{ label: 'WP', value: 'Serna, L 2; MacGregor; Balboni Jr.' }],
    }),
  )
  assert.deepEqual(footLabels(box), [])
  assert.equal(noteValue(box.away.pitchNotes, 'WP'), 'Serna, L 2; MacGregor; Balboni Jr.')
})

test('a suffix name alone on its row is attributed, not orphaned', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Balboni Jr.'],
      home: ['Gasser'],
      info: [{ label: 'Balk', value: 'Balboni Jr.' }],
    }),
  )
  assert.deepEqual(footLabels(box), [])
  assert.equal(noteValue(box.away.pitchNotes, 'Balk'), 'Balboni Jr.')
})

test('a disengagement violation is attributed like every other per-pitcher row', () => {
  // gamePk 823426. Previously in no split set at all, so it reached the foot
  // in every game that had one.
  const box = selectBoxscore(
    makeFeed({
      away: ['Estrada, L'],
      home: ['Gasser'],
      info: [{ label: 'Disengagement violations', value: 'Estrada, L.' }],
    }),
  )
  assert.deepEqual(footLabels(box), [])
  assert.equal(noteValue(box.away.pitchNotes, 'Disengagement violations'), 'Estrada, L.')
})

// --- The foot still catches what it should ---------------------------------

test('a name no roster claims still falls to the shared foot, never guessed onto a club', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Seymour, C'],
      home: ['Gasser'],
      info: [{ label: 'WP', value: 'Seymour, C 2; Nobody, Q.' }],
    }),
  )
  assert.equal(noteValue(box.away.pitchNotes, 'WP'), 'Seymour, C 2.')
  assert.equal(noteValue(box.footNotes, 'WP'), 'Nobody, Q.')
})

test('a whole-game row with no player in it stays in the foot', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Seymour, C'],
      home: ['Gasser'],
      info: [
        { label: 'Ejections', value: 'Braves manager Walt Weiss ejected by HP umpire Dan Merzel (5th).' },
      ],
    }),
  )
  assert.deepEqual(footLabels(box), ['Ejections'])
})

test('ABS challenges and pitch-timer violations still read on the challenger’s own club', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Keaschall'],
      home: ['Contreras, Wm'],
      info: [
        {
          label: 'ABS Challenge',
          value: 'Contreras, Wm (Ball-Overturned to Strike); Keaschall (Strike-Confirmed).',
        },
        { label: 'Pitch timer violations', value: 'Keaschall (batter timer).' },
      ],
    }),
  )
  assert.deepEqual(footLabels(box), [])
  assert.equal(noteValue(box.away.pitchNotes, 'ABS Challenge'), 'Keaschall (Strike-Confirmed).')
  assert.equal(
    noteValue(box.home.pitchNotes, 'ABS Challenge'),
    'Contreras, Wm (Ball-Overturned to Strike).',
  )
  assert.equal(noteValue(box.away.pitchNotes, 'Pitch timer violations'), 'Keaschall (batter timer).')
})

test('a repeat ABS challenger keeps his count and his club', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Valenzuela'],
      home: ['Gasser'],
      info: [
        { label: 'ABS Challenge', value: 'Valenzuela 2 (Ball-Overturned to Strike, Ball-Confirmed).' },
      ],
    }),
  )
  assert.equal(
    noteValue(box.away.pitchNotes, 'ABS Challenge'),
    'Valenzuela 2 (Ball-Overturned to Strike, Ball-Confirmed).',
  )
})

test('the per-pitcher stat rows are unmoved — each pitcher on his own club', () => {
  const box = selectBoxscore(
    makeFeed({
      away: ['Bradley, T'],
      home: ['Gasser'],
      info: [
        { label: 'Pitches-strikes', value: 'Bradley, T 97-62; Gasser 94-60.' },
        { label: 'Inherited runners-scored', value: 'Gasser 1-0.' },
      ],
    }),
  )
  assert.equal(noteValue(box.away.pitchNotes, 'Pitches-strikes'), 'Bradley, T 97-62.')
  assert.equal(noteValue(box.home.pitchNotes, 'Pitches-strikes'), 'Gasser 94-60.')
  assert.equal(noteValue(box.home.pitchNotes, 'Inherited runners-scored'), 'Gasser 1-0.')
})
