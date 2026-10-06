// The Table's contract (#1132, slice T1), asserted from the stylesheet text, the
// source tree and the pure class helper, the way card-cascade.test.js does for
// the Card. Each of these would fail silently otherwise: lint green, the page
// rendering, only a screenshot noticing.
//
//   1. THE SLOT. system/table.css loads right after card.css and before 06, so
//      every family partial that keeps a margin or a column width wins on order.
//   2. ONE FRAME, ONE GRID. The wrap draws the box and does the scrolling. The
//      grid draws no edge, never clips, and never sets a cell's display: that is
//      what keeps `position: sticky` working (spec.md, "The sticky trick").
//   3. THE HELPER. An unknown frame or density is refused; `label` makes the
//      wrap a named, focusable region.
//   4. NO IMPORTS. A table may render inside a SealBox reveal, so Table imports
//      no api/ module and no stamp module (ADR-0035).
//   5. THE MOVED TABLES. Each slice-T1 table renders on Table, and its own
//      partial keeps only margin and layout: no cell padding, no head dress, no
//      frame.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DENSITIES, FRAMES, tableParts } from '../src/lib/design/tableClass.js'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()
const rules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim().replace(/\s+/g, ' '), m[2]])
const props = (body) =>
  body
    .split(';')
    .map((d) => d.trim().split(':')[0].trim())
    .filter(Boolean)
const imports = () =>
  [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1])

// One row per table that moved in T1. `wrap` is a rule that reaches the Table's
// wrap from the table's own block (a reflow that has to drop the frame).
const T1 = [
  { css: 'report/game-notes.css', ns: 'gnotes', jsx: 'screens/game-notes/GameNotesArchivePage.jsx', attrs: [] },
  {
    css: '31e-prospect-board.css',
    ns: 'prospectboard',
    jsx: 'screens/ProspectsPage.jsx',
    attrs: [],
    wrap: '.prospectboard-wrap .table',
  },
]

// ---- 1. the slot ----

test('system/table.css is imported right after card.css, and only empty-state.css and notice.css sit before 06', () => {
  const list = imports()
  const card = list.indexOf('system/card.css')
  const table = list.indexOf('system/table.css')
  assert.ok(table !== -1, 'index.css should import system/table.css')
  assert.equal(table, card + 1, 'table.css sits right after card.css')
  // system/empty-state.css (#1132, E1) and system/notice.css (N1) sit between the table and 06; their slots are
  // pinned in empty-state-cascade.test.js and notice-cascade.test.js.
  assert.deepEqual(
    list.slice(table + 1, list.indexOf('06-loader-and-cards.css')),
    ['system/empty-state.css', 'system/notice.css'],
    'only empty-state.css and notice.css sit between table.css and 06, so a namespace rule wins on order',
  )
})

// ---- 2. one frame, one grid ----

test('the wrap draws the box and scrolls; the sheet frame is the only rule that paints it', () => {
  const css = read('system/table.css')
  const wrap = ruleBody(css, '.table')
  assert.equal(decl(wrap, 'overflow-x'), 'auto')
  for (const p of ['border', 'border-radius', 'box-shadow', 'background']) {
    assert.equal(decl(wrap, p), undefined, `.table sets no ${p}: only .table--sheet paints the box`)
  }
  const sheet = ruleBody(css, '.table--sheet')
  assert.equal(decl(sheet, 'border'), 'var(--bw-hair) solid var(--border-rule)')
  assert.equal(decl(sheet, 'border-radius'), 'var(--radius-md)')
  assert.equal(decl(sheet, 'box-shadow'), 'var(--shadow-card)')
  assert.equal(decl(sheet, 'background'), 'var(--surface-card)')
})

test('the grid never frames, never clips and never changes a cell display', () => {
  const css = read('system/table.css')
  const grid = ruleBody(css, '.table__grid')
  assert.equal(decl(grid, 'overflow'), 'visible', 'a clipping table would become the sticky cell\'s scroll container')
  assert.equal(decl(grid, 'border-collapse'), 'separate', 'collapse puts a shared border under the pinned cell, a pixel adrift')
  assert.equal(decl(grid, 'border-spacing'), '0')
  for (const p of ['border', 'border-radius', 'box-shadow']) assert.equal(decl(grid, p), undefined, `.table__grid sets no ${p}`)
  for (const [sel, body] of rules(css)) {
    if (/\.table__grid/.test(sel) && !/:first-child/.test(sel)) assert.equal(decl(body, 'display'), undefined, `${sel} sets no display`)
  }
})

test('the three densities are one custom property, read by one cell rule', () => {
  const css = read('system/table.css')
  assert.equal(decl(ruleBody(css, '.table--row'), '--table-cell'), 'var(--space-1h) var(--space-2)')
  assert.equal(decl(ruleBody(css, '.table--tight'), '--table-cell'), 'var(--space-1) 2px')
  assert.equal(decl(ruleBody(css, '.table--keep'), '--table-cell'), '0', 'keep pads nothing: the namespace sets its own cells')
  const cell = rules(css).filter(([, body]) => decl(body, 'padding') === 'var(--table-cell)')
  assert.equal(cell.length, 1, 'one rule pads every cell')
  assert.match(cell[0][0], /^\.table__grid :where\(th, td\)$/, 'at zero extra weight, so a family rule wins on its own')
})

test('the head and row rules weigh nothing, so a family rule wins on order', () => {
  const css = read('system/table.css')
  assert.equal(decl(ruleBody(css, '.table__grid :where(thead th)'), 'text-transform'), 'uppercase')
  assert.equal(decl(ruleBody(css, '.table__grid :where(tbody th, tbody td)'), 'border-top'), 'var(--bw-hair) solid var(--border-hairline)')
})

test('the sticky column is opaque, restates table-cell and keeps both rounded corners', () => {
  const css = read('system/table.css')
  const pin = ruleBody(css, '.table--sticky .table__grid :is(th, td):first-child')
  assert.equal(decl(pin, 'position'), 'sticky')
  assert.equal(decl(pin, 'left'), '0')
  assert.equal(decl(pin, 'display'), 'table-cell', 'Safari drops sticky on a cell whose display is not table-cell')
  assert.equal(decl(pin, 'background'), 'var(--table-pin, var(--surface-card))', 'scrolled figures must not show through')
  assert.equal(decl(ruleBody(css, '.table--sticky .table__grid thead th:first-child'), 'z-index'), '2')
  assert.equal(
    decl(ruleBody(css, '.table--sheet.table--sticky .table__grid thead tr:first-child th:first-child'), 'border-top-left-radius'),
    'var(--radius-md)',
  )
  assert.equal(
    decl(ruleBody(css, '.table--sheet.table--sticky .table__grid tbody tr:last-child :is(th, td):first-child'), 'border-bottom-left-radius'),
    'var(--radius-md)',
  )
})

test('the scroll region has a focus ring, because a keyboard is its only way in', () => {
  assert.equal(decl(ruleBody(read('system/table.css'), '.table[tabindex]:focus-visible'), 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
})

// ---- 3. the helper ----

test('the helper names the wrap and the grid', () => {
  assert.deepEqual(tableParts(), { wrap: 'table table--sheet table--row', grid: 'table__grid', region: undefined })
  const p = tableParts({ frame: 'bare', density: 'tight', sticky: true, className: 'rolling__grid' })
  assert.equal(p.wrap, 'table table--bare table--tight table--sticky')
  assert.equal(p.grid, 'table__grid rolling__grid', 'the namespace rides on the table, where every family rule hooks')
})

test('an unknown frame or density is a caller typo, and it throws', () => {
  assert.deepEqual(FRAMES, ['sheet', 'bare'])
  assert.deepEqual(DENSITIES, ['row', 'tight', 'keep'])
  assert.throws(() => tableParts({ frame: 'ledger' }), /unknown frame "ledger"/)
  assert.throws(() => tableParts({ density: 'loose' }), /unknown density "loose"/)
})

test('keep is a density that adds no padding, and any other name still throws', () => {
  assert.equal(tableParts({ frame: 'bare', density: 'keep' }).wrap, 'table table--bare table--keep')
  assert.throws(() => tableParts({ density: 'keeps' }), /unknown density "keeps"/)
  assert.throws(() => tableParts({ density: '' }), /unknown density ""/)
})

test('a label makes the wrap a named, focusable region', () => {
  assert.deepEqual(tableParts({ label: 'Batting, Milwaukee' }).region, {
    role: 'region',
    tabIndex: 0,
    'aria-label': 'Batting, Milwaukee',
  })
  assert.equal(tableParts({}).region, undefined, 'no label, no tab stop')
})

// ---- 4. no imports ----

test('Table and its helper import no api/ module and no stamp module', () => {
  for (const rel of ['components/ui/table/Table.jsx', 'lib/design/tableClass.js']) {
    const froms = [...src(rel).matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const from of froms) assert.doesNotMatch(from, /\/api\/|stamp/i, `${rel} imports ${from}`)
  }
})

// ---- 5. the moved tables ----

test('T1: each moved table renders on Table and never on a bare <table>', () => {
  for (const { jsx, ns, attrs } of T1) {
    const code = src(jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    const tags = [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1])
    const own = tags.filter((a) => new RegExp(`className="${ns}"`).test(a))
    assert.equal(own.length, 1, `${jsx}: .${ns} is on one <Table>`)
    for (const a of attrs) assert.match(own[0], new RegExp(a), `${jsx}: .${ns} passes ${a}`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
  }
})

test('T1: a moved table draws no frame, no cell padding and no head dress of its own', () => {
  const FRAME = ['border', 'border-radius', 'box-shadow', 'background', 'overflow', 'border-collapse', 'border-spacing', 'width']
  const HEAD = ['padding', 'background', 'font-family', 'letter-spacing', 'text-transform', 'font-size', 'color']
  for (const { css, ns } of T1) {
    for (const [sel, body] of rules(read(css))) {
      const names = props(body)
      for (const part of sel.split(',').map((x) => x.trim())) {
        // A plain cell: `.ns th`, `.ns td`, `.ns thead th`, `.ns :where(th, td)`, with or without a pseudo-class.
        const plain = part.match(new RegExp(String.raw`^\.${ns} (thead th|tbody td|:where\(th, td\)|th|td)(:[\w-]+(\([^)]*\))?)?$`))
        if (part === `.${ns}`) {
          for (const p of FRAME) assert.ok(!names.includes(p), `${css}: .${ns} still sets ${p}`)
        } else if (plain) {
          assert.ok(!names.includes('padding'), `${css}: ${part} still sets padding`)
          if (/th$/.test(plain[1])) for (const p of HEAD) assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
        }
      }
    }
  }
})

test('T1: a moved table keeps its own margin and layout', () => {
  assert.equal(decl(ruleBody(read('31e-prospect-board.css'), '.prospectboard-wrap'), 'margin-top'), 'var(--space-4)')
  assert.equal(decl(ruleBody(read('31e-prospect-board.css'), '.prospectboard'), 'table-layout'), 'fixed')
  assert.equal(decl(ruleBody(read('report/game-notes.css'), '.gnotes__more'), 'margin-top'), 'var(--space-3)')
  assert.equal(decl(ruleBody(read('report/game-notes.css'), '.gnotes__pdf'), 'white-space'), 'nowrap')
})

test('T1: the phone reflow of the prospect board drops the wrap\'s frame and its clip', () => {
  const [{ css, wrap }] = T1.filter((t) => t.wrap)
  const body = rules(read(css)).find(([sel]) => sel === wrap)?.[1]
  assert.ok(body, `${css}: a ${wrap} rule`)
  for (const [p, v] of [['border', '0'], ['border-radius', '0'], ['box-shadow', 'none'], ['background', 'transparent'], ['overflow', 'visible']]) {
    assert.equal(decl(body, p), v, `${wrap} resets ${p}: the cards draw their own boxes and shadows`)
  }
})

test('T1: the text table says it is not a figure table', () => {
  const body = ruleBody(read('report/game-notes.css'), '.gnotes')
  assert.equal(decl(body, 'font-family'), 'inherit', 'club and title are words, not mono figures')
  assert.equal(decl(body, 'font-variant-numeric'), 'normal')
})

test('T1: the seal pin: neither moved page reads a reveal-only module or a seal', () => {
  for (const { jsx } of T1) {
    const code = src(jsx)
    assert.doesNotMatch(code, /api\/(linescore|derive)\.js|<SealBox|revealedThrough/, `${jsx} is outside the spoiler scope and stays so`)
  }
})

// ---- slice T3: the game surfaces and the team leaders ----
//
// Seven tables in the spoiler scope (the running line, the two pitchers tables,
// the four box score grids) and the team leaders, a list that became two tables
// (decisions Q5). Each renders on Table; its partial keeps only what the family
// IS. Two HELD tables share a base class with a moved one: the scorecard wears
// .pitchers__grid and the inning tally (and two lab demos) wear .bs__grid. Their
// base rules stay, scoped with :where(:not(.table__grid)), so they reach only
// the held tables, at the weight they always had.
//
// `ns` is the namespace class the table keeps (rules, tests and the spoiler e2e
// invariants find it by name). `bases` are the class rules that reach the table:
// none of them may draw a frame, pad a plain cell, dress the head or draw a
// second row rule. `label` is the spoken name of a table that scrolls sideways
// (decisions Q1), or null for one that never does. `apis` is the exact list of
// api/ and stamp modules the file imports: the move adds none (ADR-0035).
const T3 = [
  {
    jsx: 'components/gamehud/RollingLine.jsx',
    ns: 'rolling__grid',
    bases: [['20-charts.css', 'rolling__grid']],
    attrs: ['frame="bare"', 'density="tight"', 'sticky'],
    label: /label="Running line"/,
    apis: ['../../api/select.js', '../../api/linescore.js'],
  },
  {
    jsx: 'components/inning/PitchersSection.jsx',
    ns: 'pitchers__grid',
    bases: [['20-charts.css', 'pitchers__grid']],
    attrs: ['frame="bare"', 'density="tight"'],
    label: null,
    apis: [],
  },
  {
    jsx: 'components/playbyplay/PitcherHandoffCard.jsx',
    ns: 'pitchers__grid',
    bases: [['20-charts.css', 'pitchers__grid']],
    attrs: ['frame="bare"', 'density="tight"'],
    label: /label=\{label\}/,
    apis: [],
  },
  {
    jsx: 'screens/BoxScore.jsx',
    ns: 'bs__grid bs__grid--bat',
    bases: [['21-box-score.css', 'bs__grid'], ['21-box-score.css', 'bs__grid--bat']],
    attrs: ['frame="bare"', 'density="tight"'],
    label: /label=\{`Batting, \$\{side\.teamName\}`\}/,
    apis: [
      '../api/boxscore.js',
      '../api/highlights.js',
      '../api/expresslane/eligibility.js',
      '../api/game.js',
      '../api/defense.js',
      '../api/select.js',
      '../api/umpires.js',
      '../api/challenges.js',
      '../components/logbook/StampGameButton.jsx',
      '../hooks/useStamps.js',
    ],
  },
  {
    jsx: 'screens/BoxScore.jsx',
    ns: 'bs__grid bs__grid--pit',
    bases: [['21-box-score.css', 'bs__grid'], ['21-box-score.css', 'bs__grid--pit']],
    attrs: ['frame="bare"', 'density="tight"'],
    label: /label=\{`Pitching, \$\{side\.teamName\}`\}/,
  },
  {
    jsx: 'screens/BoxScore.jsx',
    ns: 'bs__grid bs__grid--totals',
    bases: [['21-box-score.css', 'bs__grid'], ['23-box-score-detail.css', 'bs__grid--totals']],
    attrs: ['frame="bare"', 'density="tight"'],
    label: null,
  },
  {
    jsx: 'screens/BoxScore.jsx',
    ns: 'bs__grid bs__grid--board',
    bases: [['21-box-score.css', 'bs__grid'], ['23-box-score-detail.css', 'bs__grid--board']],
    attrs: ['frame="bare"', 'density="tight"'],
    label: /label="Line score"/,
  },
  {
    jsx: 'components/teamstats/TeamLeadersLedger.jsx',
    ns: 'tledg__rows',
    bases: [['23-box-score-detail.css', 'tledg__rows']],
    attrs: ['frame="bare"', 'density="row"'],
    label: null,
    apis: ['../../api/teamLeaders.js'],
  },
]
// A selector that reaches only the HELD tables.
const HELD = ':where(:not(.table__grid))'
const tagsOf = (code) => [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1])
// The body of a rule that must exist, with a message that names it.
const need = (css, sel) => {
  const body = ruleBody(css, sel)
  assert.ok(body !== null, `a ${sel} rule`)
  return body
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

test('T3: each moved table renders on Table, keeps its namespace and never sits on a bare <table>', () => {
  for (const { jsx, ns, attrs, label } of T3) {
    const code = src(jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
    const own = tagsOf(code).filter((a) => new RegExp(`className="${esc(ns)}"`).test(a))
    assert.equal(own.length, 1, `${jsx}: .${ns} is on one <Table>`)
    for (const a of attrs) assert.match(own[0], new RegExp(`(^|\\s)${esc(a)}(\\s|$)`), `${jsx}: .${ns} passes ${a}`)
    if (!attrs.includes('sticky')) assert.doesNotMatch(own[0], /(^|\s)sticky(\s|$)/, `${jsx}: .${ns} pins no column`)
    if (label) assert.match(own[0], label, `${jsx}: .${ns} scrolls sideways, so its wrap is a named Tab stop`)
    else assert.doesNotMatch(own[0], /label=/, `${jsx}: .${ns} never scrolls, so it is no Tab stop`)
  }
})

test('T3: two tables on one page never share a spoken name', () => {
  const labels = tagsOf(src('screens/BoxScore.jsx'))
    .map((a) => a.match(/label=(\{`[^`]*`\}|"[^"]*")/)?.[1])
    .filter(Boolean)
  assert.equal(labels.length, 3, 'bat, pit and the line score scroll; the totals card does not')
  assert.equal(new Set(labels).size, 3)
  // The departure card and the finalized card can show together, for the same
  // pitcher: each passes its own name for the table.
  const handoff = src('components/playbyplay/PitcherHandoffCard.jsx')
  assert.match(handoff, /<PitcherLineTable line=\{line\} label=\{`Line at departure, \$\{displayName\(line\)\}`\} \/>/)
  assert.match(handoff, /<PitcherLineTable line=\{line\} label=\{`Final line, \$\{displayName\(line\)\}`\} \/>/)
})

test('T3: no rule that reaches a moved table draws a frame, pads a plain cell, dresses the head or draws a row rule', () => {
  const FRAME = ['border', 'border-radius', 'box-shadow', 'background', 'overflow', 'border-collapse', 'border-spacing', 'width']
  const HEAD = ['padding', 'background', 'font-family', 'letter-spacing', 'text-transform', 'font-size', 'color']
  const ROW = ['border-top', 'border-bottom', 'border']
  for (const { bases } of T3) {
    for (const [css, ns] of bases) {
      for (const [sel, body] of rules(read(css))) {
        const names = props(body)
        for (const part of sel.split(',').map((x) => x.trim())) {
          if (part.includes(HELD)) continue
          // A plain cell: `.ns th`, `.ns td`, `.ns thead th`, `.ns tbody td`,
          // `.ns :where(th, td)`, `.ns :is(th, td)`, `.ns tbody tr:last-child td`.
          const plain = part.match(
            new RegExp(String.raw`^\.${ns} (thead th|tbody td|tbody tr(:[\w-]+)? (th|td)|:where\(th, td\)|:is\(th, td\)|th|td)(:[\w-]+(\([^)]*\))?)?$`),
          )
          if (part === `.${ns}`) {
            for (const p of FRAME) assert.ok(!names.includes(p), `${css}: .${ns} still sets ${p}`)
          } else if (plain) {
            for (const p of ['padding', ...ROW]) assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
            if (/th$/.test(plain[1]) || plain[1] === 'th') for (const p of HEAD) assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
          }
        }
      }
    }
  }
})

test('T3: the held scorecard and inning tally keep their base rules, at their old weight', () => {
  const pit = read('20-charts.css')
  assert.equal(decl(need(pit, `.pitchers__grid${HELD}`), 'border-collapse'), 'collapse')
  assert.equal(decl(need(pit, `.pitchers__grid${HELD} :is(th, td)`), 'padding'), 'var(--space-1h) 1px')
  assert.equal(decl(need(pit, `.pitchers__grid${HELD} thead th`), 'text-transform'), 'uppercase')
  const bs = read('21-box-score.css')
  assert.equal(decl(need(bs, `.bs__grid${HELD}`), 'border-collapse'), 'collapse')
  assert.equal(decl(need(bs, `.bs__grid${HELD} :is(th, td)`), 'padding'), 'var(--space-1) 2px')
  assert.equal(decl(need(bs, `.bs__grid${HELD} thead th`), 'text-transform'), 'uppercase')
  // The held tables still wear the classes these rules hook on.
  assert.match(src('screens/boxscore/InningTally.jsx'), /<table className="bs__grid bs__grid--tally">/)
  assert.match(src('screens/boxscore/InningTally.jsx'), /className="bs__scroll bs__tallyBody"/)
  assert.match(src('screens/Scorecard.jsx'), /<table className="pitchers__grid sc-pitchers">/)
})

test('T3: a moved table keeps its own margin, column widths and figure alignment', () => {
  const kept = [
    ['20-charts.css', '.rolling', 'margin-bottom', 'var(--space-4)'],
    ['20-charts.css', '.rolling__grid td', 'min-width', '24px'],
    ['20-charts.css', '.rolling__grid td', 'text-align', 'center'],
    ['20-charts.css', '.rolling__grid td + td', 'border-left', 'var(--bw-hair) solid var(--border-hairline)'],
    ['20-charts.css', '.rolling__grid td.rolling__cell', 'padding', '0'],
    ['20-charts.css', '.pitchers__grid', 'table-layout', 'fixed'],
    ['20-charts.css', '.pitchers__grid td', 'text-align', 'center'],
    ['20-charts.css', '.pitchers__pitcher', 'width', '36%'],
    ['12-sealbox.css', '.pitcherhandoff .pitchers__grid', 'min-width', '460px'],
    ['21-box-score.css', '.bs__grid td', 'text-align', 'center'],
    ['21-box-score.css', '.bs__team > .table + .table', 'margin-top', '14px'],
    ['21-box-score.css', '.bs__grid--bat', 'table-layout', 'fixed'],
    ['21-box-score.css', '.bs__totals td', 'border-top', 'var(--bw-rule) solid var(--border-rule)'],
    ['23-box-score-detail.css', '.bs__grid--totals', 'table-layout', 'fixed'],
    ['23-box-score-detail.css', '.bs__grid--totals td', 'width', '20%'],
    ['23-box-score-detail.css', '.bs__totalsCard', 'padding', 'var(--space-2h) var(--space-3h) var(--space-3)'],
    ['23-box-score-detail.css', '.bs__board', 'padding', 'var(--space-2h) var(--space-3h) var(--space-3)'],
    ['23-box-score-detail.css', '.tledg__leader', 'max-width', '0'],
    ['23-box-score-detail.css', '.tledg__leader', 'width', '100%'],
    ['23-box-score-detail.css', '.tledg__who .tledg__name', 'text-overflow', 'ellipsis'],
  ]
  for (const [css, sel, prop, value] of kept) {
    assert.equal(decl(need(read(css), sel) ?? '', prop), value, `${css}: ${sel} keeps ${prop}: ${value}`)
  }
})

test('T3: the wrappers that only scrolled are gone; Table\'s wrap is the one scroller', () => {
  for (const [css, sel] of [
    ['12-sealbox.css', '.pitcherhandoff__tablewrap'],
    ['20-charts.css', '.rolling__scroll'],
    ['21-box-score.css', '.bs__scroll + .bs__scroll'],
  ]) {
    assert.equal(ruleBody(read(css), sel), null, `${css}: ${sel} is gone`)
  }
  assert.doesNotMatch(src('components/playbyplay/PitcherHandoffCard.jsx'), /pitcherhandoff__tablewrap/)
  assert.doesNotMatch(src('screens/BoxScore.jsx'), /bs__scroll/, 'the tally keeps .bs__scroll; the box score grids scroll in Table')
})

test('T3: the line score draws each box once, with no doubled edge', () => {
  // Table's grid is border-collapse: separate, so two touching boxes would each
  // draw the shared edge. Each box draws its right and bottom edges; the head
  // row adds the top.
  const css = read('23-box-score-detail.css')
  assert.equal(decl(need(css, '.bs__grid--board :is(.bs__boardInn, .bs__boardFinal)'), 'border-width'), '0 var(--bw-hair) var(--bw-hair) 0')
  assert.equal(decl(need(css, '.bs__grid--board thead :is(.bs__boardInn, .bs__boardFinal)'), 'border-top-width'), 'var(--bw-hair)')
})

test('T3: the running line\'s focus ring sits inside the Card that clips it', () => {
  assert.equal(decl(need(read('20-charts.css'), '.rolling__scroll .table:focus-visible'), 'outline-offset'), 'calc(-1 * var(--bw-heavy))')
})

test('T3: the team leaders are a table of words, with three named columns', () => {
  const code = src('components/teamstats/TeamLeadersLedger.jsx')
  assert.doesNotMatch(code, /<(ul|li)\b/, 'no list rows any more')
  const heads = [...code.matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((m) => m[1])
  assert.deepEqual(heads, ['Category', 'Leader', 'Stat'])
  // The position tag and the injured mark ride in the Leader cell, beside the name.
  assert.match(code, /<td className="tledg__leader">\s*<span className="tledg__who">[\s\S]*tledg__pos[\s\S]*<InjuredMark[\s\S]*<\/span>\s*<\/td>/)
  const body = ruleBody(read('23-box-score-detail.css'), '.tledg__rows')
  assert.equal(decl(body, 'font-family'), 'inherit', 'category and name are words, not mono figures')
  assert.equal(decl(body, 'font-variant-numeric'), 'normal')
})

test('T3: the seal stays where it was: no gate moved and no api/ import added', () => {
  for (const { jsx, apis } of T3) {
    if (!apis) continue
    const froms = [...src(jsx).matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])
    assert.deepEqual(froms.filter((f) => /\/api\/|stamp/i.test(f)), apis, `${jsx} imports exactly the api/ and stamp modules it did`)
  }
  // The running line reads a half only at or under the reveal mark, in the cell.
  const rolling = src('components/gamehud/RollingLine.jsx')
  assert.match(rolling, /if \(idx <= revealedThrough\) return revealInning\(feed, n, side\)/)
  assert.match(rolling, /if \(battingIdx <= revealedThrough\) \{/)
  assert.match(rolling, /if \(halfIndex\(n, fieldingHalf\) <= revealedThrough\) \{/)
  // ADR-0009: the pitchers table is gated by the caller's lines, never a SealBox.
  assert.doesNotMatch(src('components/inning/PitchersSection.jsx'), /<SealBox\b|import \{ SealBox|revealedThrough/)
  // The box score's four grids render only inside the one reveal render, which
  // reads the box score and nothing else reads it.
  const box = src('screens/BoxScore.jsx')
  assert.equal((box.match(/<SealBox\b/g) ?? []).length, 1, 'the box score keeps one SealBox')
  assert.match(box, /\{\(\) => \{\s*const r = revealBoxScore\(revealCacheRef, feed,/)
})

// ---- slice T4: the small ledgers ----
//
// Six tables: the career register and the two splits (one tag, Ledger.jsx), the
// recent-form table, the team page's prospects table, and the three small tables
// that had no side space (awards, moved up, youngest regulars). `tag` finds the
// <Table> by its className; `frame` and `label` are the expected props.
const T4 = [
  { css: '26-player-page.css', ns: 'ledger', jsx: 'components/player/Ledger.jsx', tag: 'className=\\{`ledger ', frame: 'sheet', label: true, gradient: true },
  { css: '26b-recent-form.css', ns: 'formtrend__table', jsx: 'components/playerstats/RecentFormCard.jsx', tag: 'className="ledger formtrend__table"', frame: 'sheet', label: true },
  { css: '31-wild-card.css', ns: 'prospecttable', jsx: 'screens/team/modules/minors/ProspectsCard.jsx', tag: 'className="ledger prospecttable"', frame: 'sheet', label: true },
  { css: '67-awards-ledger.css', ns: 'awardtbl', jsx: 'components/player/AwardsLedger.jsx', tag: 'className="awardtbl"', frame: 'bare', label: false },
  { css: '78-offseason.css', ns: 'movedup__table', jsx: 'components/offseason/MovedUp.jsx', tag: 'className="movedup__table"', frame: 'bare', label: false, words: true },
  { css: '78-offseason.css', ns: 'seasonnote__table', jsx: 'components/offseason/YoungestRegulars.jsx', tag: 'className="seasonnote__table"', frame: 'bare', label: false, words: true },
]

test('T4: each small ledger renders on Table and never on a bare <table>', () => {
  for (const { jsx, tag } of T4) {
    const code = src(jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    const own = [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1]).filter((a) => new RegExp(tag).test(a))
    assert.equal(own.length, 1, `${jsx}: ${tag} is on one <Table>`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
    assert.doesNotMatch(code, /ledger-wrap/, `${jsx}: the scroll wrapper is the Table's wrap now`)
  }
})

test('T4: frame, density, sticky and label are the ones the census set', () => {
  for (const { jsx, tag, frame, label } of T4) {
    const attrs = [...src(jsx).matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1]).find((a) => new RegExp(tag).test(a)) ?? ''
    if (frame === 'bare') assert.match(attrs, /frame="bare"/, `${jsx} sits in a Card or a card section: bare`)
    else assert.doesNotMatch(attrs, /frame=/, `${jsx} is a sheet (the default)`)
    assert.doesNotMatch(attrs, /density=|sticky/, `${jsx} is the row density, not sticky`)
    if (label) assert.match(attrs, /label=/, `${jsx} scrolls sideways, so it has a label`)
    else assert.doesNotMatch(attrs, /label=/, `${jsx} never scrolls, so it has no label`)
  }
})

test('T4: the four Ledger callers each name their table, and the helper hands the name to Table', () => {
  assert.match(src('components/player/Ledger.jsx'), /<Table\b[^>]*label=\{label\}/)
  const names = [
    ...src('components/player/CareerRegister.jsx').matchAll(/<Ledger\b[^>]*?label="([^"]+)"/g),
    ...src('components/playerstats/SplitsSection.jsx').matchAll(/<Ledger\b[^>]*?label="([^"]+)"/g),
  ].map((m) => m[1])
  assert.equal(names.length, 4, 'four callers, four labels')
  assert.equal(new Set(names).size, 4, 'two tables on one page get two different labels')
})

test('T4: a small ledger draws no frame, no cell padding, no head dress and no row rule of its own', () => {
  const FRAME = ['border', 'border-radius', 'box-shadow', 'background', 'overflow', 'border-collapse', 'border-spacing', 'width']
  const HEAD = ['padding', 'background', 'font-family', 'letter-spacing', 'text-transform', 'font-size', 'color', 'border-top', 'border-bottom']
  for (const { css, ns, gradient } of T4) {
    const fileRules = rules(read(css))
    for (const [sel, body] of fileRules) {
      const names = props(body)
      for (const part of sel.split(',').map((x) => x.trim())) {
        const plain = part.match(new RegExp(String.raw`^\.${ns} (thead th|tbody td|:where\(th, td\)|th|td)(:[\w-]+(\([^)]*\))?)?$`))
        // The `.ledger` base also names the formtrend and prospect tables.
        if (part === `.${ns}` && ns !== 'formtrend__table') {
          for (const p of FRAME) assert.ok(!names.includes(p), `${css}: .${ns} still sets ${p}`)
        } else if (plain) {
          assert.ok(!names.includes('padding'), `${css}: ${part} still sets padding`)
          // The ledger keeps ONE row rule, a gradient on the <tr>; its cells zero the Table's border-top.
          if (gradient && part === '.ledger tbody td') continue
          if (/th$/.test(plain[1])) for (const p of HEAD) assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
          assert.ok(!names.includes('border-bottom'), `${css}: ${part} still draws a row rule`)
          assert.ok(!names.includes('border-top'), `${css}: ${part} still draws a row rule`)
        }
      }
    }
  }
})

test('T4: .ledger left the frame block it shared with .standings, and T8 deleted that block and both wraps', () => {
  const css = read('26-player-page.css')
  const frame = rules(css).find(([, body]) => decl(body, 'box-shadow') === 'var(--shadow-card)' && decl(body, 'overflow') === 'hidden')
  assert.equal(frame, undefined, 'no table draws the old frame: the Table wrap does')
  for (const sel of ['.ledger-wrap', '.standings-wrap']) {
    assert.ok(!rules(css).some(([s]) => new RegExp(`\\${sel}(?![a-z0-9_-])`).test(s)), `${sel} is deleted (T8)`)
  }
  assert.equal(ruleBody(css, '.ledger.standings th'), null, 'the odds sheet left the old base (T8)')
  // The odds sheet keeps its one-line column names: the Table sets nowrap on every cell, and no rule that reaches it wraps a head.
  assert.equal(decl(ruleBody(read('system/table.css'), '.table__grid :where(th, td)'), 'white-space'), 'nowrap')
  for (const [sel, body] of [...rules(read('29-team-transactions.css')), ...rules(read('39-manager-page.css'))]) {
    if (/(^|,\s*)\.(clubtable|psoddstable)( thead)? th(,|$)/.test(sel)) assert.notEqual(decl(body, 'white-space'), 'normal', `${sel} wraps the odds sheet's heads`)
  }
})

test('T4: the ledger keeps its footer, all-star, pencil, subtotal and nested rows, and its ONE gradient row rule', () => {
  const css = read('26-player-page.css')
  for (const sel of ['.ledger tfoot td', '.ledger tr.is-allstar td', '.ledger tr.reg-milb td', '.ledger tr.reg-subtotal td', '.ledger tr.ledger__nested .yr', '.ledger .ledger__label']) {
    assert.ok(rules(css).some(([s]) => s.split(',').map((x) => x.trim()).includes(sel)), `${sel} stays in the namespace`)
  }
  assert.match(decl(ruleBody(css, '.ledger tbody tr'), 'background-image') ?? '', /^linear-gradient\(/, 'a row with a logo cell has a fractional height: one line per row')
  assert.match(decl(ruleBody(css, '.ledger tbody td'), 'border-top') ?? '', /^(none|0)$/, 'so the cells draw none of their own')
})

test('T4: the phone ledger keeps its tighter side gutter through the Table\'s own custom property', () => {
  const css = read('26-player-page.css')
  const phone = rules(css).find(([s, b]) => s === '.ledger' && decl(b, '--table-cell') !== undefined)
  assert.ok(phone, 'a .ledger rule sets --table-cell')
  assert.equal(decl(phone[1], '--table-cell'), 'var(--space-1h) var(--space-1h)')
})

test('T4: a table of words says it is not a table of figures, and keeps its edge inset', () => {
  for (const { css, ns, words } of T4.filter((t) => t.words)) {
    const sheet = read(css)
    const grid = ruleBody(sheet, `.${ns}`)
    assert.equal(decl(grid, 'font-family'), 'inherit', `.${ns} holds names, not mono figures`)
    assert.equal(decl(grid, 'font-variant-numeric'), 'normal')
    assert.ok(words)
    const wraps = rules(sheet).find(([s, b]) => s.startsWith(`.${ns} `) && /\bth\b/.test(s) && decl(b, 'white-space') === 'normal')
    assert.ok(wraps, `.${ns} th wraps: a long name must not push the columns off a phone`)
  }
  const css = read('78-offseason.css')
  assert.equal(decl(ruleBody(css, '.movedup__table :is(th, td):first-child'), 'padding-left'), 'var(--space-3)')
  assert.equal(decl(ruleBody(css, '.movedup__table :is(th, td):last-child'), 'padding-right'), 'var(--space-3)')
  assert.equal(decl(ruleBody(css, '.movedup__card'), 'margin-top'), 'var(--space-2)')
  assert.equal(decl(ruleBody(css, '.seasonnote__table'), 'margin-top'), 'var(--space-4)')
})

test('T4: the awards table keeps its column widths and its left reading', () => {
  const css = read('67-awards-ledger.css')
  assert.equal(decl(ruleBody(css, '.awardtbl__yr'), 'width'), '62px')
  assert.equal(decl(rules(css).find(([s]) => s.includes('.awardtbl__lg'))[1], 'width'), '52px')
})

test('T4: the seal pin: no moved ledger reads a reveal-only module or a seal', () => {
  for (const { jsx } of T4) {
    const code = src(jsx)
    assert.doesNotMatch(code, /api\/(linescore|derive)\.js|<SealBox|revealedThrough/, `${jsx} is outside the spoiler scope and stays so`)
  }
})

test('T4: the prospects table keeps the look it had in its Card: no extra sheet shadow', () => {
  const body = rules(read('31-wild-card.css')).find(([sel]) => sel === '.table:has(> .prospecttable)')?.[1]
  assert.ok(body, 'a rule reaches the Table wrap from .prospecttable')
  assert.equal(decl(body, 'box-shadow'), 'none')
})

// ---- slice T7: the standalone boards ----
//
// The six /fouls boards, /umpires, /situational-records, a club's contract grid
// and its ABS challenge board. One row per call site; `tags` is how many
// <Table> tags in the file wear the namespace, in source order, and each `want`
// is what that tag must say. Sticky is on for the contract grid only: no foul,
// umpire or situational board pins a column. `keep` lists the dress the
// board's own look still needs on a plain cell (named so a reader sees why).
const T7 = [
  {
    css: '43-foul-tracker.css',
    ns: 'foulboard',
    jsx: 'screens/FoulTrackerPage.jsx',
    want: [
      { frame: 'bare', label: true },
      { frame: 'bare', label: true },
      { frame: 'bare', label: false },
      { frame: 'bare', label: true },
      { frame: 'bare', label: true },
      { frame: 'bare', label: false },
    ],
    gone: ['standings foulboard', 'className="ledger-wrap"', 'foulboard__whiffcol-scroll'],
  },
  {
    css: '38-umpire-pages.css',
    ns: 'umprank',
    jsx: 'screens/UmpireRankingsPage.jsx',
    want: [{ frame: 'sheet', label: true }],
    gone: ['standings umprank', 'ledger-wrap'],
  },
  {
    css: 'situational-records/66a-detail.css',
    ns: 'trrank',
    jsx: 'components/situational/SituationalBoard.jsx',
    want: [{ frame: 'sheet', label: true }],
    // The navy head and its 12px height are the broadcast board's own look (census, part 2).
    keep: ['padding', 'background', 'color'],
    gone: ['standings trrank', 'ledger-wrap'],
  },
  {
    // One club's splits, on the postseason page: the same table, one per group.
    css: 'situational-records/66a-detail.css',
    ns: 'trrank',
    jsx: 'components/situational/TeamRecordsList.jsx',
    want: [{ frame: 'sheet', label: true }],
    keep: ['padding', 'background', 'color'],
    gone: ['standings trrank', 'ledger-wrap'],
  },
  {
    css: '70-contracts-grid.css',
    ns: 'ctr__table',
    jsx: 'components/salaries/ContractGrid.jsx',
    want: [{ frame: 'bare', sticky: true, label: true }],
    gone: ['ctr__scroll'],
  },
  {
    css: 'report/challenge-card.css',
    ns: 'chal__board',
    jsx: 'screens/team/modules/TeamChallengeCard.jsx',
    want: [{ frame: 'bare', label: false }],
    gone: [],
  },
]

const tableTags = (code, ns) => [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1]).filter((a) => new RegExp(String.raw`className="${ns}(?![a-z0-9_-])`).test(a))

test('T7: each board renders on Table with the frame, density, sticky and label the census gives it', () => {
  for (const { jsx, ns, want, gone } of T7) {
    const code = src(jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
    const tags = tableTags(code, ns)
    assert.equal(tags.length, want.length, `${jsx}: ${want.length} <Table> tag(s) wear .${ns}`)
    tags.forEach((a, i) => {
      const { frame = 'sheet', sticky = false, label } = want[i]
      assert.equal(a.match(/frame="(\w+)"/)?.[1] ?? 'sheet', frame, `${jsx} #${i + 1}: frame`)
      assert.equal(a.match(/density="(\w+)"/)?.[1] ?? 'row', 'row', `${jsx} #${i + 1}: every T7 board is the row density`)
      assert.equal(/\bsticky\b/.test(a), sticky, `${jsx} #${i + 1}: sticky`)
      assert.equal(/\blabel=/.test(a), label, `${jsx} #${i + 1}: label`)
    })
    for (const g of gone) assert.ok(!code.includes(g), `${jsx} no longer carries "${g}"`)
  }
})

test('T7: a moved board draws no frame, no cell padding and no head dress of its own', () => {
  const FRAME = ['border', 'border-radius', 'box-shadow', 'background', 'overflow', 'border-collapse', 'border-spacing', 'width']
  const HEAD = ['padding', 'background', 'font-family', 'letter-spacing', 'text-transform', 'font-size', 'color']
  for (const { css, ns, keep = [] } of T7) {
    for (const [sel, body] of rules(read(css))) {
      const names = props(body)
      for (const part of sel.split(',').map((x) => x.trim())) {
        // Any rule whose last compound is a plain cell of this board: `.ns td`, `.wrap .ns thead th`, `@media` or not.
        const plain = part.match(new RegExp(String.raw`(^|\s)\.${ns} (thead th|tbody td|:where\(th, td\)|th|td)(:[\w-]+(\([^)]*\))?)?$`))
        if (part === `.${ns}`) {
          for (const p of FRAME) assert.ok(!names.includes(p), `${css}: .${ns} still sets ${p}`)
        } else if (plain) {
          if (!keep.includes('padding')) assert.ok(!names.includes('padding'), `${css}: ${part} still sets padding`)
          if (/th$/.test(plain[2])) for (const p of HEAD) if (!keep.includes(p)) assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
        }
      }
    }
  }
})

test('T7: no board takes its cells or its frame from the shared .standings or .ledger-wrap bases any more', () => {
  for (const { css, ns } of T7) {
    for (const [sel] of rules(read(css))) {
      assert.doesNotMatch(sel, /\.standings(?![a-z0-9_-])/, `${css}: "${sel}" still hangs on .standings`)
      assert.doesNotMatch(sel, new RegExp(String.raw`\.ledger-wrap(?![a-z0-9_-])`), `${css}: "${sel}" still hangs on .ledger-wrap`)
    }
    assert.ok(read(css).includes(`.${ns}`), `${css} still names .${ns}`)
  }
})

test('T7: what the .standings base gave the ranked-name cell lives in the board\'s own namespace', () => {
  // `.standings` set these on the cell; the boards left it. T8 deleted that base.
  for (const { css, ns } of [
    { css: '43-foul-tracker.css', ns: 'foulboard' },
    { css: '38-umpire-pages.css', ns: 'umprank' },
    { css: 'situational-records/66a-detail.css', ns: 'trrank' },
  ]) {
    const all = rules(read(css))
    const find = (sel) => all.find(([s]) => s.split(',').map((x) => x.trim()).includes(sel))?.[1]
    assert.equal(decl(find(`.${ns} .team`) ?? '', 'text-align'), 'left', `${css}: .${ns} .team aligns left`)
    const cell = find(`.${ns} td.team`) ?? ''
    assert.equal(decl(cell, 'text-transform'), 'uppercase', `${css}: .${ns} td.team is the uppercase name cell`)
    assert.equal(decl(cell, 'font-family'), 'var(--font-body)')
    assert.equal(decl(find(`.${ns} td.team > *`) ?? '', 'display'), 'flex', `${css}: the name cell lays its parts out in a row`)
    assert.equal(decl(find(ns === 'foulboard' ? '.foulboard th' : `.${ns} thead th`) ?? '', 'white-space'), 'normal', `${css}: a head may wrap, or a board that fit a phone starts to scroll`)
  }
  assert.equal(decl(rules(read('38-umpire-pages.css')).find(([s]) => s === '.umprank .team > .umprank__rank')?.[1] ?? '', 'align-self'), 'flex-start', 'the umpire rank rides the first line of a wrapped name')
  // Only the foul boards mark the favorite club's row (the umpire and situational boards tint their own rows).
  assert.match(decl(ruleBody(read('43-foul-tracker.css'), '.foulboard tr.is-me td') ?? '', 'background') ?? '', /--fav-accent/, 'the favorite-team row keeps its tint')
  assert.ok(ruleBody(read('43-foul-tracker.css'), '.foulboard tr.foulboard__row--outlier td'), 'the outlier wash hangs on the board, not on .standings')
})

test('T7: a moved board keeps its own margin, layout and bleed', () => {
  const fouls = read('43-foul-tracker.css')
  const body = (css, sel) => ruleBody(css, sel) ?? ''
  assert.equal(decl(body(fouls, '.foulboard--teams'), 'table-layout'), 'fixed')
  assert.equal(decl(body(fouls, '.foulboard--teams__teamcol'), 'width'), '64px')
  // The card bleeds its board edge to edge: the Table's wrap, not an old ledger-wrap.
  assert.equal(decl(body(fouls, '.foulboard-block .metric__body > .table'), 'margin'), '0 calc(-1 * var(--space-4))')
  assert.equal(decl(body(fouls, '.foulboard-block .metric__body > .table:first-child'), 'margin-top'), 'calc(-1 * var(--space-3))')
  assert.equal(decl(body(fouls, '.foulboard-block .metric__body > .table:last-child'), 'margin-bottom'), 'calc(-1 * var(--space-4))')
  assert.equal(ruleBody(fouls, '.foulboard-block .ledger-wrap'), null, 'the old bleed rule is gone')
  assert.equal(decl(body(read('70-contracts-grid.css'), '.ctr__table'), 'min-width'), '560px')
  assert.equal(decl(body(read('report/challenge-card.css'), '.chal__board'), 'margin'), 'var(--space-3) 0 0')
  const trrank = read('situational-records/66a-detail.css')
  assert.equal(decl(body(trrank, '.trrank__tablewrap .table'), 'box-shadow'), 'none', 'the raised shadow is the old wrapper\'s, so the Table wrap draws none inside it')
  assert.equal(decl(body(trrank, '.trrank__tablewrap .trrank td'), 'height'), '44px')
})

test('T7: a text cell says it is words, not figures', () => {
  const css = read('report/challenge-card.css')
  assert.equal(decl(ruleBody(css, '.chal__board th.chal__who') ?? '', 'white-space'), 'normal', 'a player name may wrap')
  assert.equal(decl(rules(read('70-contracts-grid.css')).find(([sel]) => sel === '.ctr__name')?.[1] ?? '', 'font-family'), 'var(--font-body)', 'a player name is not a mono figure')
  assert.equal(decl(rules(read('70-contracts-grid.css')).find(([sel]) => sel === '.ctr__name')?.[1] ?? '', 'font-variant-numeric'), 'normal', 'the terms line is words with digits, not tabular figures')
})

test('T7: the contract grid pins its name column and its foot, opaque, with one rule', () => {
  const css = read('70-contracts-grid.css')
  assert.doesNotMatch(css, /position:\s*sticky/, 'Table pins the first column; the grid sets no sticky of its own')
  for (const row of ['.ctr__group', '.ctr__subtotal', '.ctr__foot']) {
    assert.ok(decl(ruleBody(css, row) ?? '', '--table-pin'), `${row} sets --table-pin, so the pinned cell is opaque in its own tint`)
  }
  assert.equal(ruleBody(css, '.ctr__scroll'), null, 'the old scroll wrapper is deleted with its rules')
  for (const cls of ['.ctr__cell', '.ctr__age', '.ctr__agehead', '.ctr__yearhead', '.ctr__name', '.ctr__namehead', '.ctr__subtotal td', '.ctr__subtotal th']) {
    assert.ok(!props(ruleBody(css, cls) ?? '').includes('padding'), `${cls} takes the row density, so it sets no padding`)
  }
  const own = (sel) => rules(css).find(([s]) => s.split(',').map((x) => x.trim()).includes(sel))?.[1] ?? ''
  assert.equal(decl(own('.table--sticky .ctr__table .ctr__subtotal th:first-child'), 'position'), 'static', 'a subtotal label scrolls with its row: only the player column and the foot pin')
  assert.equal(decl(own('.ctr__cell--free'), 'padding'), '0', 'the hatched cell keeps its zero padding')
  assert.equal(decl(own('.ctr__foot td'), 'padding'), 'var(--space-2h)', 'the foot row keeps its own padding')
  assert.equal(decl(own('.ctr__group td'), 'text-align'), 'left', 'the band label reads left: the Table right-aligns a figure cell')
})

test('T7: no moved page reads a reveal-only module, a seal or a stamp', () => {
  for (const { jsx } of T7) {
    const code = src(jsx)
    assert.doesNotMatch(code, /api\/(linescore|derive)\.js|<SealBox|revealedThrough|from ['"][^'"]*stamp/i, `${jsx} stays outside the spoiler scope`)
  }
})

// ---- slice T5: the report boards ----

// One row per page that moved in T5: `boards` is the count of `standings rpt`
// tables that became a sticky, labelled sheet, and `bare` the count of tables
// that became a bare, unlabelled one (the doubleheaders drawer).
const T5 = [
  { jsx: 'screens/around-the-game/AttendancePage.jsx', boards: 4, bare: 0 },
  { jsx: 'screens/around-the-game/BullpenPage.jsx', boards: 1, bare: 0 },
  { jsx: 'screens/around-the-game/DoubleheadersPage.jsx', boards: 1, bare: 1 },
  { jsx: 'screens/around-the-game/FarmSystemPage.jsx', boards: 3, bare: 0 },
  { jsx: 'screens/around-the-game/PacePage.jsx', boards: 2, bare: 0 },
  { jsx: 'screens/around-the-game/RunDifferentialPage.jsx', boards: 3, bare: 0 },
  { jsx: 'screens/around-the-game/RunValuePage.jsx', boards: 3, bare: 0 },
]
const T5_CSS = '68-around-the-game.css'
const t5Rule = (css, sel) => rules(css).find(([s]) => s === sel)?.[1] ?? ''

test('T5: every report board renders on a sticky, labelled Table and never on a bare <table>', () => {
  let tables = 0
  for (const { jsx, boards, bare } of T5) {
    const code = src(jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
    assert.doesNotMatch(code, /BoardScroller/, `${jsx}: the Table is the scroller now`)
    assert.doesNotMatch(code, /className="[^"]*(?<![\w-])standings(?![\w-])/, `${jsx}: no table wears .standings`)
    const tags = [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1])
    const sheets = tags.filter((a) => /className="rpt(?![\w-])/.test(a))
    assert.equal(sheets.length, boards, `${jsx}: ${boards} report boards`)
    for (const a of sheets) {
      assert.match(a, /\bsticky\b/, `${jsx}: a report board pins its club column`)
      assert.match(a, /\blabel=/, `${jsx}: a report board scrolls sideways, so it has a label`)
      assert.doesNotMatch(a, /\b(frame|density)=/, `${jsx}: a report board is a sheet at row density, the defaults`)
    }
    const drawers = tags.filter((a) => /className="dh__drawer"/.test(a))
    assert.equal(drawers.length, bare, `${jsx}: ${bare} bare tables`)
    for (const a of drawers) {
      assert.match(a, /frame="bare"/, 'the drawer sits in a cell, which draws the box')
      assert.doesNotMatch(a, /\b(sticky|label)\b/, 'the drawer never scrolls on its own')
    }
    tables += tags.length
  }
  assert.equal(tables, 18, 'T5 moves 18 tables')
})

test('T5: two boards on one page have two different labels', () => {
  for (const { jsx } of T5) {
    const labels = [...src(jsx).matchAll(/<Table\b[^>]*\blabel=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2])
    // RunValue builds four labels from one template, one per column.
    assert.equal(new Set(labels).size, labels.length, `${jsx}: a duplicate label ${labels}`)
  }
})

test('T5: the report namespace draws no frame and no head dress the Table already draws', () => {
  const FRAME = ['border', 'border-radius', 'box-shadow', 'background', 'overflow', 'border-collapse', 'border-spacing', 'width']
  // `.rpt thead th` keeps what only it says (the label tracking, the heavy rule under the head, nowrap).
  const HEAD = ['padding', 'background', 'font-family', 'font-size', 'color', 'text-transform']
  for (const [sel, body] of rules(read(T5_CSS))) {
    const names = props(body)
    for (const part of sel.split(',').map((x) => x.trim())) {
      if (part === '.rpt') for (const p of FRAME) assert.ok(!names.includes(p), `${T5_CSS}: .rpt still sets ${p}`)
      if (part === '.rpt td') for (const p of ['padding', 'font-family']) assert.ok(!names.includes(p), `${T5_CSS}: ${part} still sets ${p}`)
      if (part === '.rpt thead th') for (const p of HEAD) assert.ok(!names.includes(p), `${T5_CSS}: ${part} still sets ${p}`)
    }
  }
})

test('T5: the report boards keep the club cell, its pin tint and the heavy head rule', () => {
  const css = read(T5_CSS)
  // The pinned cell is opaque in the board's own canvas ground, and a favorite row pins its own tint.
  assert.equal(decl(t5Rule(css, '.rpt'), '--table-pin'), 'var(--bg-page)')
  assert.equal(decl(t5Rule(css, '.rpt__row--mine'), '--table-pin'), 'var(--paper-3)')
  // The sticky club cell keeps display: table-cell and the flex stays on the child.
  assert.equal(decl(t5Rule(css, '.rpt td.team, .rpt tbody th.team'), 'display'), 'table-cell')
  assert.equal(decl(t5Rule(css, '.rpt__club'), 'display'), 'flex')
  // The scroller the ABS boards read is gone (T6a): no rule names it.
  for (const [sel] of rules(css)) assert.doesNotMatch(sel, /\.ledger-wrap|\.rpt-region/, `${sel} names a removed scroller`)
  assert.equal(decl(t5Rule(css, '.rpt thead th'), 'border-bottom'), 'var(--bw-heavy) solid var(--navy)')
})

test('T5: the report boards stay inside their page (the wrap paints its own containment)', () => {
  const css = read(T5_CSS)
  const body = rules(css).find(([sel]) => sel.split(', ').includes('.bcast-sec .table'))?.[1]
  assert.ok(body, `${T5_CSS}: a .bcast-sec .table rule`)
  assert.equal(decl(body, 'contain'), 'paint', 'a board wider than its wrap must not widen the page')
})

test('T5: the doubleheaders drawer keeps its indent and width, and its row tints the pinned cell', () => {
  const css = read(T5_CSS)
  assert.equal(decl(t5Rule(css, '.dh__drawer'), 'margin-left'), 'var(--space-4)')
  assert.equal(decl(t5Rule(css, '.dh__drawer'), 'width'), 'auto')
  for (const p of ['border-collapse', 'border', 'background', 'box-shadow']) {
    assert.ok(!props(t5Rule(css, '.dh__drawer')).includes(p), `.dh__drawer still sets ${p}`)
  }
  for (const [sel, body] of rules(css)) {
    if (/^\.dh__drawer (th|td|thead th|tbody th)/.test(sel)) {
      for (const p of ['padding', 'font-family', 'background']) assert.ok(!props(body).includes(p), `${sel} still sets ${p}`)
    }
  }
  // The drawer sits inside a `.rpt` board, whose heavy head rule would reach it; the first body row's rule is the one line.
  assert.equal(decl(t5Rule(css, '.dh__drawer thead th'), 'border'), '0')
  // The drawer row's cell is the first cell of its row, so the sticky rule pins it: it must keep its ground.
  assert.equal(decl(t5Rule(css, '.dh__drawerrow'), '--table-pin'), 'var(--paper-1)')
  // Rows that tint themselves tint the pinned cell by the custom property, not a rule the pin out-weighs.
  assert.equal(decl(t5Rule(css, '.dh__row:hover'), '--table-pin'), 'var(--paper-2)')
  assert.equal(decl(t5Rule(css, '.dh__row--open'), '--table-pin'), 'var(--paper-1)')
})

test('T5: the e2e club-cell pin finds the new wrap, not the old scroller', () => {
  const spec = readFileSync(join(SRC, '..', 'e2e', 'around-the-game.spec.js'), 'utf8')
  assert.doesNotMatch(spec, /locator\('\.ledger-wrap'\)/)
  assert.match(spec, /locator\('\.table'\)\.first\(\)/)
  assert.match(spec, /expect\(overflow, 'board should be wider than a phone'\)\.toBeGreaterThan\(0\)/)
  assert.match(spec, /expect\(Math\.abs\(after\.x - before\.x\)\)\.toBeLessThan\(2\)/)
})

test('T5: the seal pin: no report page reads a reveal-only module or a seal', () => {
  for (const { jsx } of T5) {
    assert.doesNotMatch(src(jsx), /api\/(linescore|derive)\.js|<SealBox|revealedThrough|api\/stamps?\b/, `${jsx} is outside the spoiler scope and stays so`)
  }
})

// ---- slice T6a: the ABS boards ----

// One row per /abs-challenges page that moved in T6a: each `<Table>` it draws, by label. The label
// is the text BoardScroller took, kept whole.
const ABS = 'screens/around-the-game/abs/'
const T6A = [
  { jsx: 'ClubBoard.jsx', labels: ['Challenge board, every club'] },
  { jsx: 'LongestRuns.jsx', labels: ["`Longest runs, ${lost ? 'losses' : 'wins'}, ${ROLE_CHIP[shown] ?? shown}`"] },
  { jsx: 'MissBands.jsx', labels: ['Challenges by distance from the zone edge'] },
  { jsx: 'PlayerBoards.jsx', labels: ['Most overturned calls won', 'Best challenge success rate'] },
  { jsx: 'RanOut.jsx', labels: ["`Club-games that ran out in the ${ordinal(nights.earliest)} inning`"] },
  { jsx: 'UmpireBoard.jsx', labels: ['Challenges against each plate umpire'] },
  { jsx: 'WhoCalls.jsx', labels: ['Challenge success rate by who called for it'] },
]
const T6A_CSS = '68-around-the-game.css'
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  )

test('T6a: every ABS board renders on a sticky, labelled sheet Table and never on a bare <table>', () => {
  let tables = 0
  for (const { jsx, labels } of T6A) {
    const code = src(ABS + jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
    assert.doesNotMatch(code, /className="[^"]*(?<![\w-])standings(?![\w-])/, `${jsx}: no table wears .standings`)
    const tags = [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1])
    assert.equal(tags.length, labels.length, `${jsx}: ${labels.length} tables`)
    tags.forEach((a, i) => {
      assert.match(a, /\bsticky\b/, `${jsx}: a board pins its first column`)
      assert.match(a, /className="rpt"/, `${jsx}: the namespace stays on the table`)
      assert.doesNotMatch(a, /\b(frame|density)=/, `${jsx}: a sheet at row density, the defaults`)
      const label = a.match(/\blabel=(?:"([^"]*)"|\{(`[^`]*`)\})/)
      assert.ok(label, `${jsx}: a board that scrolls sideways has a label`)
      assert.equal(label[1] ?? label[2], labels[i], `${jsx}: the label is the old BoardScroller text`)
    })
    assert.equal(new Set(labels).size, labels.length, `${jsx}: two boards, two labels`)
    tables += tags.length
  }
  assert.equal(tables, 8, 'T6a moves 8 tables')
})

test('T6a: the umpire board keeps the id its button points at and names no BoardScroller', () => {
  const code = src(ABS + 'UmpireBoard.jsx')
  assert.match(code, /<Table\b[^>]*\bid=\{boardId\}/)
  assert.match(code, /aria-controls=\{boardId\}/)
  assert.doesNotMatch(code, /BoardScroller/)
})

test('T6a: no BoardScroller and no scroller class is left under src or e2e', () => {
  assert.ok(!existsSync(join(SRC, 'components/around-the-game/BoardScroller.jsx')), 'BoardScroller.jsx is deleted')
  const root = join(SRC, '..')
  for (const file of [...walk(SRC), ...walk(join(root, 'e2e'))].filter((f) => /\.(jsx?|css|mjs)$/.test(f))) {
    if (file.endsWith('table-cascade.test.js')) continue
    assert.doesNotMatch(readFileSync(file, 'utf8'), /BoardScroller|rpt-region/, `${file} names a deleted scroller`)
  }
})

test('T6a: the report namespace keeps no rule the ABS boards alone read', () => {
  for (const [sel, body] of rules(read(T6A_CSS))) {
    for (const part of sel.split(',').map((x) => x.trim())) {
      assert.doesNotMatch(part, /\.standings \.rpt|\.ledger-wrap \.rpt|\.rpt-region/, `${part}: a scroller rule is back`)
      // `.rpt td`'s mono face and `.rpt tbody th.team`'s padding out-weighed `.rpt__between`.
      if (part === '.rpt tbody th.team') assert.ok(!props(body).includes('padding'), `${part} still sets padding`)
    }
  }
})

test('T6a: the umpire board keeps its middle row rule', () => {
  const css = read(T6A_CSS)
  const between = rules(css).find(([sel]) => sel === '.rpt__between th, .rpt__between td')?.[1]
  assert.ok(between, `${T6A_CSS}: a .rpt__between row rule`)
  // Its own padding never drew (the cell rules out-weighed it); a live one would grow the row 4px.
  assert.ok(!props(between).some((p) => p.startsWith('padding')), 'a padding here would grow the row')
  assert.equal(decl(between, 'background'), 'var(--paper-2)')
})

test('T6a: the ABS pages stay outside the seal', () => {
  for (const { jsx } of T6A) {
    assert.doesNotMatch(src(ABS + jsx), /api\/(linescore|derive)\.js|<SealBox|revealedThrough|api\/stamps?\b/, `${jsx} is outside the spoiler scope and stays so`)
  }
})

// ---- slice T6b: Nine Keys and the series tables ----

// One row per table that moved in T6b. Nine Keys keeps its own cells
// (`density="keep"`): each holds a drawn mark. The two series tables
// (`.psseries__keystable`, `.psseries__totalstable`) are HELD: see the PR.
const T6B = [
  {
    jsx: 'screens/NineKeysPage.jsx',
    css: '79-nine-keys.css',
    ns: 'ninekeys__grid',
    attrs: [/^(?![^]*\bframe=)/, /\bsticky\b/, /\blabel=\{caption\}/],
  },
]

test('T6b: each table renders on Table at keep density and never on a bare <table>', () => {
  for (const { jsx, ns, attrs } of T6B) {
    const code = src(jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
    const own = [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1]).filter((a) => new RegExp(`className="${ns}"`).test(a))
    assert.equal(own.length, 1, `${jsx}: .${ns} is on one <Table>`)
    assert.match(own[0], /\bdensity="keep"/, `${jsx}: the namespace sets its own cells`)
    for (const a of attrs) assert.match(own[0], a, `${jsx}: ${a}`)
  }
})

test('T6b: Nine Keys has no scroller of its own, and its two grids have two labels', () => {
  const code = src('screens/NineKeysPage.jsx')
  assert.doesNotMatch(code, /ninekeys__scroller/)
  assert.doesNotMatch(read('79-nine-keys.css'), /ninekeys__scroller(?![a-z0-9-])/)
  const calls = [...code.matchAll(/<KeyGrid caption=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2])
  assert.equal(new Set(calls).size, 2, 'the two grids are named apart, and the label is the caption')
})

test('T6b: a moved table draws no frame and no head dress of its own', () => {
  const FRAME = ['border', 'border-radius', 'box-shadow', 'background', 'overflow', 'border-collapse', 'border-spacing', 'width']
  const HEAD = ['background', 'font-family', 'letter-spacing', 'text-transform', 'font-size', 'color']
  for (const { css, ns } of T6B) {
    for (const [sel, body] of rules(read(css))) {
      const names = props(body)
      for (const part of sel.split(',').map((x) => x.trim())) {
        if (part === `.${ns}`) for (const p of FRAME) assert.ok(!names.includes(p), `${css}: .${ns} still sets ${p}`)
        // A keep table pads its own cells, so padding stays; the head's type and ground are the Table's.
        else if (part === `.${ns} thead th`) for (const p of HEAD) assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
      }
    }
  }
})

test('T6b: Nine Keys keeps its margin, its minimum width and its own cell size', () => {
  const css = read('79-nine-keys.css')
  const own = (sel) => rules(css).find(([s]) => s.split(',').map((x) => x.trim()).includes(sel))?.[1] ?? ''
  assert.equal(decl(own('.ninekeys__section .table'), 'margin-top'), 'var(--space-3)')
  assert.equal(decl(own('.ninekeys__grid'), 'min-width'), '720px')
  assert.equal(decl(own('.ninekeys__cell'), 'width'), '58px')
  assert.equal(decl(own('.ninekeys__mark'), 'padding'), 'var(--space-2) 0', 'the mark sets the row height')
})

test('T6b: the Nine Keys club cell is pinned by the Table, and a floor row tints the pin', () => {
  const css = read('79-nine-keys.css')
  const own = (sel) => rules(css).find(([s]) => s === sel)?.[1] ?? ''
  for (const p of ['position', 'left', 'z-index', 'background']) assert.ok(!props(own('.ninekeys__club')).includes(p), `.ninekeys__club still sets ${p}`)
  assert.equal(decl(own('.ninekeys__club'), 'text-align'), 'left', 'a club name is words, not a figure')
  assert.equal(decl(own('.ninekeys__row--floor'), '--table-pin'), 'var(--surface-inset)')
  // The Table draws each row rule on top of the cell; Nine Keys draws none under it, and none above the first row.
  for (const [sel, body] of rules(css)) {
    if (/^\.ninekeys__grid tbody/.test(sel)) assert.ok(!props(body).includes('border-bottom'), `${sel} still draws a row rule under the cell`)
  }
  assert.equal(decl(own('.ninekeys__grid tbody tr:first-child :is(td, th)'), 'border-top'), '0', 'the head\'s heavy rule is the line above the first row')
  // The body cells pad nothing: keep is the whole rule, and no rule here sets a padding on a body cell.
  for (const [sel, body] of rules(css)) {
    if (/^\.ninekeys__(grid tbody|club|tally)/.test(sel)) assert.ok(!props(body).includes('padding'), `${sel} pads a body cell`)
  }
})

test('T6b: the seal pin: Nine Keys reads no reveal-only module, seal or stamp', () => {
  for (const { jsx } of T6B) {
    assert.doesNotMatch(src(jsx), /api\/(linescore|derive)\.js|<SealBox|revealedThrough|api\/stamps?\b|from ['"][^'"]*stamp/i, `${jsx} stays outside the spoiler scope`)
  }
})

// ---- slice T8: Standings and the shared bases ----

// One row per file that moved in T8. Every table is a club table: one club a
// row, a `.team` name cell, sometimes a favorite-team row. `clubtable` is the
// namespace on each; `extra` is the second class its tag must carry. All six
// are sheets at row density and scroll sideways on a phone, so each has a label;
// only the /standings boards and the /postseason-race mini table pin the club.
const T8 = [
  { jsx: 'screens/StandingsPage.jsx', tags: 2, sticky: true, extra: 'clubtable--full' },
  { jsx: 'screens/PostseasonRacePage.jsx', tags: 1, sticky: true, extra: 'clubtable--full' },
  { jsx: 'screens/team/modules/StandingsCard.jsx', tags: 1, sticky: false },
  { jsx: 'components/teamstats/PostseasonOddsModal.jsx', tags: 1, sticky: false, extra: 'psoddstable' },
  { jsx: 'screens/GameNotesDebugPage.jsx', tags: 1, sticky: false },
]
const T8_CSS = ['29-team-transactions.css', '30-standings.css', '31-wild-card.css', '39-manager-page.css']
const T8_NS = ['clubtable', 'clubtable--full', 'psoddstable']
const BASES = /(?<![a-z0-9_-])(standings|ledger-wrap|standings-wrap)(?![a-z0-9_-])/
const t8Rule = (css, sel) => rules(read(css)).find(([s]) => s.split(',').map((x) => x.trim()).includes(sel))?.[1] ?? ''

test('T8: each club table renders on Table with the frame, density, sticky and label the census gives it', () => {
  let tables = 0
  for (const { jsx, tags, sticky, extra } of T8) {
    const code = src(jsx)
    assert.match(code, /import \{ Table \} from ["'][\w./]+\/ui\/table\/Table\.jsx["']/, `${jsx} imports Table`)
    assert.doesNotMatch(code, /<table\b/, `${jsx} has no bare <table>`)
    const own = [...code.matchAll(/<Table\b([^>]*)>/g)].map((m) => m[1]).filter((a) => /className=\{?["`]clubtable(?![a-z0-9_-])/.test(a))
    assert.equal(own.length, tags, `${jsx}: ${tags} <Table> tag(s) wear .clubtable`)
    for (const a of own) {
      assert.doesNotMatch(a, /\b(frame|density)=/, `${jsx}: a sheet at row density, the defaults`)
      assert.equal(/\bsticky\b/.test(a), sticky, `${jsx}: sticky`)
      assert.match(a, /\blabel=/, `${jsx}: a club table scrolls sideways on a phone, so it has a label`)
      if (extra) assert.match(a, new RegExp(String.raw`className=\{?["\`][^"\`]*(?<![\w-])${extra}(?![\w-])`), `${jsx}: the tag keeps .${extra}`)
    }
    tables += own.length
  }
  assert.equal(tables, 6, 'T8 moves 6 tables')
})

test('T8: two boards on one page have two different labels', () => {
  const labels = [...src('screens/StandingsPage.jsx').matchAll(/<Table\b[^>]*\blabel=\{`([^`]*)`\}/g)].map((m) => m[1])
  assert.equal(labels.length, 2)
  assert.equal(new Set(labels).size, 2, 'the division boards and the wild card boards are named apart')
  for (const l of labels) assert.match(l, /\$\{/, 'each board names its own division or league')
})

test('T8: no JSX wears the shared bases, and no stylesheet names them', () => {
  const files = walk(SRC)
  for (const file of files.filter((f) => f.endsWith('.jsx'))) {
    for (const [, cls] of readFileSync(file, 'utf8').matchAll(/className=\{?["'`]([^"'`]*)["'`]/g)) {
      assert.doesNotMatch(cls, BASES, `${file}: className "${cls}" still wears a deleted base`)
    }
  }
  for (const file of files.filter((f) => f.endsWith('.css'))) {
    for (const [sel] of rules(stripComments(readFileSync(file, 'utf8')))) {
      assert.doesNotMatch(sel, /\.(standings|ledger-wrap|standings-wrap)(?![a-z0-9_-])/, `${file}: "${sel}" names a deleted base`)
    }
  }
})

test('T8: the club table namespace draws no frame, no cell padding, no head dress and no row rule', () => {
  const FRAME = ['border', 'border-radius', 'box-shadow', 'background', 'overflow', 'border-collapse', 'border-spacing', 'width']
  const HEAD = ['padding', 'background', 'font-family', 'letter-spacing', 'text-transform', 'font-size', 'color', 'border-top']
  for (const css of T8_CSS) {
    for (const [sel, body] of rules(read(css))) {
      const names = props(body)
      for (const part of sel.split(',').map((x) => x.trim())) {
        for (const ns of T8_NS) {
          const plain = part.match(new RegExp(String.raw`(^|\s)\.${ns} (thead th|tbody td|th|td)$`))
          if (part === `.${ns}`) for (const p of FRAME) assert.ok(!names.includes(p), `${css}: .${ns} still sets ${p}`)
          else if (plain) {
            for (const p of ['padding', 'border-top', 'border-bottom', 'font-family', 'white-space']) {
              if (p === 'white-space' && part === '.clubtable--full thead th') continue
              assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
            }
            if (/th$/.test(plain[2])) for (const p of HEAD) assert.ok(!names.includes(p), `${css}: ${part} still sets ${p}`)
          }
        }
      }
    }
  }
})

test('T8: the Table pins the club column; the namespace keeps only its width and its tints', () => {
  for (const css of T8_CSS) {
    for (const [sel, body] of rules(read(css))) {
      if (!/clubtable|psoddstable/.test(sel)) continue
      for (const p of ['position', 'left', 'z-index', 'border-top-left-radius', 'border-bottom-left-radius']) {
        assert.ok(!props(body).includes(p), `${css}: ${sel} still sets ${p}: the Table draws the pin`)
      }
      // Safari drops sticky on a cell that is not table-cell: the Table restates it, the namespace never flexes it back.
      if (/clubtable--full/.test(sel)) assert.notEqual(decl(body, 'display'), 'flex', `${css}: ${sel} flexes a board cell`)
    }
  }
  assert.equal(decl(t8Rule('30-standings.css', '.clubtable--full .team'), 'min-width'), '116px', 'the pinned club column keeps its width')
  // The favorite row is opaque under the pin: one tint, mixed into the card, paints every cell of the row.
  assert.equal(decl(t8Rule('29-team-transactions.css', '.clubtable tr.is-me td'), '--table-pin'), 'color-mix(in srgb, var(--fav-accent, var(--field)) 10%, var(--surface-card))')
  assert.equal(decl(t8Rule('29-team-transactions.css', '.clubtable tr.is-me td'), 'background'), 'var(--table-pin)')
  // The wild card group row spans the board; its one cell is the first, so it keeps its page ground under the pin.
  assert.equal(decl(t8Rule('31-wild-card.css', '.wc-grouphead td'), '--table-pin'), 'var(--bg-page)')
})

test('T8: the club table keeps its name cell, its tones and the board\'s column rules', () => {
  const core = '29-team-transactions.css'
  assert.equal(decl(t8Rule(core, '.clubtable .team'), 'text-align'), 'left')
  const cell = t8Rule(core, '.clubtable td.team')
  assert.equal(decl(cell, 'font-family'), 'var(--font-body)', 'a club name is words, not a mono figure')
  assert.equal(decl(cell, 'text-transform'), 'uppercase')
  assert.equal(decl(t8Rule(core, '.clubtable td.team > *'), 'display'), 'flex', 'the logo and the name sit in a row')
  assert.equal(decl(t8Rule(core, '.clubtable tr.is-me .team'), 'color'), 'var(--fav-accent, var(--field-deep))')
  assert.equal(decl(t8Rule(core, '.clubtable td.standings__diff--positive'), 'color'), 'var(--accent-positive)')
  assert.equal(decl(t8Rule(core, '.clubtable td.standings__diff--negative'), 'color'), 'var(--accent-negative)')
  assert.equal(decl(t8Rule(core, '.clubtable td.is-clinched'), 'font-weight'), 'var(--w-semibold)')
  const board = '30-standings.css'
  assert.equal(decl(t8Rule(board, '.clubtable--full .st-ext'), 'display'), 'none', 'a phone shows the essentials')
  assert.equal(decl(t8Rule(board, '.clubtable--full.is-expanded .st-ext'), 'display'), 'table-cell', '"More columns" brings the rest back')
  assert.equal(decl(t8Rule(board, '.clubtable--full thead th'), 'white-space'), 'normal', 'a board head may wrap, as it did on the old base')
  assert.equal(decl(t8Rule(board, '.clubtable--full td'), 'font-size'), 'var(--fs-compact)', 'a phone board keeps its compact figures')
  // An eliminated row fades what its cells hold, never the pinned name cell: an opaque cell hides the numbers scrolling under it.
  assert.equal(decl(t8Rule(board, '.clubtable tr.is-eliminated td:not(.team)'), 'opacity'), '0.62')
  assert.equal(decl(t8Rule(board, '.clubtable tr.is-eliminated td.team > *'), 'opacity'), '0.62')
  assert.equal(t8Rule(board, '.clubtable tr.is-eliminated td'), '', 'the pinned cell itself is never faded')
  // The umpire board's "more between them" row tints its pinned cell through the pin, as the other tinted rows do.
  assert.equal(decl(t8Rule('68-around-the-game.css', '.rpt__between'), '--table-pin'), 'var(--paper-2)')
  // The group row's 12px top pad and its label size never drew under the old board's own cell rules; it keeps what it showed.
  for (const p of ['padding-top', 'font-size']) assert.ok(!props(t8Rule('31-wild-card.css', '.wc-grouphead td')).includes(p), `the group row takes the board's ${p}`)
  assert.equal(decl(t8Rule('39-manager-page.css', '.psoddstable thead th'), 'font-weight'), 'var(--w-semibold)', 'the odds sheet keeps its lighter head')
  // The mini table's space above it was the old wrapper's; it is the Table wrap's now.
  assert.equal(decl(t8Rule('70-postseason-race.css', '.psrace__league > .table'), 'margin-top'), 'var(--space-2)')
  assert.equal(ruleBody(read('70-postseason-race.css'), '.psrace__minitable'), null, 'the old wrapper rule is gone')
})

test('T8: the e2e standings check finds the club table, not the deleted base', () => {
  const spec = readFileSync(join(SRC, '..', 'e2e', 'offseason-home.spec.js'), 'utf8')
  assert.match(spec, /locator\('\.clubtable tbody tr'\)\.first\(\)\)\.toBeVisible\(\)/)
  assert.doesNotMatch(spec, /locator\('\.standings tbody tr'\)/)
})

test('T8: the seal pin: no club table page reads a reveal-only module, a seal or a stamp', () => {
  for (const { jsx } of T8) {
    assert.doesNotMatch(src(jsx), /api\/(linescore|derive)\.js|<SealBox|revealedThrough|api\/stamps?\b|from ['"][^'"]*stamp/i, `${jsx} stays outside the spoiler scope`)
  }
})
