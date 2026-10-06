// The file half of `gen-notable.mjs --check-retrosheet`: read the extracted CSVs and the
// index, call the API for a date the index does not explain, print the report. Nothing
// here is written but the optional --report file, and that goes OUTSIDE the repo because
// it holds Retrosheet game ids (ADR-0100). The logic is in retro-check.mjs.
//
//   node scripts/gen-notable.mjs --check-retrosheet --nohitters=DIR --tripleplays=DIR [--index=DIR] [--report=FILE]
//
// Exit 0 when the inputs parse, whatever the labels say. Exit 1 when a file is missing or
// a needed column is gone.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from '../csv.mjs'
import { getJson } from '../statsapi.mjs'
import { gameFromRow, SCHEDULE_FIELDS } from './games.mjs'
import { CHECK_KINDS, RetroInputError, checkRetrosheet, retroEntries } from './retro-check.mjs'
import { formatReport, reportJson } from './retro-report.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url))

const insideRepo = (path) => {
  const rel = relative(REPO, resolve(path))
  return !(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
}

async function readFileOrFail(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    if (err?.code === 'ENOENT') throw new RetroInputError(`${path} is missing`)
    throw err
  }
}

const folderOf = (parsed, kind) => {
  const dir = parsed[kind]
  if (dir === undefined) return null
  if (typeof dir !== 'string' || dir === '') throw new RetroInputError(`--${kind} takes a folder: --${kind}=DIR`)
  return resolve(dir)
}

async function readIndex(dir, kind) {
  const path = join(dir, `${kind}.json`)
  const doc = JSON.parse(await readFileOrFail(path))
  if (!Array.isArray(doc?.coverage?.seasons) || !Array.isArray(doc?.rows)) {
    throw new RetroInputError(`${path} is not a Notable games file (no coverage.seasons or rows)`)
  }
  return doc
}

// One schedule call for a date: the day's games in games.mjs gameFromRow shape.
const dayReader = (get) => async (date) => {
  const data = await get(`/api/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore&fields=${SCHEDULE_FIELDS}`)
  return (data?.dates ?? []).flatMap((d) => d?.games ?? []).map(gameFromRow)
}

// -> the exit code. `parsed` is lib/args.mjs parseArgs of the flags.
export async function runRetroCheck(parsed, { get = getJson, log = console.log } = {}) {
  let calls = 0
  const counted = async (path) => {
    calls += 1
    return get(path)
  }
  try {
    const folders = Object.fromEntries(CHECK_KINDS.map((kind) => [kind, folderOf(parsed, kind)]))
    const kinds = CHECK_KINDS.filter((kind) => folders[kind])
    if (!kinds.length) throw new RetroInputError('give at least one list: --nohitters=DIR or --tripleplays=DIR')
    if (parsed.report !== undefined && (typeof parsed.report !== 'string' || parsed.report === '')) {
      throw new RetroInputError('--report takes a file: --report=FILE')
    }
    if (parsed.report && insideRepo(parsed.report)) {
      throw new RetroInputError(`--report ${resolve(parsed.report)} is inside the repo; give a path outside it`)
    }
    const indexDir = parsed.index ? resolve(parsed.index) : join(REPO, 'public', 'data', 'notable')
    const index = {}
    const entries = []
    for (const kind of kinds) {
      const gameinfo = parseCsv(await readFileOrFail(join(folders[kind], 'gameinfo.csv')))
      const teamstats = parseCsv(await readFileOrFail(join(folders[kind], 'teamstats.csv')))
      entries.push(...retroEntries(kind, gameinfo, teamstats))
      index[kind] = await readIndex(indexDir, kind)
    }
    const report = await checkRetrosheet({ entries, index, scheduleFor: dayReader(counted) })
    log(formatReport(report))
    log(`\nAPI calls: ${calls}. This check writes no data. A person adds a seed row to scripts/notable-seed.json for a true miss.`)
    if (parsed.report) {
      await mkdir(dirname(resolve(parsed.report)), { recursive: true })
      await writeFile(resolve(parsed.report), `${JSON.stringify(reportJson(report), null, 2)}\n`)
      log(`Report written to ${resolve(parsed.report)}`)
    }
    return 0
  } catch (err) {
    if (!(err instanceof RetroInputError)) throw err
    log(`check-retrosheet: ${err.message}`)
    return 1
  }
}
