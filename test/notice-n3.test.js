// Notice collapse slice N3 (#1132): six notices on open pages move onto Notice.
// Asserted from the source text, the way notice-cascade.test.js does. None of the
// six sites is on a scoring surface; none imports a reveal-only module.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(`styles/${rel}`))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

const SITES = [
  { file: 'screens/GamePhotosPage.jsx', open: '<Notice tone="caution" label="Unsealed" role="note" className="gamephotos__notice">', gone: /gamephotos__noticetag/ },
  { file: 'screens/team/TeamPhotosPage.jsx', open: '<Notice tone="caution" label="Unsealed" role="note" className="gamephotos__notice">', gone: /gamephotos__noticetag/ },
  { file: 'components/game/GameFinder.jsx', open: '<Notice tone="caution" role="status" size="compact" className="gamefinder__notice">', gone: /className="hint">Pick two/ },
  { file: 'components/profile/EraseDataDialog.jsx', open: '<Notice tone="error" role="status" className="erasesheet__error">', gone: /hint hint--error/ },
  { file: 'screens/profile/sections/ClubSection.jsx', open: '<Notice tone="error" role="note" className="mytally__notice">', gone: /className="hint caps-exempt"/ },
  { file: 'screens/AllStarLegacyPage.jsx', open: '<Notice tone="error" role="status">', gone: /className="hint">Couldn’t determine/ },
]

for (const { file, open, gone } of SITES) {
  test(`${file}: the old markup is gone and a Notice sits in its place`, () => {
    const code = src(file)
    assert.ok(code.includes(open), `${file} renders ${open}`)
    assert.match(code, /import \{ Notice \} from '[./]+(\/components)?\/ui\/state\/Notice\.jsx'/)
    assert.doesNotMatch(code, gone)
    assert.doesNotMatch(code, /from '[^']*\/api\/(linescore|derive|hitchart)/, 'no reveal-only import')
  })
}

test('the two photos pages keep the sentence word for word', () => {
  assert.match(src('screens/GamePhotosPage.jsx'), /A photo here can show the result at a glance, so unlike the rest of\s+Tally Baseball, nothing on this page is spoiler-safe\. Personal use\s+only — photos are copyrighted \(AP\/Getty\/USA Today Sports via MLB\)\./)
  assert.match(src('screens/team/TeamPhotosPage.jsx'), /Every professional photo MLB’s content package carries for the \{season\} season, newest\s+first — including tonight’s game, if one’s in progress\. Personal use only — photos are\s+copyrighted \(AP\/Getty\/USA Today Sports via MLB\)\./)
})

test('14-strike-zone.css: the tag and paragraph rules are deleted; the namespace keeps the margin and no edge (Notice draws it)', () => {
  const sheet = css('14-strike-zone.css')
  assert.equal(ruleBody(sheet, '.gamephotos__noticetag'), null)
  assert.equal(ruleBody(sheet, '.gamephotos__notice p'), null)
  const ns = ruleBody(sheet, '.gamephotos__notice')
  assert.equal(decl(ns, 'margin'), '4px 0 var(--space-4)')
  assert.equal(decl(ns, 'border-style'), undefined, 'the dashed-rule fix (#1132, Gary 2026-10-07) went solid: Notice draws the edge')
  for (const p of ['display', 'padding', 'background', 'border-radius', 'gap']) assert.equal(decl(ns, p), undefined, `Notice draws ${p}`)
})

test('the finder and club-list notices take their space from a margin-only namespace', () => {
  assert.equal(decl(ruleBody(css('08-site-shell.css'), '.gamefinder__notice'), 'margin-top'), 'var(--space-3)')
  assert.equal(decl(ruleBody(css('54-my-tally.css'), '.mytally__notice'), 'margin-top'), 'var(--space-3)')
})

test('the erase error namespace stays margin-only', () => {
  const body = ruleBody(css('55-my-tally-account.css'), '.erasesheet__error')
  assert.equal(decl(body, 'margin'), '0 0 var(--space-3)')
})

test('54-my-tally.css: the Notice text is on the caps-exempt selectors, with no bare text-transform', () => {
  const sheet = src('styles/54-my-tally.css')
  assert.match(sheet, /#root \.erasesheet \.notice__text/)
  assert.match(sheet, /#root \.mytally \.notice__text/)
  assert.match(sheet, /text-transform: none; \/\* caps-exempt:/)
})
