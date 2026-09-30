import test from 'node:test'
import assert from 'node:assert/strict'
import { ipToOuts, outsToIp } from '../src/lib/math/innings.js'

// The table every old copy of ipToOuts was run against (#1306): all agreed.
test('ipToOuts reads whole innings plus leftover outs', () => {
  const table = [
    ['5.1', 16],
    ['5.2', 17],
    [5.1, 16],
    ['0.0', 0],
    ['', 0],
    [null, 0],
    [undefined, 0],
    ['.3', 3],
    ['104.2', 314],
    ['6', 18],
    [6, 18],
    ['5.', 15],
    ['x', 0],
  ]
  for (const [input, outs] of table) assert.equal(ipToOuts(input), outs, `ipToOuts(${JSON.stringify(input)})`)
})

test('outsToIp is the inverse, and sums carry', () => {
  assert.equal(outsToIp(0), '0.0')
  assert.equal(outsToIp(16), '5.1')
  assert.equal(outsToIp(ipToOuts('104.2') + 1), '105.0')
  for (const ip of ['0.0', '5.1', '5.2', '104.2']) assert.equal(outsToIp(ipToOuts(ip)), ip)
})
