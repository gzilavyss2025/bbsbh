import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs, strOpt } from '../scripts/lib/args.mjs'

// Six generators used to keep their own lenient copy of this parser (`=` optional).
// This pins the shared one to what they read: --key=value and a bare --key.
test('parseArgs reads --key=value', () => {
  assert.deepEqual(parseArgs(['--since=2026-07-01', '--days=3']), { since: '2026-07-01', days: '3' })
})

test('parseArgs reads a bare --flag as true', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--rebuild']), { 'dry-run': true, rebuild: true })
})

test('parseArgs keeps an empty value and a value with an equals sign', () => {
  assert.deepEqual(parseArgs(['--a=', '--b=x=y']), { a: '', b: 'x=y' })
})

test('parseArgs ignores arguments that are not flags', () => {
  assert.deepEqual(parseArgs(['node', 'file.mjs', '-x', '--k=v']), { k: 'v' })
})

test('strOpt: a value flag given bare is absent, not true', () => {
  const args = parseArgs(['--season', '--days=0', '--level='])
  assert.equal(strOpt(args, 'season'), undefined)
  assert.equal(strOpt(args, 'days'), '0')
  assert.equal(strOpt(args, 'level'), '')
  assert.equal(strOpt(args, 'missing'), undefined)
})

test('parseArgs keeps reading flags after a bare --', () => {
  assert.deepEqual(parseArgs(['--a=1', '--', '--b=2', '--c']), { a: '1', b: '2', c: true })
})
