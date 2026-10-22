// The Film room names a pitcher with a PlayerLink, the app's name link, and never
// with a Door (the "there is more behind this" link, drawn "See all ›").
//
// The name was a Door, and `.ww-film__name { color: inherit }` meant to draw it as
// plain ink "like the box score's names". That rule has the same specificity as
// `.door--inline`, which comes later in the sheet, so it never applied: the names
// drew in link green at label size. A name link already has its own rule, and the
// box score uses it for these same two pitchers. Asserted from the source text,
// where it is always true or always false, rather than from a render.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (path) => readFileSync(join(SRC, path), 'utf8')

test('the starter name is a PlayerLink, not a Door', () => {
  const jsx = read('components/worldseries/cards/scouting/FilmMeeting.jsx')
  assert.match(jsx, /<PlayerLink[^>]*ww-film__name/, 'the name should be a PlayerLink')
  assert.doesNotMatch(jsx, /<Door[^>]*ww-film__name/, 'a player name is never a Door')
})

test('the name rule is compound, so it beats .plink instead of tying with it', () => {
  const css = read('styles/worldseries/film.css')
  assert.match(css, /\.plink\.ww-film__name\s*\{/, 'compound with .plink, as the other name links are')
  assert.doesNotMatch(css, /(^|[\n,}])\.ww-film__name\s*\{/, 'a bare .ww-film__name rule loses the tie')
})
