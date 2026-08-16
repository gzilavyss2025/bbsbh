// The landing pages at /learn — structure, escaping, and the invariant that
// matters most: these documents are served COMPLETE, so nothing in them may come
// from a game.
//
// Read `src/copy/landing/schema.js` first. Everywhere else in the app, a score
// is safe because a SealBox stands in front of it and a reveal mark decides when
// the render function runs. Here there is no SealBox, no reveal mark, and no
// client: api/page.js emits finished HTML to whoever asked, including a crawler.
// That makes "no game data reaches this renderer" not a style preference but the
// only thing standing between these pages and a spoiler with no seal on it.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

import { LANDING_PAGES, pageBySlug } from '../src/copy/landing/pages/index.js'
import { esc, renderIndex, renderPage } from '../src/copy/landing/render.js'
import {
  SECTION_KINDS,
  SLOT_LIMITS,
  pageSlots,
  resolvePage,
  slotId,
} from '../src/copy/landing/schema.js'
import { buildSitemap } from '../scripts/gen-sitemap.mjs'

const html = (page) => renderPage(resolvePage(page, {}))

// ---------------------------------------------------------------- structure

test('every page has the required shape', () => {
  assert.ok(LANDING_PAGES.length >= 6, 'the set is worth serving')
  for (const page of LANDING_PAGES) {
    assert.match(page.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${page.slug} is kebab-case`)
    assert.ok(page.metaTitle.length <= SLOT_LIMITS.metaTitle, `${page.slug} title fits`)
    assert.ok(page.metaDescription.length <= SLOT_LIMITS.metaDescription, `${page.slug} desc fits`)
    assert.ok(page.h1.length <= SLOT_LIMITS.h1, `${page.slug} h1 fits`)
    assert.match(page.updated, /^\d{4}-\d{2}-\d{2}$/, `${page.slug} has an ISO updated date`)
    assert.ok(Array.isArray(page.keywords) && page.keywords.length, `${page.slug} names its queries`)
  }
})

// The renderer's switch has a `default: return ''` arm, so an unrecognised kind
// does not throw — it silently renders nothing, and a whole section of a live
// page disappears with no error anywhere. This is the assertion that catches a
// typo'd kind at test time instead of in production.
test('every section declares a kind the renderer knows', () => {
  for (const page of LANDING_PAGES) {
    for (const section of page.sections) {
      assert.ok(
        SECTION_KINDS.includes(section.kind),
        `${page.slug}/${section.id} has unknown kind "${section.kind}"`,
      )
      if (section.heading) {
        const out = renderPage(resolvePage(page, {}))
        assert.ok(out.includes(esc(section.heading)), `${page.slug}/${section.id} actually renders`)
      }
    }
  }
})

test('slugs and section ids are unique', () => {
  const slugs = new Set()
  for (const page of LANDING_PAGES) {
    assert.ok(!slugs.has(page.slug), `${page.slug} appears once`)
    slugs.add(page.slug)
    const sections = new Set()
    for (const section of page.sections) {
      assert.ok(!sections.has(section.id), `${page.slug}/${section.id} appears once`)
      sections.add(section.id)
      assert.match(section.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${page.slug}/${section.id} is kebab-case`)
    }
  }
})

// A slot id is a Redis field name. If a dot could appear inside a slug or a
// section id, two different slots could resolve to the same stored field and one
// of them would silently render its shipped default forever — indistinguishable
// from a page nobody has edited.
test('no slot id can collide with another', () => {
  const seen = new Set()
  for (const page of LANDING_PAGES) {
    for (const slot of pageSlots(page)) {
      assert.ok(!seen.has(slot.id), `${slot.id} is unique across every page`)
      seen.add(slot.id)
      assert.equal(slot.id.split('.').length, 4, `${slot.id} has exactly four segments`)
    }
  }
})

test('every default is within its slot budget', () => {
  for (const page of LANDING_PAGES) {
    for (const slot of pageSlots(page)) {
      assert.equal(typeof slot.value, 'string', `${slot.id} is a string`)
      assert.ok(slot.value.trim().length > 0, `${slot.id} is not blank`)
      assert.ok(
        slot.value.length <= slot.maxLength,
        `${slot.id} is ${slot.value.length}, over its ${slot.maxLength} budget`,
      )
    }
  }
})

test('the first section of every page is the answer block', () => {
  // Roughly 44% of the citations an AI assistant makes come from the first 30%
  // of a page's text. An answer placed under a hero is an answer outside that
  // window, and this ordering is the single reason these pages are shaped the
  // way they are — worth a test rather than a comment somebody can drift past.
  for (const page of LANDING_PAGES) {
    assert.equal(page.sections[0].kind, 'answer', `${page.slug} opens with its answer`)
    const text = page.sections[0].body.join(' ')
    assert.ok(text.length > 200, `${page.slug}'s answer is substantial enough to quote`)
  }
})

test('every page ends with exactly one call to action and a related block', () => {
  for (const page of LANDING_PAGES) {
    const ctas = page.sections.filter((s) => s.kind === 'cta')
    assert.equal(ctas.length, 1, `${page.slug} sells once, not throughout`)
    assert.ok(ctas[0].href.startsWith('/'), `${page.slug}'s cta stays on this site`)
    const related = page.sections.filter((s) => s.kind === 'related')
    assert.equal(related.length, 1, `${page.slug} links onward`)
  }
})

test('every internal /learn link points at a page that exists', () => {
  for (const page of LANDING_PAGES) {
    for (const section of page.sections) {
      if (section.kind !== 'related') continue
      for (const item of section.items) {
        if (!item.href.startsWith('/learn/')) continue
        const slug = item.href.slice('/learn/'.length)
        assert.ok(pageBySlug(slug), `${page.slug} links to /learn/${slug}, which does not exist`)
      }
    }
  }
})

// ------------------------------------------------------------ spoiler rule

// The enforcement is structural — the renderer's import graph cannot reach the
// feed — and this is the assertion that keeps it that way. A future edit that
// imported a selector "just to show tonight's games on the guide" would put a
// score into HTML that is sent complete, with nothing in front of it.
test('the landing layer imports nothing that can reach a game', () => {
  const files = [
    'src/copy/landing/schema.js',
    'src/copy/landing/render.js',
    'src/copy/landing/fields.js',
    'src/copy/landing/site.js',
    'api/page.js',
    ...readdirSync('src/copy/landing/pages').map((f) => `src/copy/landing/pages/${f}`),
  ]
  const forbidden = /from '.*(api\/(linescore|derive|select|statsapi|feed)|useAsync|revealedThrough)/
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, forbidden, `${file} must not import from the live-game data layer`)
    assert.doesNotMatch(source, /statsapi\.mlb\.com/, `${file} must not name the feed host`)
  }
})

test('rendered pages contain no scoreboard-shaped content', () => {
  for (const page of LANDING_PAGES) {
    const out = html(page)
    assert.doesNotMatch(out, /gamePk/i, `${page.slug} names no game`)
    assert.doesNotMatch(out, /statsapi/i, `${page.slug} reaches no feed`)
  }
})

// ------------------------------------------------------------ the renderer

test('every editable string is escaped on the way out', () => {
  const page = pageBySlug('score-a-baseball-game')
  const hostile = '<script>alert("x")</script> & "quoted" \'apostrophe\''
  const overrides = { [slotId(page.slug, 'page', 'h1')]: hostile }
  const out = renderPage(resolvePage(page, overrides))

  assert.doesNotMatch(out, /<script>alert/, 'no injected script tag survives')
  assert.match(out, /&lt;script&gt;alert/, 'it is printed as text instead')
  assert.ok(out.includes('&amp;'), 'ampersands are escaped')
})

test('a stored override replaces the shipped text, and an empty one does not', () => {
  const page = pageBySlug('score-a-baseball-game')
  const id = slotId(page.slug, 'page', 'metaDescription')

  const edited = resolvePage(page, { [id]: 'A new description.' })
  assert.equal(edited.metaDescription, 'A new description.')

  // Clearing a box in the editor must restore the authored copy, not print a
  // blank meta description onto a public page.
  for (const empty of ['', '   ']) {
    assert.equal(resolvePage(page, { [id]: empty }).metaDescription, page.metaDescription)
  }
})

test('a page renders a complete, self-describing document', () => {
  const page = pageBySlug('scorekeeping-symbols')
  const out = html(page)

  assert.match(out, /^<!doctype html>/)
  assert.match(out, /<html lang="en">/)
  assert.match(out, /<link rel="canonical" href="https:\/\/[^"]+\/learn\/scorekeeping-symbols"/)
  assert.match(out, /<meta name="description" content="[^"]+"/)
  assert.match(out, /application\/ld\+json/)
  // The whole point: the body carries the words, with no JavaScript required.
  assert.ok(out.includes('<h1>'), 'the headline is in the HTML')
  assert.ok(out.includes(page.sections[0].body[0].slice(0, 40)), 'the answer is in the HTML')
  assert.doesNotMatch(out, /<div id="root">/, 'this is not the SPA shell')
})

test('JSON-LD is valid JSON and cannot break out of its script tag', () => {
  for (const page of LANDING_PAGES) {
    const out = html(page)
    const match = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    assert.ok(match, `${page.slug} emits JSON-LD`)
    const parsed = JSON.parse(match[1].replace(/\\u003c/g, '<'))
    assert.equal(parsed['@context'], 'https://schema.org')
    assert.ok(parsed['@graph'].some((n) => n['@type'] === 'Article'))
    assert.doesNotMatch(match[1], /<\/script/i, 'no raw closing tag inside the block')
  }
})

test('the hub links to every guide', () => {
  const out = renderIndex(LANDING_PAGES.map((p) => resolvePage(p, {})))
  for (const page of LANDING_PAGES) {
    assert.ok(out.includes(`/learn/${page.slug}`), `the hub links to ${page.slug}`)
  }
})

// ---------------------------------------------------------------- sitemap

test('the sitemap lists every guide and no scoring surface', () => {
  const xml = buildSitemap()
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.ok(xml.includes('http://www.sitemaps.org/schemas/sitemap/0.9'), 'correct namespace')

  for (const page of LANDING_PAGES) {
    assert.ok(xml.includes(`/learn/${page.slug}</loc>`), `${page.slug} is listed`)
  }

  // A sitemap is a standing invitation, not a one-time fetch. Listing a scoring
  // surface would invite a crawler to keep asking for a page whose entire job is
  // to withhold a result until a person asks for it.
  assert.doesNotMatch(xml, /\/admin/, 'the admin panel is not advertised')
  assert.doesNotMatch(xml, /-lab</, 'the dev labs are not advertised')
  assert.doesNotMatch(xml, /\?edit/, 'the editor is not advertised')
  assert.doesNotMatch(xml, /<loc>[^<]*\/\d{8}[^<]*<\/loc>/, 'no dated slate is listed')
})
