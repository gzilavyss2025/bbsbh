// The filesystem half of the lab's Eras editor — the /__dev/era and
// /__dev/era-art branches of vite.config.js's devDataSave() middleware
// (ADR-0029). The lab owns src/lib/data/season-marks.json and the art in
// public/logos/historical/ (#1591); scripts/season-marks/fetch.mjs is only a
// one-time bootstrap now.
//
// Three operations, all server-owned:
//
//   SAVE    add an era to a club, or edit one (`replaceFrom` names the era's
//           current first season). An edit keeps every field the form does not
//           show: the art file, the source and licence notes.
//   DELETE  drop an era, and its art file with it.
//   ART     write one SVG as the era's mark and point the era's `file` at it.
//
// Eras hang off the CURRENT franchise id (the same key the rest of the lab
// uses), so a relocated or renamed club keeps one list. An era never overlaps
// a sibling, because seasonMark takes the first match.
//
// Same security boundary as its neighbours: a request supplies a numeric team
// id and season numbers, never a path. The art name is rebuilt from them, and
// resolveEraFile() re-checks the result.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describeMarkRejection } from '../dev-custom-marks.mjs'

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)))

export const DEV_ERA_ROUTE = 'era'
export const DEV_ERA_ART_ROUTE = 'era-art'

// Vector markup, like the custom marks: the cap stops a runaway body, it is not
// a standard.
export const DEV_ERA_ART_MAX_BODY_BYTES = 512 * 1024

const ART_DIR = 'public/logos/historical'
const STORE_FILE = 'src/lib/data/season-marks.json'
const FIRST_SEASON = 1876

// `119-1945-1957.svg`, or `.png` for the art fetch.mjs already placed.
export function resolveEraFile(name) {
  if (typeof name !== 'string' || !/^[1-9]\d*-\d{4}-\d{4}\.(svg|png)$/.test(name)) {
    throw new Error(`era art name is not writable: ${name}`)
  }
  const abs = path.resolve(REPO_ROOT, ART_DIR, name)
  const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/')
  if (rel !== `${ART_DIR}/${name}`) throw new Error(`era art escapes the art directory: ${rel}`)
  return abs
}

const isYear = (n) => Number.isInteger(n)

function describeEraProblem(teamId, era) {
  if (!Number.isInteger(teamId) || teamId <= 0) return 'teamId must be a positive integer'
  if (!isYear(era.from) || !isYear(era.to)) return 'seasons must be whole years'
  if (era.from < FIRST_SEASON) return `the first season cannot be before ${FIRST_SEASON}`
  if (era.to < era.from) return 'the last season cannot be before the first'
  if (typeof era.name !== 'string' || !era.name.trim() || era.name.length > 80) return 'give the era a name (80 characters at most)'
  if (typeof era.abbr !== 'string' || !/^[A-Z]{2,4}$/.test(era.abbr)) return 'the abbreviation is 2 to 4 capital letters'
  if (era.source != null && (typeof era.source !== 'string' || era.source.length > 300)) return 'the source note is 300 characters at most'
  return null
}

// Pure: the store after the save, or a `problem`. Kept apart from the file
// writes so the unit suite exercises every branch without a temp directory.
export function applyEraSave(store, { teamId, era, replaceFrom = null }) {
  const problem = describeEraProblem(teamId, era)
  if (problem) return { problem, status: 400 }

  const clubs = { ...store.clubs }
  const eras = [...(clubs[String(teamId)] ?? [])]
  let kept = null
  if (replaceFrom != null) {
    const at = eras.findIndex((e) => e.from === replaceFrom)
    if (at < 0) return { problem: `team ${teamId} has no era starting ${replaceFrom}`, status: 404 }
    kept = eras.splice(at, 1)[0]
  }
  const clash = eras.find((e) => era.from <= e.to && era.to >= e.from)
  if (clash) return { problem: `${era.from}-${era.to} overlaps ${clash.from}-${clash.to}`, status: 409 }

  const next = { ...kept, from: era.from, to: era.to, name: era.name.trim(), abbr: era.abbr }
  if (kept == null) next.file = null
  if (era.source != null) next.source = era.source.trim()
  if (next.source === '') delete next.source
  eras.push(next)
  eras.sort((a, b) => a.from - b.from)
  clubs[String(teamId)] = eras
  return { store: { ...store, clubs }, era: next }
}

// Pure: the store without the era, plus the art file that went with it.
export function applyEraDelete(store, { teamId, from }) {
  const eras = store.clubs?.[String(teamId)] ?? []
  const gone = eras.find((e) => e.from === from)
  if (!gone) return { problem: `team ${teamId} has no era starting ${from}`, status: 404 }
  const clubs = { ...store.clubs }
  const left = eras.filter((e) => e !== gone)
  if (left.length) clubs[String(teamId)] = left
  else delete clubs[String(teamId)]
  return { store: { ...store, clubs }, file: gone.file ?? null }
}

async function readStore() {
  return JSON.parse(await readFile(path.resolve(REPO_ROOT, STORE_FILE), 'utf8'))
}

// Clubs sorted by id and pretty-printed, the canonical form the other stores
// use, so a save's diff shows the club that changed and nothing else.
async function writeStore(store) {
  const clubs = Object.fromEntries(
    Object.keys(store.clubs)
      .map(Number)
      .sort((a, b) => a - b)
      .map((id) => [String(id), store.clubs[String(id)]]),
  )
  await writeFile(path.resolve(REPO_ROOT, STORE_FILE), `${JSON.stringify({ ...store, clubs }, null, 2)}\n`)
}

export async function saveEra(input) {
  const out = applyEraSave(await readStore(), input)
  if (out.problem) return out
  await writeStore(out.store)
  return { era: out.era }
}

export async function deleteEra(input) {
  const out = applyEraDelete(await readStore(), input)
  if (out.problem) return out
  await writeStore(out.store)
  if (out.file) await rm(resolveEraFile(out.file), { force: true })
  return { deleted: true }
}

// Write one SVG as the era's mark. Refused when the markup is not an SVG or
// carries anything executable (the same gate the custom marks use). A mark
// already on the era is replaced; its old file goes if the name changes (a
// fetched PNG becoming an SVG, say).
export async function saveEraArt({ teamId, from, svg }) {
  const rejection = describeMarkRejection(svg)
  if (rejection) return { problem: rejection, status: 400 }
  const store = await readStore()
  const era = store.clubs?.[String(teamId)]?.find((e) => e.from === from)
  if (!era) return { problem: `team ${teamId} has no era starting ${from}`, status: 404 }

  const name = `${teamId}-${era.from}-${era.to}.svg`
  await mkdir(path.resolve(REPO_ROOT, ART_DIR), { recursive: true })
  await writeFile(resolveEraFile(name), String(svg))
  if (era.file && era.file !== name) await rm(resolveEraFile(era.file), { force: true })
  era.file = name
  delete era.skipped
  await writeStore(store)
  return { file: name, url: `/logos/historical/${name}` }
}
