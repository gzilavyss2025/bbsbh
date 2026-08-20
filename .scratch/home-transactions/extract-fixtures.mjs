// Pulls the exact rows behind each case segment 2's tests pin, straight out of
// the cached live window, so the fixtures in test/ are copied rather than
// typed. Run: node .scratch/home-transactions/extract-fixtures.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { raw } = JSON.parse(readFileSync(join(here, 'league-window.json'), 'utf8'))

const CASES = {
  'Castillo trade (SEA->CWS), headcount vs sentence': (t) => /Luis Castillo to Chicago White Sox/.test(t.description || ''),
  'Cubs/Jays double trade on one day, ambiguous lead': (t) => t.typeCode === 'TR' && (t.date === '2026-08-02' || t.effectiveDate === '2026-08-02') && /Jameson Taillon|Kevin Gausman/.test(t.description || ''),
  'Bart/Davitt trade + clearing move naming a traded player': (t) => /Duncan Davitt|Joey Bart/.test(t.description || '') && (t.effectiveDate ?? t.date) === '2026-08-03',
  'Trivino: two identical DFA rows plus the outright': (t) => /Lou Trivino III/.test(t.description || ''),
  'Gerber: designated and released the same day': (t) => /Joey Gerber/.test(t.description || ''),
  'Rudy Martin Jr.: claimed off waivers, then optioned': (t) => /Rudy Martin Jr\./.test(t.description || ''),
  'McCullers: released and designated in one shuffle': (t) => /Lance McCullers Jr\./.test(t.description || '') && (t.effectiveDate ?? t.date) === '2026-07-26',
  'The 8-face Mets shuffle (413 characters)': (t) => (t.effectiveDate ?? t.date) === '2026-07-31' && (t.toTeam?.id === 121 || t.fromTeam?.id === 121),
  'A row naming no MLB org at all': (t) => t.typeCode === 'ASG' && t.fromTeam?.id === 554,
}

for (const [label, match] of Object.entries(CASES)) {
  const rows = raw.filter(match)
  console.log(`\n// ---- ${label} (${rows.length} rows) ----`)
  for (const t of rows.slice(0, 14)) {
    console.log(JSON.stringify({
      id: t.id, typeCode: t.typeCode, date: t.date, effectiveDate: t.effectiveDate,
      person: t.person ? { id: t.person.id, fullName: t.person.fullName } : undefined,
      fromTeam: t.fromTeam ? { id: t.fromTeam.id, name: t.fromTeam.name } : undefined,
      toTeam: t.toTeam ? { id: t.toTeam.id, name: t.toTeam.name } : undefined,
      description: t.description,
    }))
  }
}
