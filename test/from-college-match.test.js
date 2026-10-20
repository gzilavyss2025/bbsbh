import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildCollegeMatcher, FLAGSHIP } from '../scripts/lib/from/college-match.mjs'
import { packSchools, parseHd, unpackSchools } from '../scripts/lib/from/ipeds.mjs'

// MLB college names -> IPEDS schools (#1526, SPEC §7.1). Runs on the committed IPEDS 2023 cut.
const schools = unpackSchools(JSON.parse(readFileSync(new URL('../scripts/data/from/ipeds.json', import.meta.url), 'utf8')).schools)
const overrides = JSON.parse(readFileSync(new URL('../scripts/data/from/college-overrides.json', import.meta.url), 'utf8'))
const { match, school } = buildCollegeMatcher(schools, {})

test('every flagship name is a real IPEDS school, so the table cannot rot', () => {
  const names = new Set(schools.map((s) => s.name))
  for (const [short, full] of Object.entries(FLAGSHIP)) assert.ok(names.has(full), `${short} -> ${full}`)
})

test('rule 2: a flagship short name finds its school', () => {
  const r = match('Michigan')
  assert.equal(r.rule, 'flagship')
  assert.equal(school(r.unitid).name, 'University of Michigan-Ann Arbor')
  assert.equal(school(match('Miami (OH)').unitid).state, 'OH')
  assert.equal(school(match('Miami (FL)').unitid).state, 'FL')
})

test('rule 3: UC, Cal State and X State expand to the long name', () => {
  assert.equal(school(match('UC Santa Barbara').unitid).name, 'University of California-Santa Barbara')
  assert.equal(school(match('Cal State Northridge').unitid).name, 'California State University-Northridge')
  assert.equal(school(match('Oregon State').unitid).name, 'Oregon State University')
})

test('rule 4: an exact normalized name finds one school, and spelling variants agree', () => {
  const r = match('Vanderbilt')
  assert.equal(r.rule, 'exact')
  assert.equal(school(r.unitid).state, 'TN')
  assert.equal(match('Texas-San Antonio').unitid, match('Texas - San Antonio').unitid)
})

test('rule 5: a state hint narrows several hits to one', () => {
  const r = match('Cumberland (TN)')
  assert.equal(r.rule, 'hint')
  assert.equal(school(r.unitid).state, 'TN')
})

test('a name that fits several schools is ambiguous and is never guessed', () => {
  const r = match('Columbia')
  assert.equal(r.unitid, null)
  assert.equal(r.rule, 'ambiguous')
  assert.ok(r.candidates.length > 1)
  assert.deepEqual(match('Zzyzx Tech'), { unitid: null, rule: 'none' })
})

test('rule 1: an override wins, and null means known but not in IPEDS', () => {
  const m = buildCollegeMatcher(schools, { Michigan: '999', Columbia: '190150', 'Penn State Erie': null })
  assert.equal(m.match('Michigan').unitid, '999')
  assert.equal(m.match('Columbia').unitid, '190150')
  assert.deepEqual(m.match('Penn State Erie'), { unitid: null, rule: 'override' })
  assert.equal(m.school('999'), null)
})

test('the committed overrides name real IPEDS schools, and each has a reason to exist', () => {
  const ids = new Set(schools.map((s) => s.unitid))
  assert.ok(Object.keys(overrides).length >= 50)
  for (const [name, id] of Object.entries(overrides)) {
    if (id === null) continue // "known, not on the map" stays a null on purpose
    assert.ok(ids.has(id), `${name} -> ${id}`)
    // an override the matcher already gets right is dead weight
    assert.notEqual(match(name).unitid, id, `${name} matches without its override`)
  }
})

test('parseHd reads the Latin-1 file: BOM, quoted commas, padded county, missing coordinates', () => {
  const head = 'UNITID,INSTNM,IALIAS,CITY,STABBR,COUNTYCD,LATITUDE,LONGITUD,ICLEVEL'
  const text = `ï»¿${head}\r\n1,"Smith, Jones & Co College", Alias ,Troy,NY,1083,42.7,-73.69,1\r\n2,Nowhere U,,Nowhere,AK,-2,-999,-999,2\r\n`
  const rows = parseHd(text)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { unitid: '1', name: 'Smith, Jones & Co College', alias: 'Alias', city: 'Troy', state: 'NY', county: '01083', lat: 42.7, lon: -73.69, level: '1' })
  assert.equal(rows[1].county, '')
  assert.equal(rows[1].lat, null)
  assert.deepEqual(unpackSchools(packSchools(rows)), rows)
  assert.throws(() => parseHd('UNITID,INSTNM\n1,A'), /no IPEDS|no .* column/)
})
