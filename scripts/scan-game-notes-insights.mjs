#!/usr/bin/env node
// Game Notes → curation signal: the MANUALLY-TRIGGERED scan behind issue #774.
//
// This is not a generator and not a cron job. It has two modes, and a reading
// job sits between them that only a person (or the agent running this) can do:
//
//   1. node scripts/scan-game-notes-insights.mjs extract 158
//      node scripts/scan-game-notes-insights.mjs extract all --days=2
//
//      Pulls each club's recent Game Notes PDFs (URLs from the committed
//      public/data/game-notes/{teamId}.json), extracts the narrative blurbs
//      with the SHIPPED parser (extractForTeam, src/api/whatsBrewing.js), and
//      writes a dossier: the raw blurb text, the club's roster (name →
//      personId), and — the part that makes the reading job tractable — the
//      facts gen-callouts.mjs ALREADY computed for that club, read straight off
//      the committed callouts bundles. Default out path is under
//      .scratch/game-notes/insights/.
//
//   2. READ the dossier and classify every blurb yourself. For each one:
//      a `tier` (timeless / standing / result — see SPOILER_TIERS) and, when
//      the blurb writes about a fact the dossier's `computed` block already
//      holds for that player, the `signals` it corroborates
//      (CORROBORATION_SIGNALS). Feeding the raw text to a reader rather than
//      pattern-matching the parse is deliberate: the richer clubs' PDFs parse
//      messily (a prospect note spliced mid-sentence, a stat table folded into
//      a blurb) and a reader gets through that fine where a matcher would not.
//      See .scratch/game-notes/INSIGHTS-EXPLORATION.md, finding 3.
//
//   3. node scripts/scan-game-notes-insights.mjs apply verdicts.json
//
//      Validates the classification and writes
//      public/data/game-notes-corroboration.json. `result`-tier entries are
//      REFUSED here, not merely ignored: a recap is the score of a game the
//      reader has not watched. Then re-run gen-callouts.mjs for the slate —
//      it reads that file and writes a `corroborated` map onto each bundle,
//      which nudges the matching callout's worthiness score by a small bounded
//      amount (corroborationBonus, src/api/callout-notes/shared.js).
//
// Nothing from the notes is ever rendered. The only thing that crosses into the
// app is a number nudge on a note bbsbh wrote itself from the stats feed.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractForTeam, whatsBrewingLayout, whatsBrewingPage } from '../src/api/whatsBrewing.js'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs } from './lib/args.mjs'
import { buildCorroborationFile, CORROBORATION_SIGNALS, SPOILER_TIERS } from './lib/game-notes-corroboration.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const notesDir = join(root, 'public', 'data', 'game-notes')
const calloutsDir = join(root, 'public', 'data', 'callouts')
const outFile = join(root, 'public', 'data', 'game-notes-corroboration.json')
const defaultDossierDir = join(root, '.scratch', 'game-notes', 'insights')

const DEFAULT_DAYS = 2

const argv = process.argv.slice(2)
const mode = argv[0]
const positional = argv.slice(1).filter((a) => !a.startsWith('--'))
const args = parseArgs(argv.slice(1))
const isoNow = () => new Date().toISOString()

// --- extract -----------------------------------------------------------------

// Every club with a committed notes file, ascending — `extract all`'s roster.
async function allTeamIds() {
  const names = await readdir(notesDir)
  return names
    .filter((n) => /^\d+\.json$/.test(n))
    .map((n) => Number(n.replace('.json', '')))
    .sort((a, b) => a - b)
}

// The club's recent PDFs, newest first, from the committed accumulating file.
async function recentNotes(teamId, days) {
  const j = JSON.parse(await readFile(join(notesDir, `${teamId}.json`), 'utf8'))
  return (j?.notes ?? []).slice(0, days)
}

// Blurbs out of one PDF, through the shipped per-club calibration. Mirrors
// fetchWhatsBrewing's parse (docs/whats-brewing.md's Node harness) minus the
// browser: same page, same fonts, same extractor, so what this reads is exactly
// what the app would.
async function blurbsFromPdf(url, teamId) {
  const buf = new Uint8Array(await fetch(url).then((r) => r.arrayBuffer()))
  const doc = await getDocument({ data: buf, disableWorker: true }).promise
  try {
    const page = await doc.getPage(whatsBrewingPage(teamId) ?? 1)
    await page.getOperatorList() // resolves fonts into commonObjs
    const tc = await page.getTextContent()
    const realName = (fn) => {
      try {
        return page.commonObjs.get(fn)?.name || ''
      } catch {
        return ''
      }
    }
    return extractForTeam(tc.items, realName, teamId)
  } finally {
    doc.destroy?.()
  }
}

// The club's 40-man, as personId → display name. The classifier needs this to
// turn "Contreras" in a blurb into the id a callout is keyed by.
async function rosterFor(teamId) {
  const j = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=40Man`)
  const out = new Map()
  for (const e of j?.roster ?? []) {
    if (e?.person?.id) out.set(e.person.id, e.person.fullName ?? '')
  }
  return out
}

// What gen-callouts.mjs already computed for this club, read off the newest
// committed bundle that has the club in it. This is the JOIN TABLE: a blurb
// only earns a signal when it writes about something in here, so handing it to
// the classifier alongside the blurbs is what keeps the reading job honest
// (and stops it inventing a corroboration for a fact we never computed).
async function computedFactsFor(teamId, roster) {
  let dates
  try {
    dates = (await readdir(calloutsDir)).filter((n) => /^\d{8}$/.test(n)).sort().reverse()
  } catch {
    return { date: null, players: {} }
  }
  for (const dir of dates) {
    let files
    try {
      files = await readdir(join(calloutsDir, dir))
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      let b
      try {
        b = JSON.parse(await readFile(join(calloutsDir, dir, f), 'utf8'))
      } catch {
        continue
      }
      if (b?.away?.teamId !== teamId && b?.home?.teamId !== teamId) continue
      const players = {}
      const row = (id) => (players[id] ??= { name: roster.get(Number(id)) ?? '' })
      for (const [id, L] of Object.entries(b.leaders ?? {})) {
        if (roster.has(Number(id))) row(id).leader = L.cats
      }
      for (const [id, P] of Object.entries(b.pitcherLeaders ?? {})) {
        if (roster.has(Number(id))) row(id).leader = { ...(row(id).leader ?? {}), ...P.cats }
      }
      for (const [id, s] of Object.entries(b.streaks ?? {})) {
        if (!roster.has(Number(id))) continue
        if (s?.onBase) row(id).onBase = s.onBase
        if (s?.stolenBase) row(id).sbStreak = s.stolenBase
      }
      for (const [id, rec] of Object.entries(b.homerRecords ?? {})) {
        if (roster.has(Number(id))) row(id).homerRec = rec
      }
      // The one join target outside callout-notes/: Margin Notes' scoreless
      // run (src/api/pitcher-callouts.js). A club's notes write about a
      // reliever's scoreless stretch more often than about anything else the
      // vocabulary can name, so leaving it out of the table would have hidden
      // the scan's own best material.
      for (const [id, rec] of Object.entries(b.starterRecords ?? {})) {
        if (roster.has(Number(id)) && rec?.scorelessStreak > 1) {
          row(id).scorelessStreak = rec.scorelessStreak
        }
      }
      // Drop the bare rows the `row()` helper created for players with nothing
      // computed — an empty row is not a join target.
      for (const [id, p] of Object.entries(players)) {
        if (Object.keys(p).length <= 1) delete players[id]
      }
      return { date: b.date ?? null, gamePk: b.gamePk ?? null, players }
    }
  }
  return { date: null, players: {} }
}

async function runExtract() {
  const days = Number(args.days) || DEFAULT_DAYS
  const ids =
    positional[0] && positional[0] !== 'all'
      ? positional[0].split(',').map(Number)
      : await allTeamIds()

  const clubs = []
  for (const teamId of ids) {
    const layout = whatsBrewingLayout(teamId)
    if (!layout) {
      console.error(`${teamId}: un-calibrated club, skipped`)
      continue
    }
    let notes = []
    try {
      notes = await recentNotes(teamId, days)
    } catch {
      console.error(`${teamId}: no committed notes file, skipped`)
      continue
    }
    const roster = await rosterFor(teamId).catch(() => new Map())
    const computed = await computedFactsFor(teamId, roster)
    const out = []
    for (const n of notes) {
      try {
        const blurbs = await blurbsFromPdf(n.url, teamId)
        out.push({ date: n.date, title: n.title, url: n.url, blurbs })
        console.error(`${teamId} ${n.date}: ${blurbs.length} blurbs`)
      } catch (err) {
        console.error(`${teamId} ${n.date}: parse failed — ${err.message}`)
      }
    }
    clubs.push({
      teamId,
      layout,
      page: whatsBrewingPage(teamId) ?? 1,
      roster: [...roster].map(([id, name]) => ({ id, name })),
      computed,
      notes: out,
    })
  }

  const dossier = {
    generatedAt: isoNow(),
    days,
    // Restated in the file so the classifier reads its instructions beside the
    // material rather than from this script's header.
    tiers: SPOILER_TIERS,
    signals: Object.keys(CORROBORATION_SIGNALS),
    clubs,
  }
  const dest = args.out ? join(root, args.out) : join(defaultDossierDir, `dossier-${isoNow().slice(0, 10)}.json`)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, `${JSON.stringify(dossier, null, 2)}\n`)
  const blurbCount = clubs.reduce((n, c) => n + c.notes.reduce((m, x) => m + x.blurbs.length, 0), 0)
  console.log(`wrote ${dest} — ${clubs.length} clubs, ${blurbCount} blurbs`)
}

// --- apply -------------------------------------------------------------------

async function runApply() {
  const src = positional[0]
  if (!src) {
    console.error('apply needs a verdicts JSON path')
    process.exit(1)
  }
  const parsed = JSON.parse(await readFile(join(root, src), 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : (parsed.entries ?? [])
  const { file, kept, dropped } = buildCorroborationFile(entries, {
    generatedAt: isoNow(),
    scannedThrough: parsed.scannedThrough ?? entries.map((e) => e?.date).filter(Boolean).sort().pop() ?? null,
  })
  // A pass that keeps nothing is a pass that would silently blank the committed
  // file — refuse it, the same way gen-callouts.mjs refuses an empty sweep.
  if (!kept) {
    console.error(`no entries kept (dropped ${JSON.stringify(dropped)}) — leaving ${outFile} alone`)
    process.exit(1)
  }
  await writeFile(outFile, `${JSON.stringify(file, null, 2)}\n`)
  console.log(
    `wrote ${outFile} — ${kept} entries across ${Object.keys(file.teams).length} clubs; ` +
      `dropped ${JSON.stringify(dropped)}`,
  )
  console.log('now re-run: node scripts/gen-callouts.mjs <YYYY-MM-DD>')
}

// --- dispatch ----------------------------------------------------------------

if (mode === 'extract') await runExtract()
else if (mode === 'apply') await runApply()
else {
  console.error('usage: scan-game-notes-insights.mjs extract <teamId|all> [--days=N] [--out=path]')
  console.error('       scan-game-notes-insights.mjs apply <verdicts.json>')
  process.exit(1)
}
