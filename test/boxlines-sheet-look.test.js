// The Box Lines sheet in the stamped look (ADR-0115): a club band over the head, a stamped close
// and back control, an ink rule at each new season, the club's cap logo in full colour, and a
// round pill that names its league. This pins the pure parts (the season rule, the band, the
// round's name) and the markup and styles that carry the rest.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { boxLineRows, POSTSEASON, seriesAbbr } from '../src/api/boxlines/rows.js'
import { bandFor } from '../src/components/boxlines/bandFor.js'
import { startsSeason } from '../src/components/boxlines/seasons.js'

const read = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

// A hitting game-log split, trimmed to what rows.js reads (the shape rows.test.js uses).
function split(date, gamePk, extra = {}) {
  return {
    date,
    gameType: 'D',
    isHome: true,
    team: { id: 158, name: 'Milwaukee Brewers' },
    opponent: { id: 135, name: 'San Diego Padres' },
    game: { gamePk, gameNumber: 1, dayNight: 'night' },
    stat: { gamesStarted: 1, atBats: 4, hits: 1, runs: 0, rbi: 0, baseOnBalls: 0, strikeOuts: 1 },
    ...extra,
  }
}
function sched(gamePk, officialDate) {
  return {
    gamePk,
    officialDate,
    gameNumber: 1,
    dayNight: 'night',
    status: { abstractGameState: 'Final' },
    venue: { id: 32, name: 'American Family Field' },
    teams: {
      away: { score: 2, team: { id: 135, abbreviation: 'SD' } },
      home: { score: 3, team: { id: 158, abbreviation: 'MIL' } },
    },
  }
}

test('a postseason row names its league: NLWC, NLDS, NLCS, and the World Series stays WS', () => {
  const NL = { league: { id: 104 } }
  const splits = [
    split('2026-10-01', 1, { ...NL, gameType: 'F' }),
    split('2026-10-04', 2, { ...NL, gameType: 'D' }),
    split('2026-10-12', 3, { ...NL, gameType: 'L' }),
    split('2026-10-26', 4, { ...NL, gameType: 'W' }),
  ]
  const schedule = [1, 2, 3, 4].map((n, i) => sched(n, splits[i].date))
  const rows = boxLineRows({ splits, schedule, group: 'hitting', gameTypes: POSTSEASON })
  assert.deepEqual(
    rows.map((r) => r.series),
    ['WS', 'NLCS', 'NLDS', 'NLWC'],
  )
})

test('an American League club says AL, and a split with no league keeps the plain round', () => {
  const rows = boxLineRows({
    splits: [split('2026-10-04', 1, { league: { id: 103 } }), split('2026-10-06', 2)],
    schedule: [sched(1, '2026-10-04'), sched(2, '2026-10-06')],
    group: 'hitting',
    gameTypes: POSTSEASON,
  })
  assert.deepEqual(
    rows.map((r) => r.series),
    ['DS', 'ALDS'],
  )
  assert.equal(seriesAbbr('D', 'AL'), 'ALDS')
})

test('a new season starts where the year changes, and never on the first row', () => {
  const rows = [{ season: 2025 }, { season: 2025 }, { season: 2024 }, { season: 2023 }, { season: 2023 }]
  assert.deepEqual(
    rows.map((_, i) => startsSeason(rows, i)),
    [false, false, true, true, false],
  )
  assert.equal(startsSeason([{ season: 2026 }], 0), false)
})

test('the band takes the club mark and the theme it is handed, and the house navy with none', () => {
  assert.equal(bandFor(null), null)
  assert.equal(bandFor(undefined, { bar: '#000000' }), null)
  const theme = { bar: '#002d72', accent: '#e81828', onBar: '#f8f8f5', onBarTone: 'light' }
  const band = bandFor(143, theme)
  assert.equal(band.teamId, 143)
  assert.equal(band.style['--bar-fill'], '#002d72')
  assert.equal(band.style['--bar-accent'], '#e81828')
  assert.equal(band.style['--bar-text'], '#f8f8f5')
  // A club with no curated colours (a null theme) keeps its mark and gets no colour, so the CSS
  // fallbacks give the house navy.
  const bare = bandFor(143, null)
  assert.equal(bare.teamId, 143)
  assert.equal(bare.style, undefined)
})

test('the sheet draws the band and the stamped close; a door of figures leads with its grid', () => {
  const sheet = read('components/boxlines/BoxLinesSheet.jsx')
  assert.match(sheet, /className="boxlines__band sectionhead--band" style=\{band\?\.style\}/)
  assert.match(sheet, /label="Close" className="boxlines__close"/)
  assert.match(sheet, /<p className="boxlines__note">\{headNote\}<\/p>/, 'the note moved into the band')
  assert.match(sheet, /const lead = !picked && !listing && cells \? cells : null/)
  assert.match(sheet, /\{head && !lead && <p className="boxlines__headline">/, 'the grid replaces the line, never both')
  assert.doesNotMatch(sheet, /seasonBand/)
  const door = read('components/boxlines/GameLinesDoor.jsx')
  assert.match(door, /className="boxlines__band sectionhead--band"/)
  assert.match(door, /startsSeason\(rows, i\)/)
})

test('a row wears the cap logo in full colour and an ink rule at a new season', () => {
  const row = read('components/boxlines/BoxLineRow.jsx')
  assert.match(row, /variant="cap"/)
  assert.doesNotMatch(row, /variant="mono"/)
  assert.match(row, /boxline--new/)
  assert.doesNotMatch(row, /boxline--band/)
  const css = read('styles/boxlines/boxlines.css')
  assert.doesNotMatch(css, /boxline--band/)
  assert.match(css, /\.boxline--new \{\s*border-top: var\(--bw-rule\) solid var\(--border-stamped\);/)
  const mark = css.slice(css.indexOf('.boxline__mark img {'), css.indexOf('}', css.indexOf('.boxline__mark img {')))
  assert.doesNotMatch(mark, /filter|opacity/, 'the black re-ink is gone')
})

test('the sheet, the list and the figure grid are stamped: square, an ink edge, a hard shadow', () => {
  const sheet = read('styles/boxlines/boxlines.css')
  const list = read('styles/boxlines/listdoor.css')
  assert.match(sheet, /\.boxlines \{[^}]*border-top: var\(--bw-heavy\) solid var\(--border-stamped\);[^}]*border-radius: var\(--radius-square\);[^}]*box-shadow: none;/)
  assert.match(sheet, /\.boxlines__headline \{[^}]*box-shadow: var\(--shadow-stamped\);/)
  assert.match(list, /\.boxlines__list \{[^}]*box-shadow: var\(--shadow-stamped\);/)
  assert.match(list, /\.boxlines__stats \{[^}]*repeat\(var\(--cols, 4\), 1fr\)[^}]*box-shadow: var\(--shadow-stamped\);/)
  assert.doesNotMatch(list, /nth-child\(even\)/, 'no banding in the list')
})

test('the lineup page hands the sheet its own band and the five figures of its door', () => {
  const card = read('screens/lineup/next/cards/StarterCard.jsx')
  assert.match(card, /band: bandFor\(oppMeta\.id, theme\)/)
  assert.match(card, /cells: \{ title: `Career vs \$\{data\.vsOpponentAbbr\}`, items: careerCells\(data\.careerVsOpp\) \}/)
  assert.match(read('screens/player/next/modules/splits/VsTeam.jsx'), /band: bandFor\(bio\.team\?\.id\)/)
  assert.match(read('screens/player/next/modules/splits/GameLines.jsx'), /band: bandFor\(bio\.team\?\.id\)/)
})

test('both game-log requests ask for the split league, or the pill could not name it', () => {
  const fetchSrc = read('api/boxlines/fetch.js')
  const lists = fetchSrc.match(/'fields=stats,splits,date,gameType,isHome,isWin,opponent,id,team,league,game,gamePk,gameNumber,'/g)
  assert.equal(lists?.length, 2, 'the pitching list and the hitting list')
})
