import test from 'node:test'
import assert from 'node:assert/strict'
import { ruleBody, stripComments } from './helpers/css.js'

test('stripComments removes block comments, including multi-line ones', () => {
  assert.equal(stripComments('a{/* x */color:red}'), 'a{color:red}')
  assert.equal(stripComments('/* one\ntwo */b{}'), 'b{}')
})

test('ruleBody finds the exact selector and returns its declarations', () => {
  const css = '.a-b { x: 1 }\n.a { color: red; }\n.a:hover { color: blue }\n'
  assert.equal(ruleBody(css, '.a').trim(), 'color: red;')
  assert.equal(ruleBody(css, '.a:hover').trim(), 'color: blue')
})

test('ruleBody skips compounds, longer names and selector text in a value', () => {
  assert.equal(ruleBody('.ab { x: 1 }', '.a'), null)
  assert.equal(ruleBody('.b .a { x: 1 }', '.a'), null)
  assert.equal(ruleBody('.x { y: .a }\n', '.a'), null)
})

test('ruleBody reads a selector inside a list and across CRLF', () => {
  assert.equal(ruleBody('.b,\n.a\r\n{ x: 1 }', '.a').trim(), 'x: 1')
})
