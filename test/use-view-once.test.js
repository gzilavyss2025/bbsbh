// useViewOnce (hooks/motion/useViewOnce.js): the band's motion gate. One server render stands in for
// a mount: the hook reads the module Set once, so `still` is false on a first visit and true after
// the band was marked seen. Effects do not run on the server, so markSeen is called by hand here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { useViewOnce } from '../src/hooks/motion/useViewOnce.js'
import { markSeen, viewKey } from '../src/lib/motion/inViewOnce.js'

const probe = (teamId, band) => {
  const Probe = () => String(useViewOnce(teamId, band, true))
  return renderToString(createElement(Probe)).replace(/<!--.*?-->/g, '')
}

test('a band plays on the first visit and rests on the next', () => {
  assert.equal(probe(158, 'test-band'), 'false')
  markSeen(viewKey(158, 'test-band'))
  assert.equal(probe(158, 'test-band'), 'true')
})

test('the gate is per club and per band', () => {
  assert.equal(probe(159, 'test-band'), 'false')
  assert.equal(probe(158, 'other-band'), 'false')
})
