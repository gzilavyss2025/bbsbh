// check-spoiler-manifest.mjs runs in `npm run lint`. #3038 let ANY class carry an
// `importers` list (the raw win-probability fetcher, winprob/feed.js, is
// spoiler-free yet lists who may reach it). These cases pin that the guard
// enforces such a list, so a later edit cannot quietly stop checking it.
//
// The guard finds the repo from its own location, so each case copies it into a
// scratch tree and runs it there.

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const SCRIPTS = path.join(fileURLToPath(new URL('.', import.meta.url)), '../scripts')

const manifest = (entry) =>
  JSON.stringify({ modules: { 'winprob/feed.js': { class: 'spoiler-free', why: 'A raw fetcher whose result is score-bearing.', ...entry } } })

function run(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'spoiler-manifest-guard-'))
  try {
    mkdirSync(path.join(dir, 'scripts/lib'), { recursive: true })
    copyFileSync(path.join(SCRIPTS, 'check-spoiler-manifest.mjs'), path.join(dir, 'scripts/check-spoiler-manifest.mjs'))
    copyFileSync(path.join(SCRIPTS, 'lib/walk.mjs'), path.join(dir, 'scripts/lib/walk.mjs'))
    const tree = {
      'src/api/winprob/feed.js': 'export const fetchWinProbability = () => null\n',
      'src/hooks/a.js': "import { fetchWinProbability } from '../api/winprob/feed.js'\nexport const a = fetchWinProbability\n",
      ...files,
    }
    for (const [file, text] of Object.entries(tree)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), text)
    }
    return spawnSync(process.execPath, [path.join(dir, 'scripts/check-spoiler-manifest.mjs')], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a spoiler-free module imported only from its list passes', () => {
  const res = run({ 'src/api/spoiler-manifest.json': manifest({ importers: ['hooks/a.js'] }) })
  assert.equal(res.status, 0, res.stderr)
})

test('a spoiler-free module with a list fails on an importer not on it', () => {
  const res = run({
    'src/api/spoiler-manifest.json': manifest({ importers: ['hooks/a.js'] }),
    'src/screens/Stray.jsx': "import { fetchWinProbability } from '../api/winprob/feed.js'\nexport const s = fetchWinProbability\n",
  })
  assert.equal(res.status, 1, res.stderr)
  assert.match(res.stderr, /screens\/Stray\.jsx imports src\/api\/winprob\/feed\.js/)
})

test('a stale entry on a spoiler-free list fails', () => {
  const res = run({ 'src/api/spoiler-manifest.json': manifest({ importers: ['hooks/a.js', 'hooks/gone.js'] }) })
  assert.equal(res.status, 1, res.stderr)
  assert.match(res.stderr, /lists hooks\/gone\.js/)
})

test('a spoiler-free module with no list stays open to any importer', () => {
  const res = run({ 'src/api/spoiler-manifest.json': manifest({}) })
  assert.equal(res.status, 0, res.stderr)
})

test('an importers value that is not an array fails rather than switching containment off', () => {
  const res = run({
    'src/api/spoiler-manifest.json': manifest({ importers: 'hooks/a.js' }),
    'src/screens/Stray.jsx': "import { fetchWinProbability } from '../api/winprob/feed.js'\nexport const s = fetchWinProbability\n",
  })
  assert.equal(res.status, 1, res.stderr)
  assert.match(res.stderr, /"importers" that is not an array/)
})
