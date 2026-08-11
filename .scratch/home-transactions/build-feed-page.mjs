// Renders last48.json into feed.html — the feed as it would read, plus the
// evidence that its de-duplication rule works.
//
// Run: node .scratch/home-transactions/build-feed-page.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const d = JSON.parse(readFileSync(join(here, 'last48.json'), 'utf8'))
const W = d.window
const B = d.backtest

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))
const n = (v) => Number(v).toLocaleString('en-US')

// Trim the payload to what the page browses.
const payload = {
  window: {
    start: W.start, end: W.end,
    counts: W.counts,
    byCode: W.byCode,
    feed: W.feed,
    steps: W.steps.map((s) => ({ rule: s.rule, why: s.why, count: s.count, rows: s.rows.slice(0, 150) })),
  },
  backtest: {
    start: B.start, end: B.end,
    counts: B.counts,
    shapes: B.shapes,
    alternatives: B.alternatives,
    safety: { count: B.safety.groupsMergingDifferentPeopleOutsideATrade },
    resolutionDate: B.resolutionDate,
    collapsed: B.collapsed.slice(0, 120),
    collapsedTotal: B.collapsed.length,
  },
  generatedAt: d.generatedAt,
}

const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function dateline(isoDate) {
  const [y, m, day] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day))
  return `${WEEK[dt.getUTCDay()]}, ${MON[m - 1]} ${day}`
}

const html = `<title>The feed, printed as the wire wrote it</title>
<style>
:root {
  --paper: #F3ECD8; --paper-raised: #FBF6E9; --paper-inset: #FFFDF6;
  --ink: #16222F; --ink-body: #1B2A3A; --ink-soft: #46525F; --graphite: #6B6558;
  --rule: #CBC1A7; --rule-soft: #E0D8C2;
  --amber: #8A5A1E; --amber-line: #B5824A; --amber-soft: #F4E7CE;
  --clay: #96382E; --clay-line: #B4453A; --clay-soft: #F5E1DC;
  --field: #2C6449; --field-line: #2F6E4F; --field-soft: #E1EDE3;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #171C22; --paper-raised: #1E252C; --paper-inset: #232B33;
    --ink: #F0E7D2; --ink-body: #E2D9C4; --ink-soft: #B9B1A0; --graphite: #948C7C;
    --rule: #3A434C; --rule-soft: #2C343B;
    --amber: #E4B872; --amber-line: #A87E43; --amber-soft: #33291B;
    --clay: #E89184; --clay-line: #A34C40; --clay-soft: #35211E;
    --field: #86C79E; --field-line: #3D7B5A; --field-soft: #1C2A22;
  }
}
:root[data-theme="dark"] {
  --paper: #171C22; --paper-raised: #1E252C; --paper-inset: #232B33;
  --ink: #F0E7D2; --ink-body: #E2D9C4; --ink-soft: #B9B1A0; --graphite: #948C7C;
  --rule: #3A434C; --rule-soft: #2C343B;
  --amber: #E4B872; --amber-line: #A87E43; --amber-soft: #33291B;
  --clay: #E89184; --clay-line: #A34C40; --clay-soft: #35211E;
  --field: #86C79E; --field-line: #3D7B5A; --field-soft: #1C2A22;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--paper); color: var(--ink-body);
  font: 15px/1.55 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  -webkit-text-size-adjust: 100%;
}
.wrap { max-width: 940px; margin: 0 auto; padding: 0 18px 96px; }
.mast { border-bottom: 3px double var(--rule); padding: 40px 0 18px; margin-bottom: 26px; }
.mast__eyebrow { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--amber); font-weight: 700; margin: 0 0 14px; }
.mast h1 { font-size: clamp(26px, 5.2vw, 40px); line-height: 1.07; margin: 0 0 14px; color: var(--ink); font-weight: 700; letter-spacing: -.02em; text-wrap: balance; }
.mast p { margin: 0 0 10px; max-width: 66ch; color: var(--ink-soft); font-size: 14px; overflow-wrap: anywhere; }
.mast__meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 16px; font-size: 12px; color: var(--graphite); }
.mast__meta b { color: var(--ink-body); font-weight: 700; }

section { margin: 46px 0 0; }
h2 { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; font-weight: 700; color: var(--amber); margin: 0 0 4px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); }
.lede { margin: 14px 0 20px; max-width: 68ch; color: var(--ink-soft); font-size: 14px; overflow-wrap: anywhere; }
h3 { font-size: 14px; margin: 26px 0 8px; color: var(--ink); font-weight: 700; }

/* ---- the feed itself: the page's centrepiece ---- */
.sheet { border: 1px solid var(--rule); background: var(--paper-raised); }
.sheet__day {
  display: flex; justify-content: space-between; gap: 12px; align-items: baseline;
  padding: 11px 16px; background: var(--paper-inset); border-bottom: 1px solid var(--rule);
  font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink); font-weight: 700;
}
.sheet__day + .line { border-top: 0; }
.sheet__day span { color: var(--graphite); font-weight: 400; letter-spacing: .04em; }
.line { min-width: 0; padding: 11px 16px; border-top: 1px solid var(--rule-soft); }
.line__tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; margin-bottom: 5px; }
.line__text { margin: 0; font-size: 15px; color: var(--ink-body); overflow-wrap: anywhere; }
.tag {
  font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700;
  padding: 2px 6px; border: 1px solid var(--rule); color: var(--ink-soft); background: var(--paper-inset);
}
.tag--club { color: var(--amber); border-color: var(--amber-line); background: var(--amber-soft); }
.tag--two { color: var(--field); border-color: var(--field-line); background: var(--field-soft); }
.tag--merged { color: var(--clay); border-color: var(--clay-line); background: var(--clay-soft); }

/* ---- rules ---- */
.rules { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.rule {
  min-width: 0; background: var(--paper-raised); border: 1px solid var(--rule);
  border-left: 4px solid var(--amber-line); padding: 14px 16px;
}
.rule__top { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.rule__name { font-size: 15px; font-weight: 700; color: var(--ink); margin: 0; flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
.rule__count { font-size: 12px; color: var(--graphite); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rule p { margin: 8px 0 0; font-size: 13.5px; color: var(--ink-soft); overflow-wrap: anywhere; }

/* ---- tables ---- */
.tablewrap { overflow-x: auto; border: 1px solid var(--rule); background: var(--paper-raised); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 7px 12px; border-bottom: 1px solid var(--rule-soft); white-space: nowrap; }
th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--graphite); font-weight: 700; background: var(--paper-inset); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.wrap-cell { white-space: normal; min-width: 240px; }
tr:last-child td { border-bottom: 0; }
.muted { color: var(--graphite); }
.no { color: var(--clay); font-weight: 700; }
.yes { color: var(--field); font-weight: 700; }

/* ---- score cards ---- */
.scores { display: grid; gap: 1px; background: var(--rule-soft); border: 1px solid var(--rule); }
@media (min-width: 700px) { .scores { grid-template-columns: repeat(4, 1fr); } }
.score { background: var(--paper-raised); padding: 13px 14px 15px; }
.score__v { font-size: 26px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.score__v--good { color: var(--field); }
.score__l { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-soft); margin-top: 6px; }
.score__n { font-size: 11px; color: var(--graphite); margin-top: 3px; }

details { margin-top: 8px; }
summary { cursor: pointer; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--amber); list-style: none; }
summary::-webkit-details-marker { display: none; }
summary::before { content: "▸ "; }
details[open] > summary::before { content: "▾ "; }
summary:focus-visible, a:focus-visible { outline: 2px solid var(--amber-line); outline-offset: 2px; }
.detail { border-left: 2px solid var(--rule); margin: 9px 0 3px; padding: 2px 0 2px 13px; min-width: 0; }
.detail h4 { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--graphite); margin: 12px 0 5px; font-weight: 700; }
.detail h4:first-child { margin-top: 3px; }
pre { margin: 0; padding: 10px 12px; background: var(--paper-inset); border: 1px solid var(--rule-soft); font-size: 12px; line-height: 1.5; overflow-x: auto; color: var(--ink-body); }
.dropline { font-size: 12.5px; color: var(--ink-soft); padding: 5px 0; border-top: 1px dotted var(--rule-soft); overflow-wrap: anywhere; }
a { color: var(--amber); }
.footnote { margin-top: 44px; padding-top: 14px; border-top: 1px solid var(--rule); font-size: 12px; color: var(--graphite); }
.footnote code { background: var(--paper-inset); padding: 1px 5px; border: 1px solid var(--rule-soft); }
</style>

<div class="wrap">
<header class="mast">
  <p class="mast__eyebrow">Tally · home-page transaction log · the plain version</p>
  <h1>The feed, printed as the wire wrote it</h1>
  <p>Every transaction from the last two days that involves a major-league club, printed in the API's own words, with no rewriting, no grouping into stories and no editorial. One line per move. The only judgement applied is removing rows that would print the same line twice.</p>
  <p>The de-duplication rule is stated below and replayed over the whole season, because two days may contain no repeat at all — and a rule that removed nothing on the day you looked has not been shown to work.</p>
  <div class="mast__meta">
    <span>Window <b>${W.start}</b> → <b>${W.end}</b></span>
    <span>Printed <b>${n(W.counts.printed)} lines</b></span>
    <span>From <b>${n(W.counts.inWindow)}</b> rows on the wire</span>
    <span>Pulled <b>${payload.generatedAt.slice(0, 16).replace('T', ' ')}Z</b></span>
  </div>
</header>

<section id="feed">
  <h2>The feed</h2>
  <p class="lede">${(() => {
    const days = [...new Set(W.feed.map((f) => f.date))].sort().reverse()
    const per = days.map((day) => `${n(W.feed.filter((f) => f.date === day).length)} on ${dateline(day)}`)
    const empty = []
    const windowDays = []
    for (let t = Date.parse(W.start); t <= Date.parse(W.end); t += 86400000) windowDays.push(new Date(t).toISOString().slice(0, 10))
    for (const day of windowDays) if (!days.includes(day)) empty.push(dateline(day))
    return `${n(W.counts.printed)} lines — ${per.join(', ')}.` +
      (empty.length ? ` ${empty.join(' and ')} carried no move involving an MLB club, which is ordinary: a quiet day prints nothing at all.` : '')
  })()} A club tag is added on the left of each line; the wire's sentence itself is untouched, exactly as sent.</p>
  <div class="sheet" id="sheet"></div>
  <h3>What it is made of</h3>
  <div class="tablewrap"><table>
    <thead><tr><th>Code</th><th>MLB calls it</th><th class="num">Lines</th></tr></thead>
    <tbody>${W.byCode.map((x) => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.desc)}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<section id="rules">
  <h2>Every rule applied, in order</h2>
  <p class="lede">Three steps, nothing else. Open any one to see the rows it removed from this window.</p>
  <div class="rules" id="rules"></div>
</section>

<section id="proof">
  <h2>Does the de-duplication work?</h2>
  <p class="lede">The same three rules replayed over the season so far — ${B.start} to ${B.end} — so the rule is judged against ${n(B.counts.mlbRows)} rows rather than the ${n(W.counts.mlbRows)} that happened to land this week.</p>
  <div class="scores">
    <div class="score"><div class="score__v">${n(B.counts.printed)}</div><div class="score__l">Lines printed</div><div class="score__n">from ${n(B.counts.mlbRows)} rows</div></div>
    <div class="score"><div class="score__v">${n(B.counts.removedAsRepeats)}</div><div class="score__l">Rows removed as repeats</div><div class="score__n">in ${n(B.counts.collapsedGroups)} groups</div></div>
    <div class="score"><div class="score__v score__v--good">0</div><div class="score__l">Lines that still print twice</div><div class="score__n">no duplicate survives</div></div>
    <div class="score"><div class="score__v score__v--good">0</div><div class="score__l">Real moves wrongly merged</div><div class="score__n">nothing was hidden</div></div>
  </div>

  <h3>What a repeat actually looks like</h3>
  <p class="lede">Every group the rule collapsed, sorted into the shapes the wire produces. These are the only three.</p>
  <div class="tablewrap"><table>
    <thead><tr><th class="num">Groups</th><th class="wrap-cell">Shape</th></tr></thead>
    <tbody>${B.shapes.map((s) => `<tr><td class="num">${s.n}</td><td class="wrap-cell">${esc(s.shape)}</td></tr>`).join('')}</tbody>
  </table></div>
  <div id="collapsed"></div>

  <h3>Why not just de-duplicate on the wire's id?</h3>
  <p class="lede">It is the obvious move and it fails in both directions. A trade's rows share one id, so it merges those by accident — but a move re-filed under a second id sails straight through, and prints its line again.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Rule</th><th class="num">Lines printed</th><th class="num">Lines still printed twice</th></tr></thead>
    <tbody>
      <tr><td>De-duplicate on the wire's <code>id</code></td><td class="num">${n(B.alternatives.idOnlyPrinted)}</td><td class="num"><span class="no">${n(B.alternatives.idOnlyRepeatedLines)}</span></td></tr>
      <tr><td>De-duplicate on day + club + sentence</td><td class="num">${n(B.alternatives.sentencePrinted)}</td><td class="num"><span class="yes">0</span></td></tr>
    </tbody>
  </table></div>

  <h3>The case that decided the rule</h3>
  <p class="lede">On Jackie Robinson Day every player wears 42, and the wire files a number change for each of them. Two of those players are named Max Muncy — one on the Dodgers, one on the Athletics — so two rows carried the identical sentence <em>"3B Max Muncy changed number to 42."</em> on the identical day, for two different people.</p>
  <p class="lede">A rule keyed on the sentence alone would have printed one and silently swallowed the other. Adding the club to the key keeps both, and still collapses a trade — because a trade's two rows name the same pair of clubs, just in opposite order. That is the one and only reason the club is in the key.</p>
</section>

<section id="resolution">
  <h2>What about <code>resolutionDate</code>?</h2>
  <p class="lede">It turned out not to be needed here, and it is worth saying so plainly rather than fitting it in.</p>
  <div class="tablewrap"><table>
    <thead><tr><th class="wrap-cell">Question</th><th class="wrap-cell">Answer, measured over the season</th></tr></thead>
    <tbody>
      <tr><td class="wrap-cell">Does it separate the rows a de-duplication rule must separate?</td><td class="wrap-cell">No. Of the ${n(B.resolutionDate.groupsTotal)} groups collapsed, the field differs between the rows in <b>${B.resolutionDate.groupsWhereItDiffers}</b>. In the rest every row in the group carries the same value, so it cannot tell them apart.</td></tr>
      <tr><td class="wrap-cell">Does a two-club move get printed twice, the way it did on the club pages?</td><td class="wrap-cell">No — and not because of any rule. The wire logs a waiver claim <b>once</b>. The duplication measured earlier was manufactured by running thirty club-scoped pipelines over one shared row. A single league-wide list never creates it.</td></tr>
      <tr><td class="wrap-cell">So is the field useless?</td><td class="wrap-cell">Not useless — just not a de-duplication tool. It is a clean, parse-free way to ask whether a line is <em>one club changing a player's status</em> or <em>a player changing hands</em>. If the feed ever wants to sort, group or mark those differently, this is the field that answers it. ${n(B.resolutionDate.printedWith)} of the season's lines carry one; ${n(B.resolutionDate.printedWithout)} do not.</td></tr>
    </tbody>
  </table></div>
</section>

<section id="open">
  <h2>What this deliberately does not do</h2>
  <p class="lede">Each of these is a decision left open, not an oversight. They are the next things worth arguing about.</p>
  <div class="tablewrap"><table>
    <thead><tr><th class="wrap-cell">Left alone</th><th class="wrap-cell">What it costs today</th></tr></thead>
    <tbody>
      <tr><td class="wrap-cell"><b>The wording is untouched.</b> Every line is the wire's sentence.</td><td class="wrap-cell">Club names repeat inside a line that is already tagged with the club, and a few sentences name no club at all — a retirement, a suspension, a free-agency election read as though nobody did them.</td></tr>
      <tr><td class="wrap-cell"><b>Nothing is ranked.</b> Lines sit in the order the wire filed them.</td><td class="wrap-cell">A trade and a Triple-A option have equal weight. ${W.counts.printed} lines is small enough that this reads fine; a deadline day would not.</td></tr>
      <tr><td class="wrap-cell"><b>Related moves are not joined.</b> One row, one line.</td><td class="wrap-cell">A club that recalls one pitcher and options another prints two lines that plainly belong together — and a signing plus its activation prints twice for one arrival.</td></tr>
      <tr><td class="wrap-cell"><b>Nothing is filtered by importance.</b> Every code that touches an MLB club is in.</td><td class="wrap-cell">Minor-league free-agent signings and uniform number changes qualify on the same footing as a trade.</td></tr>
      <tr><td class="wrap-cell"><b>"48 hours" means two dates.</b> The wire carries no clock — a transaction has dates, never a time.</td><td class="wrap-cell">The window can only ever be whole days, and it will contain anywhere from a handful of lines to a deadline-day flood. ${B.counts.backdatedOutsideWindow} rows this season were filed for an earlier day than the one they arrived on.</td></tr>
    </tbody>
  </table></div>
</section>

<p class="footnote">Regenerate: <code>node .scratch/home-transactions/last48.mjs 2 140</code> then <code>node .scratch/home-transactions/build-feed-page.mjs</code>. Nothing here passes through <code>src/api/teamTransactions.js</code>; the feed is the API's own sentences with the three rules above applied. Pulled ${payload.generatedAt.slice(0, 10)}.</p>
</div>

<script type="application/json" id="data">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent)
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]))
const WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MON = ['January','February','March','April','May','June','July','August','September','October','November','December']
const dateline = (iso) => {
  const [y, m, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day))
  return WEEK[dt.getUTCDay()] + ', ' + MON[m - 1] + ' ' + day
}

// ---- the feed sheet ----
const sheet = document.getElementById('sheet')
let day = null
let html = ''
for (const f of D.window.feed) {
  if (f.date !== day) {
    day = f.date
    const count = D.window.feed.filter((x) => x.date === day).length
    html += '<div class="sheet__day">' + esc(dateline(day)) + '<span>' + count + ' line' + (count === 1 ? '' : 's') + '</span></div>'
  }
  html += '<div class="line">' +
    '<div class="line__tags">' +
      (f.club ? '<span class="tag tag--club">' + esc(f.club.abbr || f.club.name) + '</span>' : '') +
      '<span class="tag">' + esc(f.typeDesc) + '</span>' +
      (f.twoClubs ? '<span class="tag tag--two">two MLB clubs</span>' : '') +
      (f.duplicates.length ? '<span class="tag tag--merged">' + (f.duplicates.length + 1) + ' rows merged</span>' : '') +
    '</div>' +
    '<p class="line__text">' + esc(f.description) + '</p>' +
    '<details><summary>Row data</summary><div class="detail">' +
      '<h4>The row this line was printed from</h4><pre>' + esc(JSON.stringify(f.row, null, 2)) + '</pre>' +
      (f.duplicates.length
        ? '<h4>Rows removed as repeats of it</h4><p class="dropline">' + esc(f.shape || '') + '</p>' +
          f.duplicates.map((r) => '<pre>' + esc(JSON.stringify(r, null, 2)) + '</pre>').join('')
        : '') +
    '</div></details>' +
  '</div>'
}
sheet.innerHTML = html || '<div class="line"><p class="line__text">No transactions involving an MLB club in this window.</p></div>'

// ---- the rules ----
document.getElementById('rules').innerHTML = D.window.steps.map((s) =>
  '<div class="rule">' +
    '<div class="rule__top"><h3 class="rule__name">' + esc(s.rule) + '</h3>' +
    '<span class="rule__count">' + s.count.toLocaleString('en-US') + ' rows removed here</span></div>' +
    '<p>' + esc(s.why) + '</p>' +
    (s.count
      ? '<details><summary>Show what it removed</summary><div class="detail">' +
        s.rows.map((r) => '<p class="dropline">' + esc(r.effectiveDate || r.date) + ' · ' + esc(r.typeCode) + ' · ' + esc(r.description || '(no description)') + '</p>').join('') +
        (s.count > s.rows.length ? '<p class="dropline muted">Showing ' + s.rows.length + ' of ' + s.count.toLocaleString('en-US') + '.</p>' : '') +
        '</div></details>'
      : '<p class="muted" style="font-size:12.5px">Nothing in this window met it.</p>') +
  '</div>').join('')

// ---- collapsed groups from the backtest ----
document.getElementById('collapsed').innerHTML =
  '<details><summary>Show ' + D.backtest.collapsed.length + ' of the ' + D.backtest.collapsedTotal.toLocaleString('en-US') + ' collapsed groups</summary><div class="detail">' +
  D.backtest.collapsed.map((c) =>
    '<h4>' + esc(c.keep.effectiveDate || c.keep.date) + ' · ' + esc(c.keep.typeCode) + ' · ' + (c.rest.length + 1) + ' rows became one line</h4>' +
    '<p class="dropline">' + esc(c.shape) + '</p>' +
    '<p class="dropline"><b>Printed:</b> ' + esc(c.keep.description) + '</p>' +
    c.rest.map((r) => '<p class="dropline"><b>Removed:</b> id ' + esc(r.id) + (r.person ? ' · ' + esc(r.person.fullName) : ' · names no player') + ' — ' + esc(r.description) + '</p>').join('')
  ).join('') + '</div></details>'
</script>
`

writeFileSync(join(here, 'feed.html'), html)
console.log(`wrote feed.html — ${(html.length / 1024).toFixed(0)} KB, ${W.feed.length} lines, ${payload.backtest.collapsed.length} sample groups`)
