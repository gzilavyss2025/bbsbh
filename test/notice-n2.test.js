// N2 of the Notice collapse (#1132): the nine bare error lines on open pages move
// onto Notice. Read from the source text, the way notice-cascade.test.js does.
// None of these pages scores a game, so no seal pin is needed: the test only
// checks that the copy, the tone, the size, the role and WHEN each line shows
// stay as they were.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(`styles/${rel}`))
// One space for any run of white space, and none next to a tag, so a one-line and a wrapped element compare equal.
const squash = (s) => s.replace(/\s+/g, ' ').replace(/> /g, '>').replace(/ </g, '<')

// [file, the opening tag the Notice must wear, the sentence, the test that decides WHEN it shows]
const SITES = [
  ['App.jsx', '<Notice tone="error" className="appstate__notice">', 'Couldn’t load the schedule. Check your connection and try again.', 'if (resolved.error) {'],
  ['App.jsx', '<Notice tone="error" className="appstate__notice">', 'Couldn’t find that game. It may not be on the schedule for that date.', 'if (!resolved.data) {'],
  ['screens/FirstScorebookPage.jsx', '<Notice tone="error" className="scorebookstory__notice">', 'Couldn’t open the scorebook archive.', 'if (!data) {'],
  ['screens/PostseasonSeriesPage.jsx', '<Notice tone="error" size="compact" className="psseries__entryerror">', 'Couldn’t load this game’s result.', null],
  ['screens/postseason-live/LiveSeriesPage.jsx', '<Notice tone="error" size="compact" className="psseries__entryerror">', 'Couldn’t load this game’s result.', null],
  ['screens/postseason-live/LiveSeriesPage.jsx', '<Notice tone="error" className="pslive__notice">', 'Couldn’t load this series’ leaders and rosters.', '{logError && !stats && results.length > 0 && ('],
  ['screens/scout/ScoutPage.jsx', '<Notice tone="error" className="scout__notice">', 'Couldn’t load this pair', '{hasPair && !load.loading && !data && <Notice '],
  ['screens/team/StampInPage.jsx', '<Notice tone="error" size="compact">', 'Couldn’t load this game’s result.', ') : failed ? ('],
  ['screens/game-notes/GameNotesArchivePage.jsx', '<Notice tone="error" role="status" className="gnotes__notice">', 'Couldn’t build the link list. Try again.', '{csv.error && ('],
]

for (const [file, tag, text, gate] of SITES) {
  test(`${file}: "${text}" is a ${tag}`, () => {
    const code = squash(src(file))
    assert.ok(code.includes(squash(`${tag} ${text} </Notice>`)), 'the Notice wears its tone, size, role and namespace, and the sentence is unchanged')
    if (gate) assert.ok(code.includes(squash(gate)), 'the test that decides WHEN the line shows stays in the caller')
  })
}

test('no hint--error is left on the nine lines, and each file imports Notice', () => {
  for (const file of new Set(SITES.map((s) => s[0]))) {
    const code = src(file)
    assert.doesNotMatch(code, /hint--error/, `${file} has no bare error line`)
    assert.match(code, /import \{ Notice \} from '(\.\.?\/)+components\/ui\/state\/Notice\.jsx'/, `${file} imports Notice`)
  }
})

test('App keeps its two buttons below the schedule Notice, as siblings (Notice holds one control)', () => {
  const code = squash(src('App.jsx'))
  assert.ok(code.includes(squash('</Notice> <button className="btn" onClick={resolved.reload}> Retry </button> <button className="btn btn--ghost" onClick={onHome}> Back to games </button>')))
  assert.doesNotMatch(code, /<Notice[^>]*action=/)
})

test('the series pages hook the grid through a namespace class, not through .hint--error', () => {
  const css35 = css('35-postseason-series.css')
  assert.doesNotMatch(css35, /hint--error/)
  assert.match(css35, /\.psseries__entry \.psseries__entryerror\s*\{\s*grid-column: 1 \/ -1;\s*\}/)
})

test('each block parent spaces its Notice in its own namespace, never in Notice', () => {
  const want = [
    ['02-app-shell.css', '.screen .appstate__notice'],
    ['42-first-scorebook.css', '.scorebookstory__notice'],
    ['postseason/series-live.css', '.pslive__notice'],
    ['scout/scout.css', '.scout__notice'],
    ['report/game-notes.css', '.gnotes__notice'],
  ]
  for (const [file, sel] of want) {
    const body = ruleBody(css(file), sel)
    assert.ok(body, `${file} has ${sel}`)
    assert.match(body, /margin:\s*var\(--space-3\) 0/, `${sel} gives the 12px the old .hint padding gave`)
  }
})
