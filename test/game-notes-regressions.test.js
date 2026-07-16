import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { extractForTeam } from '../src/api/whatsBrewing.js'

const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/game-notes-regressions.json', import.meta.url), 'utf8'),
)

for (const fixture of fixtures) {
  test(`Game Notes: ${fixture.name}`, () => {
    const realName = (fontName) => fixture.fonts[fontName] ?? ''
    assert.deepEqual(extractForTeam(fixture.items, realName, fixture.teamId), fixture.expected)
  })
}
