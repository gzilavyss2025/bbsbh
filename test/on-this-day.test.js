import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBioShards } from '../scripts/lib/open-data/bio-shards.mjs'
import { CHADWICK_JOIN, GEONAMES_CREDIT, RETROSHEET_CREDIT } from '../scripts/lib/open-data/credits.mjs'
import { buildGazetteer } from '../scripts/lib/open-data/gazetteer.mjs'
import { onThisDay } from '../src/api/history/onThisDay.js'
import { birthplaceCell, bornNear, cellsNear, milesBetween } from '../src/api/history/birthplaces.js'

// "On this day" and the birthplace index (ADR-0100, ADR-0106): Retrosheet's
// biofile0.csv, joined to MLBAM ids through the Chadwick register, birth cities
// placed on the map with GeoNames.

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
  row('nomap101', 'Nick', 'Nowhere', '19700707', 'Nowhereville', 'Alabama', 'USA', '19900707'), // not on the map
]
const retroToMlbam = new Map(
  ['aaroh101', 'mayswi01', 'paigl101', 'nocit101', 'pujoa001', 'nostt101', 'mobil102', 'torro101', 'nomap101'].map((id, i) => [id, String(100 + i)]),
)

// A small GeoNames: cities500.txt rows (19 tab-separated fields), the admin1 names,
// and the country list. Coordinates are the real ones, to two decimals.
const geoRow = (id, name, alts, lat, lon, cc, a1, pop) =>
  [id, name, name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), alts, lat, lon, 'P', 'PPL', cc, '', a1, '', '', '', pop, '', '', '', ''].join('\t')
const geo = {
  cities: [
    geoRow(1, 'Mobile', '', 30.69, -88.04, 'US', 'AL', 187041),
    geoRow(2, 'Westfield', '', 33.47, -86.94, 'US', 'AL', 1000),
    geoRow(3, 'Santo Domingo', 'Santo Domingo de Guzman', 18.47, -69.89, 'DO', '34', 2201941),
    geoRow(4, 'Toronto', '', 43.65, -79.38, 'CA', '08', 2600000),
    geoRow(5, 'Washington', 'Washington D.C.', 38.9, -77.04, 'US', 'DC', 689545),
    geoRow(6, 'Washington', '', 33.74, -82.74, 'US', 'GA', 3981),
    geoRow(7, 'Saint Louis', 'St. Louis', 38.63, -90.2, 'US', 'MO', 315685),
    geoRow(8, 'Montréal', 'Montreal', 45.51, -73.59, 'CA', '10', 1600000),
    geoRow(9, 'Springfield', '', 39.8, -89.64, 'US', 'IL', 114394),
    geoRow(10, 'Springfield', '', 41.48, -90.07, 'US', 'IL', 600),
    geoRow(11, 'Big Town', 'Springfield', 40.1, -88.2, 'US', 'IL', 900000), // an alternate name only
    geoRow(12, 'London', '', 51.51, -0.13, 'GB', 'ENG', 8961989),
  ].join('\n'),
  admin1: ['US.AL\tAlabama\tAlabama\t1', 'US.DC\tDistrict of Columbia\tDistrict of Columbia\t2', 'US.GA\tGeorgia\tGeorgia\t3', 'US.MO\tMissouri\tMissouri\t4', 'US.IL\tIllinois\tIllinois\t5'].join('\n'),
  countries: [
    '#ISO\tISO3\tISO-Numeric\tfips\tCountry',
    'US\tUSA\t840\tUS\tUnited States',
    'DO\tDOM\t214\tDR\tDominican Republic',
    'CA\tCAN\t124\tCA\tCanada',
    'GB\tGBR\t826\tUK\tUnited Kingdom',
  ].join('\n'),
}
const locate = buildGazetteer(geo)
const build = () => buildBioShards({ bio, retroToMlbam, locate })
const day = (out, mmdd) => Object.fromEntries(out.onThisDay)[mmdd]
// The people born at one map point.
const at = (out, lat, lon) => Object.fromEntries(out.birthplaces)[birthplaceCell(lat, lon)]?.places.find((p) => p.lat === lat && p.lon === lon)?.people

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
  assert.equal(out.report.people, 11)
  assert.equal(out.report.players, 10)
})

test('a player with no MLBAM id is dropped and counted', () => {
  const out = build()
  assert.equal(JSON.stringify(out).includes('Ghost'), false)
  assert.equal(out.report.noMlbam, 1)
})

test('a birth is filed at its city\'s map point, in the shard for that map cell', () => {
  const out = build()
  assert.deepEqual(at(out, 18.47, -69.89).map((e) => e.name), ['Albert Pujols'])
  assert.deepEqual(at(out, 43.65, -79.38).map((e) => e.name), ['Tom Toronto'])
  assert.deepEqual(at(out, 33.47, -86.94).map((e) => e.name), ['Willie Mays'])
})

test('a case difference in the file still lands at one point', () => {
  assert.deepEqual(at(build(), 30.69, -88.04).map((e) => e.name), ['Mo Mobile', 'Hank Aaron', 'Satchel Paige'])
})

test('a date with no month or day is no date: the debut or birthday is left out and counted', () => {
  const odd = [
    row('aaroh101', 'Hank', 'Aaron', '19340200', 'Mobile', 'Alabama', 'USA', '19540000'),
    row('mayswi01', 'Willie', 'Mays', '19310231', 'Westfield', 'Alabama', 'USA', '19510431'),
  ]
  const out = buildBioShards({ bio: odd, retroToMlbam, locate })
  assert.deepEqual(out.onThisDay, [])
  assert.equal(out.report.noBirthdate, 2)
  assert.equal(out.report.noDebutDate, 2)
})

test('a map cell is two degrees square, named by its south-west corner', () => {
  assert.equal(birthplaceCell(30.69, -88.04), '30_-90')
  assert.equal(birthplaceCell(40.76, -73.85), '40_-74')
  assert.equal(birthplaceCell(-33.87, 151.21), '-34_150')
  assert.equal(birthplaceCell(42, -72), '42_-72')
})

test('a man with no birthdate is still at his birthplace, with a null year, last', () => {
  assert.equal(at(build(), 30.69, -88.04).at(-1).year, null)
})

test('a city GeoNames cannot place is out of the index, counted, and named in the report', () => {
  const out = build()
  assert.equal(JSON.stringify(out.birthplaces).includes('Nowhere'), false)
  assert.equal(out.report.unplaced, 1)
  assert.deepEqual(out.report.missedMost, [['Nowhereville, Alabama', 1]])
  assert.equal(out.report.places, 6)
})

test('a missing city, or a US birth with no state, is out of the index and counted', () => {
  const out = build()
  assert.equal(JSON.stringify(out.birthplaces).includes('Cityless'), false)
  assert.equal(JSON.stringify(out.birthplaces).includes('Stateless'), false)
  assert.equal(out.report.noPlace, 2)
  // Their birthdays still stand.
  assert.equal(day(out, '01-01').born[0].name, 'Nora Cityless')
})

test('the birthplace shards are the map cells that hold a birth', () => {
  assert.deepEqual(build().birthplaces.map(([k]) => k), ['18_-70', '30_-90', '32_-88', '42_-80'])
})

test('a shard carries its credits and no clock; shards are sorted; input order is free', () => {
  const out = build()
  for (const [, body] of out.onThisDay) assert.deepEqual(body.credit, [RETROSHEET_CREDIT, CHADWICK_JOIN])
  for (const [, body] of out.birthplaces) assert.deepEqual(body.credit, [RETROSHEET_CREDIT, CHADWICK_JOIN, GEONAMES_CREDIT])
  for (const [, body] of [...out.onThisDay, ...out.birthplaces]) assert.equal('generatedAt' in body, false)
  assert.deepEqual(out.onThisDay.map(([k]) => k), ['01-01', '01-16', '02-05', '02-13', '04-03', '04-04', '04-13', '05-05', '05-06', '05-25', '07-07', '07-09', '12-31'])
  const rev = buildBioShards({ bio: [...bio].reverse(), retroToMlbam, locate })
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
  await writeFile(join(inDir, 'cities500.txt'), geo.cities)
  await writeFile(join(inDir, 'admin1CodesASCII.txt'), geo.admin1)
  await writeFile(join(inDir, 'countryInfo.txt'), geo.countries)
  const geoFiles = ['cities500.txt', 'admin1CodesASCII.txt', 'countryInfo.txt'].map((n) => join(inDir, n))
  const run = async () => {
    const otd = await mkdtemp(join(tmpdir(), 'otd-out-'))
    const bp = await mkdtemp(join(tmpdir(), 'bp-out-'))
    const printed = execFileSync(
      'node',
      [join(root, 'scripts', 'gen-bio-history.mjs'), join(inDir, 'biofile0.csv'), join(inDir, 'people-0.csv'), ...geoFiles, '--out', otd, '--out-places', bp],
      { encoding: 'utf8' },
    )
    return { printed, otd, bp }
  }
  const a = await run()
  const b = await run()
  assert.match(a.printed, /people read: 11/)
  assert.match(a.printed, /no MLBAM id: 1/)
  assert.match(a.printed, /not on the map: 1\b/)
  assert.match(a.printed, /not on the map, most players: Nowhereville, Alabama \(1\)/)
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

// Nationals Park, from the feed's venue.location.defaultCoordinates.
const NATIONALS_PARK = { lat: 38.872861, lon: -77.007501 }

test('milesBetween is great-circle miles', () => {
  assert.equal(milesBetween(NATIONALS_PARK, NATIONALS_PARK), 0)
  // Nationals Park to Camden Yards is about 35 miles.
  assert.ok(Math.abs(milesBetween(NATIONALS_PARK, { lat: 39.284, lon: -76.622 }) - 35) < 1.5)
})

// Citi Field is 17 miles west of a cell edge.
const CITI_FIELD = { lat: 40.75753012, lon: -73.84559155 }

test('cellsNear covers every cell a 50-mile circle touches', () => {
  assert.deepEqual(cellsNear(NATIONALS_PARK.lat, NATIONALS_PARK.lon), ['38_-78'])
  assert.deepEqual(cellsNear(CITI_FIELD.lat, CITI_FIELD.lon), ['40_-76', '40_-74'])
  // Near a corner: four cells.
  assert.deepEqual(cellsNear(40.1, -74.1), ['38_-76', '38_-74', '40_-76', '40_-74'])
  assert.deepEqual(cellsNear(41, -73, 1), ['40_-74'])
})

test('bornNear finds every birth within 50 miles, across cells, and nothing farther', async () => {
  const person = (personId, name) => ({ personId, name, year: 1950 })
  const shards = {
    '/data/birthplaces/40_-74.json': {
      credit: ['c'],
      places: [
        { lat: 40.65, lon: -73.95, people: [person(1, 'Brooklyn born')] }, // 9 mi
        { lat: 41.31, lon: -72.92, people: [person(2, 'New Haven born')] }, // 63 mi
      ],
    },
    '/data/birthplaces/40_-76.json': { credit: ['c'], places: [{ lat: 40.74, lon: -74.17, people: [person(3, 'Newark born')] }] }, // 17 mi
    '/data/birthplaces/38_-76.json': { credit: ['c'], places: [{ lat: 39.95, lon: -75.17, people: [person(4, 'Philadelphia born')] }] }, // 87 mi
  }
  await withFetch(shards, async (urls) => {
    const near = await bornNear(CITI_FIELD)
    assert.deepEqual(near.people.map((p) => p.name).sort(), ['Brooklyn born', 'Newark born'])
    assert.deepEqual(near.credit, ['c'])
    assert.deepEqual(urls.sort(), cellsNear(CITI_FIELD.lat, CITI_FIELD.lon).map((c) => `/data/birthplaces/${c}.json`).sort())
  })
})

test('bornNear with no point, or no one near, is empty', async () => {
  await withFetch({}, async () => {
    assert.deepEqual(await bornNear(null), { people: [], credit: [] })
    assert.deepEqual(await bornNear({ lat: 'x', lon: 1 }), { people: [], credit: [] })
    assert.deepEqual(await bornNear({ lat: 0.5, lon: 0.5 }), { people: [], credit: [] })
  })
})

test('a Washington, D.C. birth is near Nationals Park (the feed says District of Columbia, Retrosheet says D.C.)', async () => {
  const dc = buildBioShards({
    bio: [row('dcbor101', 'Dee', 'Capital', '19600101', 'Washington', 'D.C.', 'USA', '19800401')],
    retroToMlbam: new Map([['dcbor101', '900']]),
    locate,
  })
  const shards = Object.fromEntries(dc.birthplaces.map(([cell, body]) => [`/data/birthplaces/${cell}.json`, body]))
  await withFetch(shards, async () => {
    assert.deepEqual((await bornNear(NATIONALS_PARK)).people.map((p) => p.name), ['Dee Capital'])
  })
})

test('the About page prints the GeoNames credit', async () => {
  const about = await readFile(join(root, 'src', 'screens', 'AboutPage.jsx'), 'utf8')
  assert.ok(about.includes(GEONAMES_CREDIT))
})
