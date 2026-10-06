#!/usr/bin/env node
// Builds the per-season club marks (#1591): reads seed.json, asks Wikimedia
// Commons for each file's licence, downloads only a file Commons marks as
// public domain or CC0, and writes src/lib/data/season-marks.json plus the art
// in public/logos/historical/. Hand-run, not on a cron: the art is immutable,
// so nothing goes stale (docs/scripts/generators.md, "hand-run").
//
// Any other licence (CC BY-SA and the like) is NOT downloaded. Its era keeps
// `file: null` and a `skipped` note, so the reader draws the monogram and the
// maintainer sees what needs a decision. A "trademarked" restriction is
// recorded, never hidden: a public-domain copyright says nothing about the
// mark itself.
//
// Usage: node scripts/season-marks/fetch.mjs [--dry] [--offline]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT_JSON = join(ROOT, 'src/lib/data/season-marks.json')
const OUT_DIR = join(ROOT, 'public/logos/historical')
const UA = 'TallyBaseball/0.1 (gary.zilavy@gmail.com)'
const API = 'https://commons.wikimedia.org/w/api.php'
const FREE = /^(public domain|cc0)/i
const dry = process.argv.includes('--dry')
// --offline records the files already on disk and downloads nothing, so a
// rate-limited host cannot stall the manifest. A later plain run fills the rest.
const offline = process.argv.includes('--offline')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Commons rate-limits with a 429 (upload host) or a plain-text body (API), so
// honour Retry-After when it is sent, else back off, and retry.
async function get(url, asJson, tries = 8) {
  for (let n = 0; n < tries; n++) {
    await sleep(3000 * (n + 1))
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.status === 429 && !asJson) {
      // The upload host asks for a long pause (600 s seen). Retrying inside it
      // only extends it, so stop for the whole run and say how long to wait.
      throw new Error(`429, retry after ${res.headers.get('retry-after') ?? '?'} s`)
    }
    if (res.status === 429) {
      await sleep(Math.min(Number(res.headers.get('retry-after')) || 0, 120) * 1000)
      continue
    }
    if (res.ok) {
      if (!asJson) return Buffer.from(await res.arrayBuffer())
      const text = await res.text()
      try {
        return JSON.parse(text)
      } catch {
        /* rate-limited body: retry */
      }
    }
  }
  throw new Error(`gave up on ${url}`)
}

async function fileInfo(titles) {
  const u = new URL(API)
  const params = {
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|Restrictions',
    titles: titles.join('|'),
  }
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const data = await get(u, true)
  const byTitle = new Map()
  for (const p of Object.values(data.query.pages)) {
    const ii = p.imageinfo?.[0]
    if (!ii) continue
    byTitle.set(p.title, {
      url: ii.url,
      license: ii.extmetadata?.LicenseShortName?.value ?? '',
      restriction: ii.extmetadata?.Restrictions?.value ?? '',
    })
  }
  // Commons normalises titles (underscores, case); map the asked-for ones back.
  const norm = data.query.normalized ?? []
  for (const n of norm) if (byTitle.has(n.to)) byTitle.set(n.from, byTitle.get(n.to))
  return byTitle
}

const seed = JSON.parse(readFileSync(join(HERE, 'seed.json'), 'utf8'))
const titles = [
  ...new Set(
    Object.values(seed.clubs)
      .flat()
      .map((e) => e.commons)
      .filter(Boolean),
  ),
]
const info = new Map()
for (let i = 0; i < titles.length; i += 20) {
  for (const [k, v] of await fileInfo(titles.slice(i, i + 20))) info.set(k, v)
}

mkdirSync(OUT_DIR, { recursive: true })
const out = { _hint: JSON.parse(readFileSync(OUT_JSON, 'utf8'))._hint, clubs: {} }
const skipped = []
let blockedBy = null
for (const [teamId, eras] of Object.entries(seed.clubs)) {
  out.clubs[teamId] = []
  for (const era of eras) {
    const entry = { from: era.from, to: era.to, name: era.name, file: null }
    const meta = era.commons ? info.get(era.commons) : null
    if (era.commons && !meta) {
      entry.skipped = 'not found on Commons'
      skipped.push(`${teamId} ${era.from}-${era.to}: ${era.commons} not found`)
    } else if (meta && !FREE.test(meta.license)) {
      entry.source = `https://commons.wikimedia.org/wiki/${encodeURIComponent(era.commons.replaceAll(' ', '_'))}`
      entry.license = meta.license
      entry.skipped = 'licence needs a maintainer decision'
      skipped.push(`${teamId} ${era.from}-${era.to}: ${era.commons} is ${meta.license}`)
    } else if (meta) {
      const file = `${teamId}-${era.from}-${era.to}${extname(new URL(meta.url).pathname).toLowerCase()}`
      // A download the host refuses (429) leaves the era without art and says
      // so; running the script again picks up where it stopped.
      let have = existsSync(join(OUT_DIR, file))
      if (!dry && !have && offline) {
        entry.skipped = 'not downloaded yet; run fetch.mjs without --offline'
      } else if (!dry && !have && blockedBy) {
        entry.skipped = 'download refused; run fetch.mjs again'
      } else if (!dry && !have) {
        try {
          writeFileSync(join(OUT_DIR, file), await get(meta.url, false, 2))
          have = true
          await sleep(4000)
        } catch (err) {
          blockedBy = err.message
          entry.skipped = 'download refused; run fetch.mjs again'
        }
      }
      entry.file = have || dry ? file : null
      entry.source = `https://commons.wikimedia.org/wiki/${encodeURIComponent(era.commons.replaceAll(' ', '_'))}`
      entry.license = meta.license
      if (meta.restriction) entry.restriction = meta.restriction
    }
    out.clubs[teamId].push(entry)
  }
}
if (!dry) writeFileSync(OUT_JSON, `${JSON.stringify(out, null, 2)}\n`)
const withArt = Object.values(out.clubs).flat().filter((e) => e.file).length
const total = Object.values(out.clubs).flat().length
console.log(`${withArt} of ${total} eras have art${dry ? ' (dry run, nothing written)' : ''}`)
if (blockedBy) console.log(`Downloads stopped: ${blockedBy}. Run again later.`)
if (skipped.length) console.log(`Needs a decision:\n  ${skipped.join('\n  ')}`)
