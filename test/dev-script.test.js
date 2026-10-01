import test from 'node:test'
import assert from 'node:assert/strict'
import { devScript } from '../e2e/fixtures/dev-script.js'

test('devScript maps each reserved port to its dev script', () => {
  assert.equal(devScript(5173), 'dev')
  assert.equal(devScript(5172), 'dev:2')
  assert.equal(devScript(5169), 'dev:5')
})

test('devScript falls back to dev for an unreserved port', () => {
  assert.equal(devScript(4000), 'dev')
})
