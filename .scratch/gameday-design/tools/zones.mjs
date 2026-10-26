// The batter zone map's data: MLB's hotColdZones for one hitter, season through the day BEFORE the game
// (endDate), so the scored game is not in it. Fetch /api/v1/people/{id}/stats?stats=hotColdZones&group=hitting
// &season=2026&sportId=1&endDate=2026-08-31 to a file first. node zones.mjs <saved.json> <name> <out.js>
import fs from 'node:fs'
const [file, name, out] = process.argv.slice(2)
const splits = JSON.parse(fs.readFileSync(file, 'utf8')).stats[0].splits
const pick = (stat) => Object.fromEntries(splits.find((s) => s.stat.name === stat).stat.zones.map((z) => [z.zone, { v: z.value, temp: z.temp }]))
const data = { name, through: '2026-08-31', avg: pick('battingAverage'), slg: pick('sluggingPercentage') }
fs.writeFileSync(out, `// Batter zone map data (tools/zones.mjs): ${name}, season through ${data.through}, the day before gamePk 824716.\nwindow.GD_ZONES = ${JSON.stringify(data)}\n`)
console.log(JSON.stringify(data.avg))
