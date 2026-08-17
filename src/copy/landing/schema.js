// The shape of a landing page, and the ONE place that derives a copy-slot id
// from it.
//
// These pages exist for a reason the rest of the app does not share. Tally is a
// client-rendered SPA: `api/preview.js` swaps the OG block, but the body it
// serves is `<div id="root"></div>`, and the crawlers that feed AI assistants do
// not run JavaScript — GPTBot and ClaudeBot fetch script files and execute none
// of them. So every word of this app is invisible to them. A landing page whose
// text lives in a React component would be invisible in exactly the same way,
// which is why `api/page.js` renders these to real HTML on the server and why
// the content lives in plain data modules here instead of in JSX.
//
// SPOILER RULE. Every page built from this schema is STATIC. It fetches nothing,
// it derives nothing from a game, and no value here may ever come from the feed.
// That is not a convention, it is the only thing that makes server-rendering
// safe: this HTML is sent complete, with no SealBox in front of it and no reveal
// mark consulted, so a score placed in it would be a score with no seal at all.
// A landing page may LINK to a scoring surface. It may never READ one.
// `test/landing-pages.test.js` pins this.
//
// EDITABILITY. Every prose string below is an admin-editable copy slot, stored
// in the same closed registry as everything else (see `src/copy/registry.js` and
// ADR-0025/0044). Structural data is NOT editable — the nine position numbers
// and the box-score column names are reference facts, not wording, and putting
// them behind a textarea would invite an edit that makes the page wrong.
//
// SLOT IDS ARE REDIS FIELD NAMES, so they must be stable across edits to this
// file. They are built from a section's EXPLICIT `id`, never its position in the
// array — reordering sections must not silently orphan the paragraph somebody
// wrote. Adding a section is safe. Renaming a section id abandons its text.

// Every section kind the renderer knows. A page is a list of these, in order.
//
//   answer  — the opening block. 2–4 sentences, self-contained, no heading.
//             It leads the page because roughly 44% of the citations an AI
//             assistant makes come from the first 30% of a page's text; an
//             answer placed under a hero is an answer placed outside that
//             window. This is the single most load-bearing section kind here.
//   prose   — a heading and paragraphs.
//   list    — a heading, optional intro, and bullets. A bullet is ONE string:
//             any lead-in is written as the opening phrase of that string, not
//             as a separate field. That keeps a bullet a single editable slot,
//             which is what lets an editor rewrite one without the markup
//             fighting back — and it is why the renderer has no bold-term case.
//   table   — a heading, optional intro, and a real <table>. Structural: its
//             columns and cells are NOT editable.
//   cta     — the one place a page sells. Heading, paragraphs, one link.
//   faq     — questions as <h3>, answers as paragraphs. Never an accordion:
//             collapsed text reads as de-emphasized, and it is worse for a
//             person holding a phone at a ballpark.
//   related — sibling links out to the other landing pages.
//
// A page can also declare a top-level `sources` array. Source names and HTTPS
// URLs are structural references, not editable prose. The renderer prints them
// after the article body and adds their URLs to Article.citation in JSON-LD.
export const SECTION_KINDS = Object.freeze([
  'answer',
  'prose',
  'list',
  'table',
  'cta',
  'faq',
  'related',
])

// The editable slots each kind contributes, as `slotName -> { maxLength,
// multiline, label }`. `body`, `items` and `faq` entries expand per index, so a
// three-paragraph section yields `.p1`, `.p2`, `.p3`.
const PROSE_MAX = 900
const HEADING_MAX = 120

export const SLOT_LIMITS = Object.freeze({
  metaTitle: 70,
  metaDescription: 165,
  h1: 90,
  heading: HEADING_MAX,
  intro: PROSE_MAX,
  paragraph: PROSE_MAX,
  item: 400,
  question: HEADING_MAX,
  answer: PROSE_MAX,
  linkText: 60,
})

// The id under which a slot is stored. `learn.{slug}.{sectionId}.{slot}`.
//
// Guard the separator: a slug or section id containing a dot would make two
// different slots collide on one Redis field, and the losing one would silently
// render its shipped default forever — the exact failure mode ADR-0044 calls out
// for `mergeOverrides`, where the broken state looks identical to the healthy
// one. Ids are asserted to be kebab-case in `test/landing-pages.test.js`.
export function slotId(slug, sectionId, slot) {
  return `learn.${slug}.${sectionId}.${slot}`
}

// Walk one page and yield every editable slot as
// `{ id, value, maxLength, multiline, label, group, subgroup }`.
//
// This is the single traversal shared by the registry (which needs defaults and
// limits to build FIELDS), the renderer (which needs ids to look up overrides),
// and the admin editor (which needs labels). Three consumers, one walk — so a
// slot cannot exist in the page and be missing from the panel, or be editable in
// the panel and ignored by the renderer.
export function* pageSlots(page) {
  const at = (sectionId, slot, value, kind, label) => ({
    id: slotId(page.slug, sectionId, slot),
    value,
    maxLength: SLOT_LIMITS[kind],
    multiline: kind === 'paragraph' || kind === 'answer' || kind === 'intro' || kind === 'item',
    label,
    group: 'learn',
    subgroup: page.slug,
  })

  yield at('page', 'metaTitle', page.metaTitle, 'metaTitle', 'Browser/search title')
  yield at('page', 'metaDescription', page.metaDescription, 'metaDescription', 'Search description')
  yield at('page', 'h1', page.h1, 'h1', 'Page headline')

  for (const section of page.sections) {
    const { id, kind } = section
    if (section.heading) {
      yield at(id, 'heading', section.heading, 'heading', `${id} — heading`)
    }
    if (section.intro) {
      yield at(id, 'intro', section.intro, 'intro', `${id} — intro`)
    }
    // for...of, not forEach: `yield` may not cross a function boundary, and a
    // generator that yields from inside a callback is a SyntaxError, not a
    // runtime bug — the whole module fails to parse and every importer throws.
    if (Array.isArray(section.body)) {
      for (const [i, text] of section.body.entries()) {
        yield at(id, `p${i + 1}`, text, kind === 'answer' ? 'answer' : 'paragraph', `${id} — paragraph ${i + 1}`)
      }
    }
    if (kind === 'list') {
      for (const [i, item] of section.items.entries()) {
        yield at(id, `i${i + 1}`, item.text, 'item', `${id} — item ${i + 1}`)
      }
    }
    if (kind === 'faq') {
      for (const [i, item] of section.items.entries()) {
        yield at(id, `q${i + 1}`, item.q, 'question', `${id} — question ${i + 1}`)
        yield at(id, `a${i + 1}`, item.a, 'answer', `${id} — answer ${i + 1}`)
      }
    }
    if (kind === 'cta') {
      yield at(id, 'linkText', section.linkText, 'linkText', `${id} — button text`)
    }
  }
}

// Resolve a page against the stored override map, returning a page of the same
// shape with every editable string replaced where an override exists.
//
// An empty override is NOT an override — `sanitizeOverrides` already treats ''
// as "no value", so clearing a box in the editor restores the shipped default
// rather than printing a blank paragraph onto a public page.
export function resolvePage(page, overrides = {}) {
  const get = (sectionId, slot, fallback) => {
    const stored = overrides[slotId(page.slug, sectionId, slot)]
    return typeof stored === 'string' && stored.trim() ? stored : fallback
  }

  return {
    ...page,
    metaTitle: get('page', 'metaTitle', page.metaTitle),
    metaDescription: get('page', 'metaDescription', page.metaDescription),
    h1: get('page', 'h1', page.h1),
    sections: page.sections.map((section) => {
      const { id, kind } = section
      const next = { ...section }
      if (section.heading) next.heading = get(id, 'heading', section.heading)
      if (section.intro) next.intro = get(id, 'intro', section.intro)
      if (Array.isArray(section.body)) {
        next.body = section.body.map((text, i) => get(id, `p${i + 1}`, text))
      }
      if (kind === 'list') {
        next.items = section.items.map((item, i) => ({ ...item, text: get(id, `i${i + 1}`, item.text) }))
      }
      if (kind === 'faq') {
        next.items = section.items.map((item, i) => ({
          q: get(id, `q${i + 1}`, item.q),
          a: get(id, `a${i + 1}`, item.a),
        }))
      }
      if (kind === 'cta') next.linkText = get(id, 'linkText', section.linkText)
      return next
    }),
  }
}
