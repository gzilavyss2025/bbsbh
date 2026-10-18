// A <button> does not inherit its text colour: each browser's own stylesheet gives it one.
// iOS Safari's is system blue, so the Starting Pitcher card's "Career vs" strip (a Box Lines
// door) printed its title and figures in blue on the phone, while Chromium's black hid it on
// the desktop. The base sheet hands every button its parent's ink, at zero specificity so any
// colour a component states still wins.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { ruleBody, stripComments } from './helpers/css.js'

const css = stripComments(fs.readFileSync(new URL('../src/styles/01-base.css', import.meta.url), 'utf8'))

test('every button takes its ink from its parent, not the browser', () => {
  const body = ruleBody(css, ':where(button)')
  assert.ok(body, ':where(button) rule exists in 01-base.css')
  assert.match(body, /(^|;|\s)color:\s*inherit\s*;/)
})
