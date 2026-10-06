import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFamilyTies } from '../scripts/lib/open-data/family-ties.mjs'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from '../scripts/lib/open-data/credits.mjs'
import { shardKey100 } from '../src/lib/shardKey.js'
import { familyOf } from '../src/api/person/family/family.js'

// The family-links dataset (ADR-0100): Retrosheet's relatives.csv, joined to MLBAM
// ids through the Chadwick register, sharded on the player's MLBAM id.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const bio = [
  { id: 'bondb101', usename: 'Bobby', lastname: 'Bonds' },
  { id: 'bondb001', usename: 'Barry', lastname: 'Bonds' },
  { id: 'aloum101', usename: 'Matty', lastname: 'Alou' },
  { id: 'alouj101', usename: 'Jesus', lastname: 'Alou' },
  { id: 'houkr101', usename: 'Ralph', lastname: 'Houk' },
  { id: 'gaviS001', usename: 'Sam', lastname: 'Gaviglio' },
  { id: 'nobod001', usename: 'Nobody', lastname: 'Bridged' },
  { id: 'nobod002', usename: 'Nobody', lastname: 'Else' },
]
// retro id -> mlbam id, as retro-bridge hands it over.
const retroToMlbam = new Map([
  ['bondb101', '100'],
  ['bondb001', '111188'],
  ['aloum101', '200'],
  ['alouj101', '301'],
  ['houkr101', '400'],
  ['gaviS001', '502'],
])
const build = (relatives) => buildFamilyTies({ bio, relatives, retroToMlbam })
const entriesOf = (out, mlbam) => Object.fromEntries(out.shards)[shardKey100(mlbam)]?.players[mlbam]

test('the label describes id1, so each end gets the other end\'s role (Bobby Bonds is Barry\'s Father)', () => {
  const out = build([{ id1: 'bondb101', relation: 'Father', id2: 'bondb001' }])
  assert.deepEqual(entriesOf(out, 111188), [{ relation: 'Father', personId: 100, name: 'Bobby Bonds' }])
  assert.deepEqual(entriesOf(out, 100), [{ relation: 'Son', personId: 111188, name: 'Barry Bonds' }])
})

test('every generational label has its inverse', () => {
  const inverse = {
    Father: 'Son',
    Grandfather: 'Grandson',
    Uncle: 'Nephew',
    'Great Uncle': 'Great Nephew',
    'Father-in-Law': 'Son-in-Law',
    'Step Father': 'Step Son',
    'Uncle and Stepfather': 'Nephew and Stepson',
  }
  for (const [label, back] of Object.entries(inverse)) {
    const out = build([{ id1: 'bondb101', relation: label, id2: 'bondb001' }])
    assert.equal(entriesOf(out, 100)[0].relation, back, label)
    assert.equal(entriesOf(out, 111188)[0].relation, label, label)
  }
})

test('a symmetric label reads the same from both ends', () => {
  for (const label of ['Brother', 'Cousin', 'Brother-in-Law', 'Half Brother', 'Related To', 'Step Brother']) {
    const out = build([{ id1: 'aloum101', relation: label, id2: 'alouj101' }])
    assert.equal(entriesOf(out, 200)[0].relation, label, label)
    assert.equal(entriesOf(out, 301)[0].relation, label, label)
  }
})

test('"Great Grandson" names id2 in the file, so it is read as id1 being the Great Grandfather', () => {
  const out = build([{ id1: 'houkr101', relation: 'Great Grandson', id2: 'gaviS001' }])
  assert.deepEqual(entriesOf(out, 502), [{ relation: 'Great Grandfather', personId: 400, name: 'Ralph Houk' }])
  assert.deepEqual(entriesOf(out, 400), [{ relation: 'Great Grandson', personId: 502, name: 'Sam Gaviglio' }])
})

test('a relative with no MLBAM match keeps the name and a null id', () => {
  const out = build([{ id1: 'bondb101', relation: 'Father', id2: 'nobod001' }])
  assert.deepEqual(entriesOf(out, 100), [{ relation: 'Son', personId: null, name: 'Nobody Bridged' }])
})

test('a player with no MLBAM match gets no shard entry, and his relative still does', () => {
  const out = build([{ id1: 'nobod001', relation: 'Father', id2: 'bondb001' }])
  assert.deepEqual(entriesOf(out, 111188), [{ relation: 'Father', personId: null, name: 'Nobody Bridged' }])
  assert.equal(out.shards.length, 1)
})

test('a row where neither end bridges writes nothing', () => {
  const out = build([{ id1: 'nobod001', relation: 'Brother', id2: 'nobod002' }])
  assert.deepEqual(out.shards, [])
})

test('the report counts rows by how many ends bridged', () => {
  const out = build([
    { id1: 'bondb101', relation: 'Father', id2: 'bondb001' },
    { id1: 'aloum101', relation: 'Brother', id2: 'alouj101' },
    { id1: 'nobod001', relation: 'Father', id2: 'bondb001' },
    { id1: 'nobod001', relation: 'Brother', id2: 'nobod002' },
  ])
  assert.deepEqual(out.report, {
    relativesRead: 4,
    bothBridged: 2,
    oneBridged: 1,
    neitherBridged: 1,
    entries: 5,
    players: 4, // Barry is in two rows
  })
})

test('an unknown label fails the run, naming it', () => {
  assert.throws(() => build([{ id1: 'bondb101', relation: 'Godfather', id2: 'bondb001' }]), /Godfather/)
})

test('a label that is a plain-object key is still unknown', () => {
  assert.throws(() => build([{ id1: 'bondb101', relation: 'constructor', id2: 'bondb001' }]), /constructor/)
})

test('a row listed twice files one entry', () => {
  const row = { id1: 'bondb101', relation: 'Father', id2: 'bondb001' }
  assert.equal(entriesOf(build([row, row]), 111188).length, 1)
})

test('an id the biofile lacks fails the run even when neither end bridges', () => {
  assert.throws(() => build([{ id1: 'ghost001', relation: 'Brother', id2: 'nobod001' }]), /ghost001/)
})

test('an id the biofile lacks fails the run, naming it', () => {
  assert.throws(() => build([{ id1: 'ghost001', relation: 'Brother', id2: 'bondb001' }]), /ghost001/)
})

test('each player is filed under shardKey100 of his MLBAM id', () => {
  const out = build([
    { id1: 'bondb101', relation: 'Father', id2: 'bondb001' },
    { id1: 'aloum101', relation: 'Brother', id2: 'alouj101' },
  ])
  const keys = out.shards.map(([key]) => key)
  assert.deepEqual(keys, [...keys].sort())
  for (const [key, body] of out.shards) {
    for (const id of Object.keys(body.players)) assert.equal(shardKey100(id), key)
  }
})

test('the shard carries the credit lines and no clock', () => {
  const [[, body]] = build([{ id1: 'bondb101', relation: 'Father', id2: 'bondb001' }]).shards
  assert.deepEqual(body.credit, [RETROSHEET_CREDIT, CHADWICK_JOIN])
  assert.equal('generatedAt' in body, false)
})

test('input order does not change the bytes', () => {
  const rows = [
    { id1: 'bondb101', relation: 'Father', id2: 'bondb001' },
    { id1: 'aloum101', relation: 'Brother', id2: 'alouj101' },
    { id1: 'aloum101', relation: 'Cousin', id2: 'bondb001' },
  ]
  assert.equal(JSON.stringify(build(rows).shards), JSON.stringify(build([...rows].reverse()).shards))
})

test('the credits are the two statements the licences ask for', () => {
  assert.equal(
    RETROSHEET_CREDIT,
    'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at 20 Sunset Rd., Newark, DE 19711.',
  )
  assert.match(CHADWICK_JOIN, /Chadwick Bureau register/)
})

test('the About page prints both credits verbatim', () => {
  const about = readFileSync(join(root, 'src', 'screens', 'AboutPage.jsx'), 'utf8')
  assert.ok(about.includes(RETROSHEET_CREDIT), 'Retrosheet statement')
  assert.match(about, /Chadwick Bureau register/)
})

// ---- the hand-run generator ------------------------------------------------

async function fixtureFiles() {
  const dir = await mkdtemp(join(tmpdir(), 'family-ties-in-'))
  await writeFile(
    join(dir, 'biofile0.csv'),
    'id,lastname,usename\n' + bio.map((b) => `${b.id},${b.lastname},${b.usename}`).join('\n') + '\n',
  )
  await writeFile(join(dir, 'relatives.csv'), 'id1,relation,id2\nbondb101,Father,bondb001\naloum101,Brother,alouj101\n')
  await writeFile(
    join(dir, 'people-0.csv'),
    'key_mlbam,key_retro\n100,bondb101\n111188,bondb001\n200,aloum101\n301,alouj101\n',
  )
  return dir
}

const runGen = (inDir, outDir) =>
  execFileSync(
    'node',
    [
      join(root, 'scripts', 'gen-family-ties.mjs'),
      join(inDir, 'biofile0.csv'),
      join(inDir, 'relatives.csv'),
      join(inDir, 'people-0.csv'),
      '--out',
      outDir,
    ],
    { encoding: 'utf8' },
  )

test('the generator writes the same bytes on a second run, and prints its report', async () => {
  const inDir = await fixtureFiles()
  const a = await mkdtemp(join(tmpdir(), 'family-ties-out-'))
  const b = await mkdtemp(join(tmpdir(), 'family-ties-out-'))
  const printed = runGen(inDir, a)
  runGen(inDir, b)
  assert.match(printed, /relatives read: 2/)
  assert.match(printed, /both ends bridged: 2/)
  const names = await readdir(a)
  assert.deepEqual(names, await readdir(b))
  assert.ok(names.length > 0)
  for (const name of names) assert.equal(await readFile(join(a, name), 'utf8'), await readFile(join(b, name), 'utf8'))
})

// ---- the reader ------------------------------------------------------------

test('familyOf returns the entries from the player\'s shard, and [] when there are none', async () => {
  const urls = []
  const shard = { credit: [], players: { 111188: [{ relation: 'Father', personId: 100, name: 'Bobby Bonds' }] } }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    return String(url).endsWith(`/${shardKey100(111188)}.json`)
      ? new Response(JSON.stringify(shard))
      : new Response('', { status: 404 })
  }
  try {
    assert.deepEqual(await familyOf(111188), shard.players[111188])
    assert.deepEqual(urls, [`/data/family-ties/${shardKey100(111188)}.json`])
    assert.deepEqual(await familyOf(999999), []) // another shard: 404
    assert.deepEqual(await familyOf(null), [])
  } finally {
    globalThis.fetch = realFetch
  }
})
