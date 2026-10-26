// The score-free notes (src/api/between-innings.js) for one closed half, through the repo's own builders.
// 824716 has no callout bundle (public/data/callouts holds only the nightly window), so round 2 draws the
// notes page from a game that has one. node facts2.mjs <feed.json> <bundle.json> <inning> <top|bottom> <date> <out.js>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src')
const load = (p) => import(pathToFileURL(path.join(SRC, p)).href)
const { buildBetweenInnings } = await load('api/between-innings.js')
const { buildMarginNotes } = await load('api/pitcher-callouts.js')
const { halfIndex } = await load('api/select.js')
const [feedFile, bundleFile, inn, half, date, out] = process.argv.slice(2)
const feed = JSON.parse(fs.readFileSync(feedFile, 'utf8')), bundle = JSON.parse(fs.readFileSync(bundleFile, 'utf8'))
const rt = halfIndex(+inn, half)
const margin = buildMarginNotes(feed, rt, bundle, { away: bundle.away?.name, home: bundle.home?.name }) || []
const notes = buildBetweenInnings({ feed, bundle, marginNotes: margin, inning: +inn, half, revealedThrough: rt, gameDate: date })
const name = (id) => feed.gameData.players['ID' + id]?.fullName ?? ''
const facts = notes.map((n) => ({ kind: n.kind, who: n.personId ? name(n.personId) : '', text: n.text }))
const g = feed.gameData
const meta = { pk: feed.gamePk, game: `${g.teams.away.abbreviation} @ ${g.teams.home.abbreviation}, ${g.datetime.officialDate}`, half: `${half} ${inn}` }
fs.writeFileSync(out, `// The score-free notes after one closed half, built by tools/facts2.mjs with the app's own\n// buildBetweenInnings and the game's callout bundle. 824716 has no bundle, so these come from ${meta.game}.\nwindow.GD_FACTS = ${JSON.stringify({ meta, top2: facts })}\n`)
console.log(JSON.stringify(meta), facts)
