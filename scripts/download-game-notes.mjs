#!/usr/bin/env node
// Save a local copy of every archived Game Notes PDF (#1258).
//
//   node scripts/download-game-notes.mjs                 every club
//   node scripts/download-game-notes.mjs --team 158      one club (a cheap test run)
//   node scripts/download-game-notes.mjs --dir ~/notes   somewhere other than the default
//
// NOT a generator and on NO cron: it is run by hand, when the reader wants the
// PDFs on disk as a historical record. It reads the archive gen-game-notes.mjs
// already keeps (public/data/game-notes/{teamId}.json) and fetches nothing else.
//
// Files land in game-notes-archive/{teamId}/{date}_{id}.pdf (gitignored). A file
// already there is skipped, so a second run downloads only what the nightly
// archive has added since. #911 measured a first full run at about 2 GB and about
// 30 minutes, so it goes four at a time. Exits 1 if any PDF failed, and a re-run
// retries just those.
//
// The loop and the naming are in scripts/lib/game-notes-download.mjs, where the
// unit suite tests them; this file only parses arguments and prints.

import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { archiveRows } from '../src/lib/gameNotes/archive.js'
import { downloadMissing } from './lib/game-notes-download.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ARCHIVE = join(ROOT, 'public', 'data', 'game-notes')

function args(argv) {
  const out = { team: null, dir: join(ROOT, 'game-notes-archive'), concurrency: 4 }
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=')
    const value = () => inline ?? argv[++i]
    if (flag === '--team') out.team = Number(value())
    else if (flag === '--dir') out.dir = resolve(value())
    else if (flag === '--concurrency') out.concurrency = Number(value())
    else throw new Error(`Unknown option ${argv[i]}`)
  }
  if (out.team !== null && !Number.isInteger(out.team)) throw new Error('--team takes a team id')
  if (!Number.isInteger(out.concurrency) || out.concurrency < 1) {
    throw new Error('--concurrency takes a whole number of 1 or more')
  }
  return out
}

async function loadShards(team) {
  const files = (await readdir(ARCHIVE)).filter((f) => /^\d+\.json$/.test(f))
  const shards = []
  for (const f of files) {
    const teamId = Number(f.replace('.json', ''))
    if (team !== null && teamId !== team) continue
    const { notes = [] } = JSON.parse(await readFile(join(ARCHIVE, f), 'utf8'))
    shards.push({ teamId, notes })
  }
  return shards
}

async function main() {
  const opts = args(process.argv.slice(2))
  const rows = archiveRows(await loadShards(opts.team), () => '')
  if (rows.length === 0) {
    console.error(opts.team === null ? 'The archive is empty.' : `No archived notes for team ${opts.team}.`)
    process.exit(1)
  }
  console.log(`${rows.length} archived PDFs -> ${opts.dir}`)

  const result = await downloadMissing({
    rows,
    dir: opts.dir,
    concurrency: opts.concurrency,
    onProgress: ({ done, total }) => {
      if (done % 100 === 0 || done === total) console.log(`  ${done} / ${total}`)
    },
  })

  console.log(
    `Saved ${result.saved}, already had ${result.skipped}, failed ${result.failed.length}` +
      `, listed twice ${result.repeats}, name clash ${result.collided.length}.`,
  )
  for (const { row, sameAs } of result.collided) {
    console.error(`  NOT SAVED ${row.date} ${row.teamId} ${row.url} — same file name as ${sameAs.url}`)
  }
  for (const { row, reason } of result.failed) console.error(`  FAILED ${row.date} ${row.teamId} ${row.url} — ${reason}`)
  if (result.failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
