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
