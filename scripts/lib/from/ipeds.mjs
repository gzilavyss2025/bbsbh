// The IPEDS Directory file (HD2023.csv) cut down to what the college matcher and the map
// need (#1526, SPEC §7.1). IPEDS is the US Department of Education's school list; its
// directory gives each school a city, state, county and map point. The nightly run cannot
// download (ADR-0100), so scripts/data/from/ipeds.json holds this cut and
// `gen-where-from.mjs --ipeds <HD csv>` rewrites it. A later year's file is a drop-in.
import { parseCsvLine } from '../csv.mjs'

// -> [{ unitid, name, alias, city, state, county, lat, lon, level }]. The file is Latin-1
// with a byte-order mark before UNITID, and the caller reads it as 'latin1'.
export function parseHd(text) {
  const lines = text.replace(/^(﻿|ï»¿)/, '').replace(/\r\n/g, '\n').split('\n').filter(Boolean)
  const head = parseCsvLine(lines[0])
  const at = Object.fromEntries(head.map((h, i) => [h, i]))
  for (const need of ['UNITID', 'INSTNM', 'IALIAS', 'CITY', 'STABBR', 'COUNTYCD', 'LATITUDE', 'LONGITUD', 'ICLEVEL']) {
    if (!(need in at)) throw new Error(`IPEDS file has no ${need} column`)
  }
  const num = (v) => (Number.isFinite(Number(v)) && v !== '' && Number(v) !== -999 ? Number(Number(v).toFixed(4)) : null)
  return lines.slice(1).map((line) => {
    const r = parseCsvLine(line)
    const county = /^\d+$/.test(r[at.COUNTYCD]) ? r[at.COUNTYCD].padStart(5, '0') : ''
    return {
      unitid: r[at.UNITID],
      name: r[at.INSTNM],
      alias: r[at.IALIAS].trim(),
      city: r[at.CITY],
      state: r[at.STABBR],
      county,
      lat: num(r[at.LATITUDE]),
      lon: num(r[at.LONGITUD]),
      level: r[at.ICLEVEL],
    }
  })
}

// One array a school keeps the file small (about 6,160 rows); the keys are in the order below.
const KEYS = ['unitid', 'name', 'alias', 'city', 'state', 'county', 'lat', 'lon', 'level']
export const packSchools = (schools) => schools.map((s) => KEYS.map((k) => s[k]))
export const unpackSchools = (rows) => rows.map((r) => Object.fromEntries(KEYS.map((k, i) => [k, r[i]])))
