// Turns a resolved landing page into a complete HTML document.
//
// This is a PURE function of (page, options) — no fetch, no Redis, no clock, no
// game data. `api/page.js` does the I/O (read the overrides, resolve the page)
// and hands the result here. That split is what makes the whole thing testable
// in `test/landing-pages.test.js`, and it is why the spoiler invariant is
// checkable at all: a renderer that cannot reach the feed cannot leak a score.
//
// WHY A STANDALONE DOCUMENT, not the app shell with content injected. Three
// reasons, in order of weight:
//
//   1. The app shell boots React into `#root`. Anything we pre-rendered there
//      would be thrown away on mount — a flash for the reader and wasted work —
//      unless we adopted full SSR + hydration, which is a large machine to
//      maintain for eight pages of static prose.
//   2. A reading page is not app chrome. The ALL-CAPS INVARIANT in
//      `src/styles/01-base.css` is scoped to `#root *`, and it is right for a
//      scorebook interface and wrong for 1,400 words of body copy. A document
//      with no `#root` sits outside that rule by construction rather than by
//      fighting it with specificity — the same reasoning that made the welcome
//      modal's explainer a sanctioned exception, applied to a whole page.
//   3. It is faster and simpler. No bundle, no hydration, one small stylesheet.
//      A crawler that does not run JavaScript gets the identical bytes a reader
//      does, which is the entire point of the exercise.
//
// The reader still gets the app: every page links into it, and the header
// wordmark is a link home.

import { SITE_NAME, SITE_URL } from './site.js'

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Paragraph text is admin-authored and may legitimately contain an apostrophe or
// an ampersand, so it goes through esc() like everything else. There is NO
// markup pass and that is deliberate: the copy store's safety property is that a
// stored value is a bounded, inert string. The moment this function honored
// markup, a stored value would become executable content in a document we serve,
// and `sanitizeOverrides` would have to grow an HTML sanitizer to compensate.
// If rich text is ever wanted here, add an allowlisted renderer with its own
// tests — do not relax this.
const p = (text) => `<p>${esc(text)}</p>`

function renderSection(section) {
  const { kind } = section
  const heading = section.heading ? `<h2>${esc(section.heading)}</h2>` : ''
  const intro = section.intro ? p(section.intro) : ''
  const body = Array.isArray(section.body) ? section.body.map(p).join('\n') : ''

  switch (kind) {
    case 'answer':
      // No heading, and marked up so the styling can give it the weight its
      // position deserves. This block is what an assistant quotes.
      return `<div class="answer">\n${body}\n</div>`

    case 'prose':
      return `<section>\n${heading}\n${body}\n</section>`

    case 'list':
      return `<section>
${heading}
${intro}
<ul>
${section.items.map((i) => `<li>${esc(i.text)}</li>`).join('\n')}
</ul>
</section>`

    case 'table':
      // A real <table>. A grid of divs is guesswork for a machine reader and
      // this page's whole job is to be read by one.
      return `<section>
${heading}
${intro}
<div class="tablewrap">
<table>
<thead><tr>${section.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
<tbody>
${section.rows
  .map((row) => `<tr>${row.map((cell, i) => (i === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`)).join('')}</tr>`)
  .join('\n')}
</tbody>
</table>
</div>
</section>`

    case 'cta':
      return `<aside class="cta">
${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}
${body}
<p class="cta__go"><a href="${esc(section.href)}">${esc(section.linkText)}</a></p>
</aside>`

    case 'faq':
      // Questions as headings, answers as prose, everything open. A <details>
      // accordion would keep the text in the HTML but read as de-emphasized,
      // and it is worse for somebody holding a phone in a stadium seat.
      return `<section class="faq">
${heading}
${section.items.map((i) => `<h3>${esc(i.q)}</h3>\n${p(i.a)}`).join('\n')}
</section>`

    case 'related':
      return `<nav class="related" aria-label="Related guides">
${heading}
<ul>
${section.items.map((i) => `<li><a href="${esc(i.href)}">${esc(i.text)}</a></li>`).join('\n')}
</ul>
</nav>`

    default:
      return ''
  }
}

function renderSources(sources = []) {
  if (!sources.length) return ''
  return `<section class="sources">
<h2>Sources</h2>
<p>Primary references used for the rules, definitions, and product details on this page.</p>
<ul>
${sources.map((source) => `<li><a href="${esc(source.href)}">${esc(source.name)}</a></li>`).join('\n')}
</ul>
</section>`
}

// JSON-LD. Worth being clear-eyed about what this buys in 2026: Google removed
// FAQ rich results in May 2026 and had already dropped HowTo, so none of this
// produces a search feature any more. It stays because it is still the cheapest
// way to hand a machine reader an unambiguous parse of what the page is, who
// published it, and which question each answer belongs to — and because
// unused structured data costs nothing.
function jsonLd(page, url) {
  const graph = [
    {
      '@type': 'Article',
      headline: page.h1,
      description: page.metaDescription,
      dateModified: page.updated,
      mainEntityOfPage: url,
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      citation: (page.sources || []).map((source) => source.href),
      isAccessibleForFree: true,
    },
  ]

  const faq = page.sections.find((s) => s.kind === 'faq')
  if (faq && page.schema.includes('FAQPage')) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.items.map((i) => ({
        '@type': 'Question',
        name: i.q,
        acceptedAnswer: { '@type': 'Answer', text: i.a },
      })),
    })
  }

  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
  // </script> inside a JSON string would close this block early. Escaping the
  // slash keeps the JSON valid and the document intact.
  return `<script type="application/ld+json">${json.replace(/</g, '\\u003c')}</script>`
}

// One group heading, shared by every layout below: a lettered badge (A, B, C…,
// the group's position in the hub) ahead of the heading text.
function groupHead(group, index) {
  const letter = String.fromCharCode(65 + index)
  return `<h2 id="group-${esc(group.id)}"><span class="index-group__badge">${letter}</span>${esc(group.heading)}</h2>`
}

// "Start keeping score" is the one group a brand-new scorer works through in
// order, not a shelf to browse — so it gets a numbered read-in-order list
// plus a short jump rail, instead of the card grid every other group uses.
function renderStartGroup(group, index) {
  const items = group.pages
    .map(
      (page, i) => `<li>
<span class="basics__num">${String(i + 1).padStart(2, '0')}</span>
<div><h3><a href="/learn/${esc(page.slug)}">${esc(page.h1)}</a></h3><p>${esc(page.metaDescription)}</p></div>
</li>`,
    )
    .join('\n')
  const rail = group.pages
    .map((page) => `<a href="/learn/${esc(page.slug)}">${esc(page.h1)}</a>`)
    .join('\n')

  return `<section class="index-group" aria-labelledby="group-${esc(group.id)}">
${groupHead(group, index)}
<p>${esc(group.description)}</p>
<div class="basics">
<ol class="basics__list">
${items}
</ol>
<nav class="basics__rail" aria-label="Jump to a guide in this group">
<p class="basics__rail-label">Read in order</p>
${rail}
</nav>
</div>
</section>`
}

function renderCardGroup(group, index) {
  return `<section class="index-group" aria-labelledby="group-${esc(group.id)}">
${groupHead(group, index)}
<p>${esc(group.description)}</p>
<ul class="index">
${group.pages
  .map(
    (page, i) => `<li>
<span class="index__num">${i + 1}</span>
<div><h3><a href="/learn/${esc(page.slug)}">${esc(page.h1)}</a></h3><p>${esc(page.metaDescription)}</p></div>
</li>`,
  )
  .join('\n')}
</ul>
</section>`
}

// The hub at /learn. It exists for two audiences at once: a reader who wants to
// see what else is here, and a crawler that needs one page linking to all of
// them. A set of guides with no index is a set of orphans — internal links are
// how a crawler discovers that page six exists.
export function renderIndex(groups) {
  const title = `Baseball Scorekeeping Guides | ${SITE_NAME}`
  const description =
    'Free guides to keeping score of a baseball game by hand — notation, scorebooks, box scores, statistics, and watching on delay without spoilers.'
  const url = `${SITE_URL}/learn`
  const pages = groups.flatMap((group) => group.pages)
  const itemList = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Baseball scorekeeping guides',
    url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: pages.map((page, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: page.h1,
        url: `${SITE_URL}/learn/${page.slug}`,
      })),
    },
  }).replace(/</g, '\\u003c')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
<meta name="theme-color" content="#F6EFDC" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${SITE_URL}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="/learn.css" />
<script type="application/ld+json">${itemList}</script>
</head>
<body>
<header class="masthead">
<a class="masthead__mark" href="/">${esc(SITE_NAME)}</a>
</header>
<main>
<article>
<h1>Scorekeeping guides</h1>
<div class="answer"><p>Everything here is free, and none of it needs an account. These guides cover keeping score of a baseball game by hand — the notation, the equipment, and the reading skills that go with it — written for somebody starting from nothing.</p></div>
${groups
  .map((group, index) => (group.id === 'start' ? renderStartGroup(group, index) : renderCardGroup(group, index)))
  .join('\n')}
</article>
</main>
<footer class="footer">
<p><a href="/">${esc(SITE_NAME)}</a> is a free, spoiler-safe companion for scoring baseball by hand. It is not a data-entry tool — you keep score on paper.</p>
</footer>
</body>
</html>`
}

// The gear that opens the editor for this page — ADR-0044's "content is edited
// where it is rendered", applied to a document that has no React on it.
//
// It ships HIDDEN and is revealed by four lines of inline script when a Clerk
// session cookie is present. That is not a security decision and must not be
// mistaken for one: the cookie proves somebody is signed in, not that they are
// the site owner. The real boundary is unchanged and lives on the server —
// `authenticateAdmin` plus the `COPY_ADMIN_USER_IDS` allowlist — so a signed-in
// stranger who finds the gear reaches an editor that refuses to save. ADR-0044
// already settled this trade for the Ballpark card; the reasoning is identical
// and the consequence of being wrong is a visible control, not a write.
//
// It is inline and tiny on purpose. A page whose entire premise is that it works
// without JavaScript should not load a script to decide whether to show a link,
// and a crawler that ignores the script sees a hidden element and nothing else.
function gear(slug, admin) {
  const link = `<a class="masthead__gear" id="learn-gear" href="/learn/${esc(slug)}?edit" aria-label="Edit this page"${admin ? '' : ' hidden'}>&#9881;</a>`
  if (admin) return link
  return `${link}
<script>if(document.cookie.indexOf('__session')>-1){var g=document.getElementById('learn-gear');if(g)g.hidden=false}</script>`
}

// `admin` draws the gear. It is CONVENIENCE ONLY — the boundary is the server
// allowlist in api/_lib/adminAuth.js, exactly as ADR-0044 established for the
// Ballpark card. A forged gear links to an editor that produces 403s on save.
export function renderPage(page, { admin = false } = {}) {
  const url = `${SITE_URL}/learn/${page.slug}`
  const title = `${page.metaTitle} | ${SITE_NAME}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.metaDescription)}" />
<link rel="canonical" href="${esc(url)}" />
<link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
<link rel="apple-touch-icon" href="/icons/tally-baseball-mark-180.png" />
<meta name="theme-color" content="#F6EFDC" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:title" content="${esc(page.metaTitle)}" />
<meta property="og:description" content="${esc(page.metaDescription)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${SITE_URL}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(page.metaTitle)}" />
<meta name="twitter:description" content="${esc(page.metaDescription)}" />
<meta name="twitter:image" content="${SITE_URL}/og-image.png" />
<link rel="stylesheet" href="/learn.css" />
${jsonLd(page, url)}
</head>
<body>
<header class="masthead">
<a class="masthead__mark" href="/">${esc(SITE_NAME)}</a>
<nav class="masthead__crumb" aria-label="Breadcrumb"><a href="/learn">Guides</a></nav>
${gear(page.slug, admin)}
</header>
<main>
<article>
<h1>${esc(page.h1)}</h1>
${page.sections.filter((section) => section.kind !== 'related').map(renderSection).join('\n')}
${renderSources(page.sources)}
${page.sections.filter((section) => section.kind === 'related').map(renderSection).join('\n')}
</article>
</main>
<footer class="footer">
<p><a href="/">${esc(SITE_NAME)}</a> is a free, spoiler-safe companion for scoring baseball by hand. It is not a data-entry tool — you keep score on paper.</p>
<p class="footer__meta">Last updated ${esc(page.updated)}.</p>
</footer>
</body>
</html>`
}
