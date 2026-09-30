import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../scripts/lib/args.mjs'

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
