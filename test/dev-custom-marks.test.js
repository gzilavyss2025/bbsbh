// The dev-only recolored-mark library (scripts/lib/dev-custom-marks.mjs,
// ADR-0029). These cover the two promises the editor makes about it: saving
// never destroys a mark somebody kept, and a request can't reach the
// filesystem with a name it chose.
import assert from 'node:assert/strict'
import test from 'node:test'
import { describeMarkRejection, resolveCustomMarkFile } from '../scripts/lib/dev-custom-marks.mjs'

test('markup has to be an SVG, and one with nothing executable in it', () => {
  assert.equal(describeMarkRejection('<svg viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>'), null)
  assert.match(describeMarkRejection('{"not":"art"}'), /not an SVG/)
  assert.match(describeMarkRejection('<svg viewBox="0 0 1 1"><path/>'), /truncated/)
  assert.match(describeMarkRejection('<svg><path onclick="x()"/></svg>'), /event handler/)
})

test('anything script-shaped is refused, in whatever casing or spelling', () => {
  // The gate is a substring test rather than a tag pattern on purpose — the
  // shapes that defeat a tag pattern (odd casing, whitespace inside the closing
  // tag, a nested tag that re-forms after a naive strip) all still land here.
  for (const markup of [
    '<svg><script>x()</script></svg>',
    '<svg><SCRIPT>x()</SCRIPT></svg>',
    '<svg><script\n>x()</script\t\n foo></svg>',
    '<svg><scr<script>ipt>x()</svg>',
  ]) {
    assert.match(describeMarkRejection(markup), /script/, markup)
  }
})

test('the destination is rebuilt from the id and slug, and refuses anything else', () => {
  // Compared with separators normalised — this runs on Windows and CI Linux.
  const resolved = resolveCustomMarkFile(109, 'serpent-red').split('\\').join('/')
  assert.match(resolved, /\/public\/team-logos\/custom\/109-serpent-red\.svg$/)
  // A slug that escaped markSlug (or a hand-crafted POST) must not resolve —
  // the same defense-in-depth resolveLogoFile/resolveStoreFile apply.
  assert.throws(() => resolveCustomMarkFile(109, '../../../evil'), /not writable/)
  assert.throws(() => resolveCustomMarkFile(109, 'a/b'), /not writable/)
  assert.throws(() => resolveCustomMarkFile(0, 'ok'), /not writable/)
})
