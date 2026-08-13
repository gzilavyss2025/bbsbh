import { expect, test } from './fixtures.js'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

// The printable pre-pitch scorecard (`/{date}/{matchup}/sheet`).
//
// This spec exists because the deliverable is PAPER, and paper is the one thing
// a screenshot cannot check. "It looks like one page in the preview" is not the
// claim; the claim is that a reader who hits Print gets exactly one sheet, on
// either of the two papers the world actually uses, with nothing clipped off the
// bottom. So it prints for real — to PDF, at both sizes — and reads the result
// back with pdfjs (already a dependency) to count pages and pull the text out.
//
// WHY THE PAPER SIZE IS PASSED TO page.pdf() RATHER THAN LEFT TO @page. The
// stylesheet declares `@page { size: landscape; margin: 8mm }` — an ORIENTATION
// and no paper name, deliberately, so the reader's own Letter or A4 selection
// stands (styles/63-print-sheet.css). Chromium cannot be asked to honour that
// AND be told which paper to use, so each case here supplies the paper the way
// the print dialog would and reproduces the margin the rule declares. The
// orientation half is asserted separately, off the live stylesheet, so a dropped
// `size: landscape` still fails something.
//
// A completed game on purpose: the sheet stages the STARTING nine, the crew and
// the park, all of which a Final feed carries in full — so the route is stable
// instead of depending on whether tonight's lineups have posted yet. Nothing
// reveal-only reaches this page either way (test/print-sheet.test.js pins that).
const ROUTE = '/08122026/milsd/sheet'

// The @page margin the stylesheet declares, restated here so a change to one
// fails against the other rather than quietly agreeing.
const MARGIN = { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }

const PAPERS = [
  { label: 'US Letter', format: 'Letter' },
  { label: 'A4', format: 'A4' },
]

// A sheet of paper is the same size on a phone as on a desktop. Running this
// three times would triple the slowest spec in the suite for no coverage.
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'paper geometry is viewport-independent — run it once',
  )
})

// A cold load waits on the live feed plus the managers and the outdoor weather
// reading before the sheet is complete, and the PDF has to be taken from the
// finished page.
test.describe.configure({ timeout: 120_000 })

async function openSheet(page) {
  await page.goto(ROUTE)
  await expect(page.locator('.printsheet')).toBeVisible({ timeout: 60_000 })
  // Both clubs, nine batting rows each, every at-bat box empty. If the grid
  // ever grows values this is the first thing that fails.
  await expect(page.locator('.printsheet__block')).toHaveCount(2)
  await expect(page.locator('.printsheet__grid tbody tr')).toHaveCount(20) // 2 x (9 + totals)
  const cells = page.locator('.ps-cell')
  await expect(cells).toHaveCount(2 * 9 * 11)
  await expect(cells.filter({ hasText: /\S/ })).toHaveCount(0)
}

for (const paper of PAPERS) {
  test(`the sheet prints on one page of ${paper.label}, nothing clipped`, async ({ page }) => {
    await openSheet(page)
    await page.emulateMedia({ media: 'print' })

    const bytes = await page.pdf({
      format: paper.format,
      landscape: true,
      margin: MARGIN,
      // The print dialog's own default. Every rule, box and diamond on the
      // sheet is drawn with a BORDER for exactly this reason — a background
      // fill would simply be absent from the paper.
      printBackground: false,
    })

    const doc = await getDocument({ data: new Uint8Array(bytes) }).promise
    expect(
      doc.numPages,
      `${paper.label} ran to ${doc.numPages} pages — the sheet no longer fits its vertical budget (see styles/63-print-sheet.css)`,
    ).toBe(1)

    const text = (await (await doc.getPage(1)).getTextContent()).items
      .map((i) => i.str)
      .join(' ')

    // The staging data actually reached the paper.
    expect(text).toContain('BREWERS')
    expect(text).toContain('PADRES')
    expect(text).toContain('BALLPARK')
    expect(text).toContain('UMPIRES')
    expect(text).toContain('SCORED BY')
    // Nine innings plus the two spare columns, and both clubs' totals lines.
    expect(text).toContain('RBI')

    // The app's chrome did NOT. These are the section-tab labels and the site
    // bar's own words; if the peel-down chain in the print stylesheet stops
    // matching GameView's DOM, they come back and this fails.
    for (const chrome of ['INNINGS', 'BOX', 'CARD', 'REFRESH']) {
      expect(text, `"${chrome}" reached the paper — the print stylesheet is no longer stripping the app chrome`).not.toContain(chrome)
    }
  })
}

test('the print rule sets an orientation and no paper name, so both sizes fit', async ({ page }) => {
  await openSheet(page)

  const atPage = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules
      try {
        rules = sheet.cssRules
      } catch {
        continue // a cross-origin sheet; not ours
      }
      for (const rule of rules) {
        if (rule.media && rule.media.mediaText.includes('print')) {
          for (const inner of rule.cssRules ?? []) {
            if (inner.cssText.startsWith('@page')) return inner.cssText
          }
        }
      }
    }
    return null
  })

  expect(atPage, 'no @page rule reached the document').not.toBeNull()
  expect(atPage).toContain('landscape')
  // Naming a paper here would clip the other one — the reader's own selection
  // has to stand. See the file header.
  expect(atPage).not.toMatch(/\b(a4|letter|legal)\b/i)
})
