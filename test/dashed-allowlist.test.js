// Dashed means ONE thing: provisional, pencilled in (#1132). Every dashed rule
// under src/styles/ must be named below, grouped by why it may stay dashed.
// A new dashed rule fails here until someone argues it into a group. An entry
// whose rule is no longer dashed fails too, so the list can only shrink.
// Doors and row dividers are not in any group: they draw solid
// (door-solid.test.js and row-divider-solid.test.js name them one by one).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const STYLES = join(import.meta.dirname, '..', 'src', 'styles')

const ALLOWED = {
  // Provisional: the scorebook's own pencil mark. A hatched option year, a placed
  // extra-innings runner, a postponed game, a bye seed, a bracket slot not yet
  // decided, a figure on too thin a sample, a projection.
  provisional: [
    ['05-masthead-nav.css', '.levelprog__step.is-unreached::before'],
    ['05-masthead-nav.css', '.levelprog__step.is-target.is-unreached'],
    ['06-loader-and-cards.css', '.postponed'],
    ['27-player-position-innings.css', '.asof-banner'], // as-of: the figures are pencilled to a date (Gary)
    ['13-play-by-play.css', '.pbp__card--placed'],
    ['13-play-by-play.css', '.pbp__placed'],
    ['26b-player-contract.css', '.contractcard__openzone'],
    ['26d-command-map.css', '.cmdmap__chip--thin'],
    ['26e-contract-history.css', '.cthist__fuzzy'],
    ['34-postseason.css', '.seed--bye'],
    ['73-spray-map.css', '.spray__chip--thin'],
    ['77-express-lane.css', '.xl__chip--placed'],
    ['80-postseason-bracket.css', '.pbkt-mark--empty'],
    ['80-postseason-bracket.css', '.pbkt-blank'],
    ['postseason/series-live.css', '.psseries__starter .projection'],
  ],
  // Waiting is provisional: an empty or loading slot that holds its place. The
  // EmptyState itself, sized tiles in a rail, round stamp slots (ADR-0035) and
  // the passport's trays and marks. None is a text box EmptyState could draw.
  waiting: [
    ['system/empty-state.css', '.emptystate'],
    ['29-team-transactions.css', '.teamphotos__loading'],
    ['52-highlight-clip-card.css', '.hlclip__loading'],
    ['48-logbook.css', '.logbook__pending'],
    ['48-stamp-strip.css', '.stampstrip__mount--empty'],
    ['49-passport-book.css', '.passportpage__pending'],
    ['49-passport-book.css', '.passportpage__cell'],
    ['49-passport-book.css', '.passportpage__crosshair'],
    ['49-passport-book.css', '.logbook__tray'],
    ['49-passport-book.css', '.logbook__order'],
    ['47-trade-deadline.css', '.trade__considerationicon'],
    ['68-around-the-game.css', '.method'],
  ],
  // Chart reference lines: a mean, a median, a key bar. Not a UI state.
  chartLine: [
    ['26a-percentile-strip.css', '.pctstrip__track::before'],
    ['26f-glove-target.css', '.glovetarget__keyitem--median::before'],
    ['report/charts.css', '.colchart__rule--mean'],
    ['postseason/series-parts.css', '.psseries__keybar'],
  ],
  // Admin and lab screens: dev-only, not the reader's app.
  adminLab: [
    ['15-team-color-lab.css', '.colorlab__logodropzone--over'],
    ['17-identity-lab-workbench.css', '.idlab__monoinkart'],
    ['17-identity-lab-workbench.css', '.idlab__barmock--unset'],
    ['17-identity-lab-workbench.css', '.idlab__chiptick--unset'],
    ['17-identity-lab-workbench.css', '.idlab__glove'],
    ['17a-identity-lab-mark-panels.css', '.idlab__eraart'],
    ['45-admin-copy-editor.css', '.admincopy__preview'],
    ['61-ballpark-admin.css', '.bpadmin'],
    ['61-ballpark-admin.css', '.bpadmin__focusTarget'],
    ['62-identity-admin.css', '.iddrawer'],
    ['62-identity-admin.css', '.idlab__barmock--unset'],
    ['designlab/lab.css', '.dlab__entry'],
    ['scout/scout.css', '.scout__lab'],
  ],
  // A connector line that joins two things on a graph: it links, it does not
  // box anything. Dashed marks the link as a degree, not a fact (Gary, 2026-10-07).
  connector: [['teammates/teammates.css', '.degrees__link']],
}
// scorecard/ is the sheet you score on: bespoke, out of scope (#1132).
const BESPOKE = 'scorecard/'

const walk = (d) => readdirSync(d, { recursive: true }).filter((f) => f.endsWith('.css'))
const allowed = new Set(Object.values(ALLOWED).flat().map(([f, s]) => `${f} | ${s}`))

test('every dashed rule is on the allowlist, and every entry is still dashed', () => {
  const seen = new Set()
  const bad = []
  for (const f of walk(STYLES)) {
    if (f.startsWith(BESPOKE)) continue
    const src = readFileSync(join(STYLES, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const [, list, body] of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/dashed/.test(body)) continue
      for (const s of list.split(',').map((x) => x.replace(/\s+/g, ' ').trim())) {
        const key = `${f} | ${s}`
        seen.add(key)
        if (!allowed.has(key)) bad.push(key)
      }
    }
  }
  assert.deepEqual(bad, [], 'dashed is for pencilled-in marks: solid, or add it to a group with a reason')
  assert.deepEqual([...allowed].filter((k) => !seen.has(k)), [], 'stale entry: remove it')
})
