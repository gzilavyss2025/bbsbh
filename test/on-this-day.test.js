import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBioShards } from '../scripts/lib/open-data/bio-shards.mjs'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from '../scripts/lib/open-data/credits.mjs'
import { onThisDay } from '../src/api/history/onThisDay.js'
import { birthplaceKey, birthplaceShard, bornIn } from '../src/api/history/birthplaces.js'

// "On this day" and the birthplace index (ADR-0100): Retrosheet's biofile0.csv,
// joined to MLBAM ids through the Chadwick register.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const row = (id, usename, lastname, birthdate, city, state, country, debut_p) => ({
  id, usename, lastname, birthdate, birthcity: city, birthstate: state, birthcountry: country, debut_p,
})
// Ten rows. Aaron and Mays share a birth city. Mays and Pujols share a debut day.
const bio = [
  row('aaroh101', 'Hank', 'Aaron', '19340205', 'Mobile', 'Alabama', 'USA', '19540413'),
  row('mayswi01', 'Willie', 'Mays', '19310506', 'Westfield', 'Alabama', 'USA', '19510525'),
  row('paigl101', 'Satchel', 'Paige', '', 'Mobile', 'Alabama', 'USA', '19480709'), // no birthdate
  row('nocit101', 'Nora', 'Cityless', '19500101', '', '', '', '19700413'), // no city
  row('pujoa001', 'Albert', 'Pujols', '19800116', 'Santo Domingo', 'Distrito Nacional', 'Dominican Republic', '20010403'),
  row('ghost101', 'Gus', 'Ghost', '19400202', 'Mobile', 'Alabama', 'USA', '19600413'), // no MLBAM id
  row('mgr00001', 'Mel', 'Manager', '19200303', 'Mobile', 'Alabama', 'USA', ''), // never played
  row('nostt101', 'Sam', 'Stateless', '19600404', 'Gary', '', 'USA', '19800413'), // US, no state
  row('mobil102', 'Mo', 'Mobile', '19331231', 'MOBILE', 'ALABAMA', 'USA', '19530505'), // case
  row('torro101', 'Tom', 'Toronto', '19750213', 'Toronto', 'Ontario', 'Canada', '19980413'),
]
const retroToMlbam = new Map(
  ['aaroh101', 'mayswi01', 'paigl101', 'nocit101', 'pujoa001', 'nostt101', 'mobil102', 'torro101'].map((id, i) => [id, String(100 + i)]),
)
const build = () => buildBioShards({ bio, retroToMlbam })
const day = (out, mmdd) => Object.fromEntries(out.onThisDay)[mmdd]
const place = (out, key) => {
  const shard = Object.fromEntries(out.birthplaces)[birthplaceShard(key)]
  return shard?.places[key]
}

test('a man born on a day is filed under that month and day, with his birth year', () => {
  assert.deepEqual(day(build(), '02-05').born, [{ personId: 100, name: 'Hank Aaron', year: 1934 }])
})

test('a debut is filed under its own day, with the debut year, in year order', () => {
  const debuted = day(build(), '04-13').debuted
  assert.deepEqual(debuted.map((e) => [e.name, e.year]), [
    ['Hank Aaron', 1954],
    ['Nora Cityless', 1970],
    ['Sam Stateless', 1980],
    ['Tom Toronto', 1998],
  ])
})

test('a player with no birthdate keeps his debut and is not in any born list', () => {
  const out = build()
  assert.equal(day(out, '07-09').debuted[0].name, 'Satchel Paige')
  assert.equal(out.onThisDay.some(([, d]) => d.born.some((e) => e.name === 'Satchel Paige')), false)
  assert.equal(out.report.noBirthdate, 1)
})

test('a man who never debuted as a player is left out and not counted as dropped', () => {
  const out = build()
  assert.equal(JSON.stringify(out).includes('Manager'), false)
  assert.equal(out.report.people, 10)
  assert.equal(out.report.players, 9)
})

test('a player with no MLBAM id is dropped and counted', () => {
  const out = build()
  assert.equal(JSON.stringify(out).includes('Ghost'), false)
  assert.equal(out.report.noMlbam, 1)
})

test('a US birth keys on city and state; a foreign birth on city and country', () => {
  assert.equal(birthplaceKey('Mobile', 'Alabama'), 'mobile|alabama')
  const out = build()
  assert.ok(place(out, 'santo domingo|dominican republic'))
  assert.ok(place(out, 'toronto|canada'))
  assert.equal(place(out, 'toronto|ontario'), undefined)
})

test('the key is lower case, so a case difference in the file still lands in one group', () => {
  assert.deepEqual(place(build(), 'mobile|alabama').map((e) => e.name), ['Mo Mobile', 'Hank Aaron', 'Satchel Paige'])
})

test('a date with no month or day is no date: the debut or birthday is left out and counted', () => {
  const odd = [
    row('aaroh101', 'Hank', 'Aaron', '19340200', 'Mobile', 'Alabama', 'USA', '19540000'),
    row('mayswi01', 'Willie', 'Mays', '19310231', 'Westfield', 'Alabama', 'USA', '19510431'),
  ]
  const out = buildBioShards({ bio: odd, retroToMlbam })
  assert.deepEqual(out.onThisDay, [])
  assert.equal(out.report.noBirthdate, 2)
  assert.equal(out.report.noDebutDate, 2)
})

test('shard names are not tied to the letters a key starts with', () => {
  assert.equal(birthplaceShard(birthplaceKey('St. Louis', 'Missouri')), 'st')
  assert.equal(birthplaceShard(birthplaceKey('Ñuñoa', 'Chile')), 'nu')
  assert.equal(birthplaceShard(birthplaceKey('1234', 'X')), '_')
})

test('a man with no birthdate is still in his birthplace group, with a null year, last', () => {
  assert.equal(place(build(), 'mobile|alabama').at(-1).year, null)
})

test('a missing city, or a US birth with no state, is out of the index and counted', () => {
  const out = build()
  assert.equal(JSON.stringify(out.birthplaces).includes('Cityless'), false)
  assert.equal(JSON.stringify(out.birthplaces).includes('Stateless'), false)
  assert.equal(out.report.noPlace, 2)
  // Their birthdays still stand.
  assert.equal(day(out, '01-01').born[0].name, 'Nora Cityless')
})

test('a birthplace shard is the first two letters of the city', () => {
  const keys = build().birthplaces.map(([k]) => k)
  assert.deepEqual(keys, ['mo', 'sa', 'to', 'we'])
})

test('a shard carries both credits and no clock; shards are sorted; input order is free', () => {
  const out = build()
  for (const [, body] of [...out.onThisDay, ...out.birthplaces]) {
    assert.deepEqual(body.credit, [RETROSHEET_CREDIT, CHADWICK_JOIN])
    assert.equal('generatedAt' in body, false)
  }
  assert.deepEqual(out.onThisDay.map(([k]) => k), ['01-01', '01-16', '02-05', '02-13', '04-03', '04-04', '04-13', '05-05', '05-06', '05-25', '07-09', '12-31'])
  const rev = buildBioShards({ bio: [...bio].reverse(), retroToMlbam })
  assert.equal(JSON.stringify(rev.onThisDay), JSON.stringify(out.onThisDay))
  assert.equal(JSON.stringify(rev.birthplaces), JSON.stringify(out.birthplaces))
})

// ---- the hand-run generator ------------------------------------------------

const csvOf = (rows) => {
  const head = 'id,lastname,usename,birthdate,birthcity,birthstate,birthcountry,debut_p'
  const cells = rows.map((r) => [r.id, r.lastname, r.usename, r.birthdate, r.birthcity, r.birthstate, r.birthcountry, r.debut_p].join(','))
  return [head, ...cells].join('\n') + '\n'
}

test('the generator writes both datasets, prints the report, and writes the same bytes twice', async () => {
  const inDir = await mkdtemp(join(tmpdir(), 'bio-in-'))
  await writeFile(join(inDir, 'biofile0.csv'), csvOf(bio))
  await writeFile(join(inDir, 'people-0.csv'), 'key_mlbam,key_retro\n' + [...retroToMlbam].map(([r, m]) => `${m},${r}`).join('\n') + '\n')
  const run = async () => {
    const otd = await mkdtemp(join(tmpdir(), 'otd-out-'))
    const bp = await mkdtemp(join(tmpdir(), 'bp-out-'))
    const printed = execFileSync(
      'node',
      [join(root, 'scripts', 'gen-bio-history.mjs'), join(inDir, 'biofile0.csv'), join(inDir, 'people-0.csv'), '--out', otd, '--out-places', bp],
      { encoding: 'utf8' },
    )
    return { printed, otd, bp }
  }
  const a = await run()
  const b = await run()
  assert.match(a.printed, /people read: 10/)
  assert.match(a.printed, /no MLBAM id: 1/)
  for (const key of ['otd', 'bp']) {
    const names = await readdir(a[key])
    assert.deepEqual(names, await readdir(b[key]))
    assert.ok(names.length > 0)
    for (const n of names) assert.equal(await readFile(join(a[key], n), 'utf8'), await readFile(join(b[key], n), 'utf8'))
  }
})

// ---- the readers -----------------------------------------------------------

const withFetch = async (shards, fn) => {
  const urls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    return shards[String(url)] ? new Response(JSON.stringify(shards[String(url)])) : new Response('', { status: 404 })
  }
  try {
    await fn(urls)
  } finally {
    globalThis.fetch = realFetch
  }
}

test('onThisDay(month, day) reads the file for that day and returns { born, debuted }; an empty day is empty', async () => {
  const shard = { credit: [], born: [{ personId: 100, name: 'Hank Aaron', year: 1934 }], debuted: [] }
  await withFetch({ '/data/on-this-day/02-05.json': shard }, async (urls) => {
    assert.deepEqual(await onThisDay(2, 5), { born: shard.born, debuted: [] })
    assert.deepEqual(await onThisDay(3, 1), { born: [], debuted: [] }) // 404
    assert.deepEqual(urls, ['/data/on-this-day/02-05.json', '/data/on-this-day/03-01.json'])
  })
})

test('bornIn matches city and state or country exactly, in any case, and nothing else', async () => {
  const shard = { credit: [], places: { 'mobile|alabama': [{ personId: 100, name: 'Hank Aaron', year: 1934 }] } }
  await withFetch({ '/data/birthplaces/mo.json': shard }, async () => {
    assert.deepEqual(await bornIn('Mobile', 'Alabama'), shard.places['mobile|alabama'])
    assert.deepEqual(await bornIn('MOBILE', 'alabama'), shard.places['mobile|alabama'])
    assert.deepEqual(await bornIn('Mobile', 'AL'), [])
    assert.deepEqual(await bornIn('Mobil', 'Alabama'), [])
    assert.deepEqual(await bornIn('', 'Alabama'), [])
    assert.deepEqual(await bornIn(null, null), [])
  })
})
