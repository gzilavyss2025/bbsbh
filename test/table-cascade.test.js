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
import { readFileSync } from 'node:fs'
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

test('system/table.css is imported right after card.css and before 06', () => {
  const list = imports()
  const card = list.indexOf('system/card.css')
  const table = list.indexOf('system/table.css')
  assert.ok(table !== -1, 'index.css should import system/table.css')
  assert.equal(table, card + 1, 'table.css sits right after card.css')
  assert.equal(list.indexOf('06-loader-and-cards.css'), table + 1, 'table.css sits right before 06, so a namespace rule wins on order')
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

test('the two densities are one custom property, read by one cell rule', () => {
  const css = read('system/table.css')
  assert.equal(decl(ruleBody(css, '.table--row'), '--table-cell'), 'var(--space-1h) var(--space-2)')
  assert.equal(decl(ruleBody(css, '.table--tight'), '--table-cell'), 'var(--space-1) 2px')
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
  assert.deepEqual(DENSITIES, ['row', 'tight'])
  assert.throws(() => tableParts({ frame: 'ledger' }), /unknown frame "ledger"/)
  assert.throws(() => tableParts({ density: 'loose' }), /unknown density "loose"/)
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

test('T4: the three Ledger callers each name their table, and the helper hands the name to Table', () => {
  assert.match(src('components/player/Ledger.jsx'), /<Table\b[^>]*label=\{label\}/)
  const names = [
    ...src('components/player/CareerRegister.jsx').matchAll(/<Ledger\b[^>]*?label="([^"]+)"/g),
    ...src('components/playerstats/SplitsSection.jsx').matchAll(/<Ledger\b[^>]*?label="([^"]+)"/g),
  ].map((m) => m[1])
  assert.equal(names.length, 3, 'three callers, three labels')
  assert.equal(new Set(names).size, 3, 'two tables on one page get two different labels')
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

test('T4: .ledger left the frame block it shared with .standings, which T8 still deletes', () => {
  const css = read('26-player-page.css')
  const frame = rules(css).find(([, body]) => decl(body, 'box-shadow') === 'var(--shadow-card)' && decl(body, 'overflow') === 'hidden')
  assert.ok(frame, 'the shared frame block still stands, for .standings')
  assert.deepEqual(frame[0].split(',').map((s) => s.trim()), ['.standings'], 'only .standings keeps the frame')
  for (const sel of ['.ledger-wrap', '.standings-wrap']) assert.ok(rules(css).some(([s]) => s === sel), `${sel} stays until T8`)
  assert.equal(decl(ruleBody(css, '.ledger.standings th'), 'white-space'), 'nowrap', 'the Postseason odds sheet, still on the old base, keeps its one-line column names')
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
