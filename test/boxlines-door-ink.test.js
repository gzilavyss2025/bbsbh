// The Box Lines door is a <button>, and a button does not inherit its text colour: each
// browser's own stylesheet gives it one. iOS Safari's is system blue, so a door with a face
// (the Starting Pitcher card's "Career vs" strip) printed its title and figures in blue.
// The door's reset must hand the host's ink back to everything inside it.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { ruleBody, stripComments } from './helpers/css.js'

const css = stripComments(fs.readFileSync(new URL('../src/styles/boxlines/boxlines.css', import.meta.url), 'utf8'))

test('the Box Lines door takes its ink from the host, not the browser', () => {
  const body = ruleBody(css, '.boxlines__door')
  assert.ok(body, '.boxlines__door rule exists')
  assert.match(body, /(^|;|\s)color:\s*inherit\s*;/)
})
