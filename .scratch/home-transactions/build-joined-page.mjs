// Renders joined.json into joined.html — the same feed in three treatments,
// switchable, so the cost of each join can be seen rather than argued about.
//
// Run: node .scratch/home-transactions/build-joined-page.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const j = JSON.parse(readFileSync(join(here, 'joined.json'), 'utf8'))
const W = j.window
const B = j.backtest

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))
const n = (v) => Number(v).toLocaleString('en-US')

// Trim each line to what the page renders.
const slimLine = (l) => ({
  description: l.description,
  typeCode: l.typeCode,
  typeDesc: l.typeDesc,
  club: l.club,
  otherClub: l.otherClub,
  twoClubs: l.twoClubs,
  personName: l.personName,
})
const slimEntry = (e) => ({
  date: e.date,
  club: e.club,
  personName: e.personName,
  joined: e.joined,
  lines: e.lines.map(slimLine),
})

const payload = {
  window: {
    start: W.start,
    end: W.end,
    counts: W.counts,
    entries: W.entries.map(slimEntry),
    clubDays: W.clubDays.map((d) => ({
      date: d.date,
      standalone: d.standalone.map(slimEntry),
      clubs: d.clubs.map((c) => ({ club: c.club, entries: c.entries.map(slimEntry) })),
    })),
  },
  backtest: { start: B.start, end: B.end, counts: B.counts, chainKinds: B.chainKinds, echoes: B.echoes },
  exampleChains: j.exampleChains,
  worstBlock: j.worstBlock,
  generatedAt: j.generatedAt,
}

const html = `<title>The same feed, with related moves joined</title>
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

/* view switch */
.switch { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
.switch button {
  font: inherit; font-size: 12.5px; padding: 8px 12px; cursor: pointer; text-align: left;
  background: var(--paper-inset); color: var(--ink-soft); border: 1px solid var(--rule);
}
.switch button b { display: block; color: var(--ink); font-size: 13px; }
.switch button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.switch button[aria-pressed="true"] b { color: var(--paper); }
.switch button:focus-visible { outline: 2px solid var(--amber-line); outline-offset: 2px; }
.viewnote { font-size: 13px; color: var(--ink-soft); margin: 0 0 14px; padding-left: 10px; border-left: 3px solid var(--amber-line); overflow-wrap: anywhere; }

/* the sheet */
.sheet { border: 1px solid var(--rule); background: var(--paper-raised); }
.sheet__day {
  display: flex; justify-content: space-between; gap: 12px; align-items: baseline;
  padding: 11px 16px; background: var(--paper-inset); border-bottom: 1px solid var(--rule);
  font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink); font-weight: 700;
}
.sheet__day span { color: var(--graphite); font-weight: 400; letter-spacing: .04em; }
.clubhead {
  display: flex; gap: 10px; align-items: baseline; padding: 10px 16px 8px;
  border-top: 1px solid var(--rule); background: var(--paper-inset);
}
.clubhead__abbr { font-size: 15px; font-weight: 700; color: var(--ink); letter-spacing: .06em; }
.clubhead__name { font-size: 12px; color: var(--graphite); flex: 1 1 auto; min-width: 0; }
.clubhead__n { font-size: 11px; color: var(--graphite); white-space: nowrap; }
.standalonehead {
  padding: 10px 16px 8px; border-top: 1px solid var(--rule); background: var(--paper-inset);
  font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--graphite); font-weight: 700;
}
.entry { min-width: 0; padding: 10px 16px; border-top: 1px solid var(--rule-soft); }
.entry--in-club { padding-left: 26px; }
.entry__tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; margin-bottom: 5px; }
.entry__line { margin: 0; font-size: 15px; color: var(--ink-body); overflow-wrap: anywhere; }
.entry__line + .entry__line { margin-top: 4px; }
.entry__line--sub { padding-left: 14px; position: relative; color: var(--ink-soft); font-size: 14px; }
.entry__line--sub::before { content: "└"; position: absolute; left: 0; color: var(--graphite); }
.tag {
  font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700;
  padding: 2px 6px; border: 1px solid var(--rule); color: var(--ink-soft); background: var(--paper-inset);
}
.tag--club { color: var(--amber); border-color: var(--amber-line); background: var(--amber-soft); }
.tag--two { color: var(--field); border-color: var(--field-line); background: var(--field-soft); }
.tag--chain { color: var(--clay); border-color: var(--clay-line); background: var(--clay-soft); }

/* tables + scores */
.tablewrap { overflow-x: auto; border: 1px solid var(--rule); background: var(--paper-raised); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 7px 12px; border-bottom: 1px solid var(--rule-soft); white-space: nowrap; }
th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--graphite); font-weight: 700; background: var(--paper-inset); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.wrap-cell { white-space: normal; min-width: 240px; }
tr:last-child td { border-bottom: 0; }
.muted { color: var(--graphite); }
.scores { display: grid; gap: 1px; background: var(--rule-soft); border: 1px solid var(--rule); }
@media (min-width: 700px) { .scores { grid-template-columns: repeat(3, 1fr); } }
.score { background: var(--paper-raised); padding: 13px 14px 15px; }
.score__v { font-size: 26px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.score__l { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-soft); margin-top: 6px; }
.score__n { font-size: 11px; color: var(--graphite); margin-top: 3px; }

.quote { background: var(--paper-inset); border: 1px solid var(--rule-soft); padding: 10px 12px; margin: 10px 0 0; font-size: 13px; overflow-x: auto; }
.quote__h { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber); font-weight: 700; margin-bottom: 5px; }
.quote p { margin: 3px 0; color: var(--ink-body); overflow-wrap: anywhere; }
.quote code { color: var(--graphite); }

details { margin-top: 10px; }
summary { cursor: pointer; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--amber); list-style: none; }
summary::-webkit-details-marker { display: none; }
summary::before { content: "▸ "; }
details[open] > summary::before { content: "▾ "; }
summary:focus-visible { outline: 2px solid var(--amber-line); outline-offset: 2px; }
.footnote { margin-top: 44px; padding-top: 14px; border-top: 1px solid var(--rule); font-size: 12px; color: var(--graphite); }
.footnote code { background: var(--paper-inset); padding: 1px 5px; border: 1px solid var(--rule-soft); }
</style>

<div class="wrap">
<header class="mast">
  <p class="mast__eyebrow">Tally · home-page transaction log · joining related moves</p>
  <h1>The same feed, with related moves joined</h1>
  <p>"Related" turns out to cover two different things, and only one of them is knowable from the data. Joining a player's own moves is provable — the rows carry his id. Putting a club's separate moves together is a layout decision, and calling one the cause of another would be a guess.</p>
  <p>Both are built here, kept apart, and switchable below, so the cost of each can be seen rather than argued about.</p>
  <div class="mast__meta">
    <span>Window <b>${W.start}</b> → <b>${W.end}</b></span>
    <span>Flat <b>${n(W.counts.printed)} lines</b></span>
    <span>Joined <b>${n(W.counts.entriesAfterChaining)} entries</b></span>
    <span>Grouped <b>${n(W.counts.clubBlocks)} club blocks</b></span>
  </div>
</header>

<section id="views">
  <h2>The feed, three ways</h2>
  <p class="lede">Same rows, same sentences, same de-duplication. Only the joining changes.</p>
  <div class="switch" id="switch">
    <button type="button" data-view="flat" aria-pressed="false"><b>Flat</b>${n(W.counts.printed)} lines, wire order</button>
    <button type="button" data-view="chain" aria-pressed="false"><b>Joined by player</b>${n(W.counts.entriesAfterChaining)} entries</button>
    <button type="button" data-view="club" aria-pressed="true"><b>Joined and grouped by club</b>${n(W.counts.clubBlocks)} blocks + ${n(W.counts.standaloneEntries)} standalone</button>
  </div>
  <p class="viewnote" id="viewnote"></p>
  <div class="sheet" id="sheet"></div>
</section>

<section id="passA">
  <h2>Pass A — a player's own moves</h2>
  <p class="lede">Rows sharing a player, a club and a day become one entry. Nothing is inferred: the rows carry the same person id, so this join is a fact about the data rather than a reading of it.</p>
  <div class="scores">
    <div class="score"><div class="score__v">${n(B.counts.chainsFormed)}</div><div class="score__l">Chains over the season</div><div class="score__n">${B.start} to ${B.end}</div></div>
    <div class="score"><div class="score__v">${n(B.counts.linesSavedByChaining)}</div><div class="score__l">Lines absorbed</div><div class="score__n">${n(B.counts.printed)} → ${n(B.counts.entriesAfterChaining)} entries</div></div>
    <div class="score"><div class="score__v">${n(W.counts.chainsFormed)}</div><div class="score__l">Chains in this window</div><div class="score__n">of ${n(W.counts.printed)} lines</div></div>
  </div>
  <p class="lede">It is a small effect most days — two chains in this window — and a real one on the days it fires. The most common shapes, by type code:</p>
  <div class="tablewrap"><table>
    <thead><tr><th class="num">Chains</th><th>Shape</th><th class="wrap-cell">What it is</th></tr></thead>
    <tbody>${B.chainKinds.slice(0, 8).map((k) => `<tr><td class="num">${k.n}</td><td><b>${esc(k.kinds)}</b></td><td class="wrap-cell muted">${esc({
      'SC → OPT': 'Activated off the injured list, then sent down the same day.',
      'CLW → OPT': 'Claimed off waivers, then optioned — one arrival, not two moves.',
      'SC → SC': 'Two status changes for one player on one day.',
      'NUM → SC': 'A number change filed alongside the move that prompted it.',
      'CU → SC': 'Recalled, then formally activated.',
      'TR → OPT': 'Traded, then optioned by his new club.',
      'SE → SC': 'Contract selected, then activated.',
      'TR → SC': 'Traded, then a status change at the new club.',
    }[k.kinds] ?? '')}</td></tr>`).join('')}</tbody>
  </table></div>

  <h3>What joining exposed: the wire echoes itself</h3>
  <p class="lede">This was not the reason for building it. The sentence rule can only collapse rows that print the <em>same</em> sentence — but one demotion often arrives as three different sentences, and they only become visibly one event once a player's rows sit together.</p>
  <div id="echoes"></div>
  <p class="lede">${n(B.echoes.chains)} chains this season contain one of these bookkeeping echoes — a "roster status changed by…" or a "reassigned to the minor leagues" restating a move the chain already carries. Flat, they print as separate news.</p>
  <h3>The longest chains of the season</h3>
  <div id="chains"></div>
</section>

<section id="passB">
  <h2>Pass B — a club's day</h2>
  <p class="lede">Everything left over, filed under the club that made the move. This is presentation, not analysis: the entries under one heading share a club and a date, and nothing here claims one caused another. That claim is exactly what the old club-page pipeline made, and it is what produced "recalled X; designated Y for assignment" for two moves that had nothing to do with each other.</p>
  <div class="scores">
    <div class="score"><div class="score__v">${n(W.counts.clubBlocks)}</div><div class="score__l">Club blocks in this window</div><div class="score__n">${n(W.counts.clubBlocksWithMoreThanOne)} hold more than one entry</div></div>
    <div class="score"><div class="score__v">${n(W.counts.biggestClubBlock)}</div><div class="score__l">Biggest block here</div><div class="score__n">Toronto's six moves</div></div>
    <div class="score"><div class="score__v">${n(B.counts.biggestClubBlock)}</div><div class="score__l">Biggest block all season</div><div class="score__n">see below</div></div>
  </div>

  <h3>Two-club moves refuse to be filed</h3>
  <p class="lede">A trade and a waiver claim belong to both clubs. Filing one under a single heading would put a Mariners claim under a Mariners banner while the Rangers half of it vanishes from view — so these stand outside the club blocks, tagged with both clubs, exactly as they read in the flat feed. ${n(W.counts.standaloneEntries)} of this window's entries land there.</p>

  <h3>The biggest club block of the season is not what you'd expect</h3>
  <p class="lede">It is not a deadline day. On ${payload.worstBlock ? esc(payload.worstBlock.date) : ''} the ${payload.worstBlock ? esc(payload.worstBlock.club.name) : ''} filed <b>${payload.worstBlock ? payload.worstBlock.entries.length : 0} entries</b> — and they are almost entirely uniform number changes, because on Jackie Robinson Day every player wears 42 and the wire files a row for each of them.</p>
  <div id="worst"></div>
  <p class="lede">Grouping by club is what makes this visible. Flat, those rows are scattered through the day and read as ordinary noise; blocked, one club's heading swallows the page. It is the strongest argument yet for deciding what <code>NUM</code> is doing in this feed at all.</p>
</section>

<section id="cost">
  <h2>What joining costs</h2>
  <div class="tablewrap"><table>
    <thead><tr><th class="wrap-cell">Cost</th><th class="wrap-cell">Detail</th></tr></thead>
    <tbody>
      <tr><td class="wrap-cell"><b>The club's name is now printed twice.</b></td><td class="wrap-cell">Under a heading reading TORONTO BLUE JAYS, every sentence beneath it still starts "Toronto Blue Jays…". Six times in this window's biggest block. Either the heading goes or the sentence gets trimmed — and trimming the sentence is the first step away from printing the wire's own words.</td></tr>
      <tr><td class="wrap-cell"><b>A club with one move gets a heading anyway.</b></td><td class="wrap-cell">${n(W.counts.clubBlocks - W.counts.clubBlocksWithMoreThanOne)} of this window's ${n(W.counts.clubBlocks)} blocks hold a single entry, so the heading costs a line and buys nothing.</td></tr>
      <tr><td class="wrap-cell"><b>Chronology is gone.</b></td><td class="wrap-cell">Grouped by club, the day no longer reads in the order it happened. For a 48-hour feed that may not matter; for a live one it would.</td></tr>
      <tr><td class="wrap-cell"><b>A chain still prints every sentence.</b></td><td class="wrap-cell">Joining sets the lines side by side; it does not merge them into one sentence. "Signed free agent RHP Craig Kimbrel" and "activated RHP Craig Kimbrel" both still print. Writing one sentence out of two means leaving the wire's words behind.</td></tr>
    </tbody>
  </table></div>
</section>

<p class="footnote">Regenerate: <code>node .scratch/home-transactions/join-related.mjs 2 140</code> then <code>node .scratch/home-transactions/build-joined-page.mjs</code>. The scope and de-duplication come from <code>wire.mjs</code>, shared with the flat version so the two cannot disagree about what a line is. Pulled ${payload.generatedAt.slice(0, 10)}.</p>
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

const NOTES = {
  flat: 'One line per move, in the order the wire filed them — the version already built. A club appears as often as it acted.',
  chain: 'A player\\'s moves on one day at one club become a single entry, with his later lines indented beneath the first. Nothing else moves.',
  club: 'The same entries, filed under the club that made them. Trades and waiver claims stay outside, because they belong to two clubs at once.',
}

function tags(entry, opts) {
  const first = entry.lines[0]
  const out = []
  if (opts.showClub && first.club) out.push('<span class="tag tag--club">' + esc(first.club.abbr || first.club.name) + '</span>')
  out.push('<span class="tag">' + esc(first.typeDesc) + '</span>')
  if (first.twoClubs) {
    out.push('<span class="tag tag--two">' + (first.otherClub ? 'with ' + esc(first.otherClub.abbr) : 'two MLB clubs') + '</span>')
  }
  if (entry.joined) out.push('<span class="tag tag--chain">' + entry.lines.length + ' moves, one player</span>')
  return '<div class="entry__tags">' + out.join('') + '</div>'
}

function entryHtml(entry, opts) {
  return '<div class="entry' + (opts.inClub ? ' entry--in-club' : '') + '">' +
    tags(entry, opts) +
    entry.lines.map((l, i) =>
      '<p class="entry__line' + (i > 0 ? ' entry__line--sub' : '') + '">' + esc(l.description) + '</p>').join('') +
    '</div>'
}

function renderFlat() {
  const lines = []
  for (const e of D.window.entries) for (const l of e.lines) lines.push({ ...e, lines: [l], joined: false })
  return renderByDay(lines, { showClub: true, inClub: false })
}

function renderChains() {
  return renderByDay(D.window.entries, { showClub: true, inClub: false })
}

function renderByDay(entries, opts) {
  let out = ''
  let day = null
  for (const e of entries) {
    if (e.date !== day) {
      day = e.date
      const count = entries.filter((x) => x.date === day).length
      out += '<div class="sheet__day">' + esc(dateline(day)) + '<span>' + count + (opts.unit || ' entries') + '</span></div>'
    }
    out += entryHtml(e, opts)
  }
  return out
}

function renderClubs() {
  let out = ''
  for (const day of D.window.clubDays) {
    const total = day.clubs.length + day.standalone.length
    out += '<div class="sheet__day">' + esc(dateline(day.date)) + '<span>' + day.clubs.length + ' clubs, ' + day.standalone.length + ' standalone</span></div>'
    for (const c of day.clubs) {
      out += '<div class="clubhead">' +
        '<span class="clubhead__abbr">' + esc(c.club.abbr || '') + '</span>' +
        '<span class="clubhead__name">' + esc(c.club.name) + '</span>' +
        '<span class="clubhead__n">' + c.entries.length + (c.entries.length === 1 ? ' move' : ' moves') + '</span>' +
        '</div>'
      out += c.entries.map((e) => entryHtml(e, { showClub: false, inClub: true })).join('')
    }
    if (day.standalone.length) {
      out += '<div class="standalonehead">Between two clubs — filed under neither</div>'
      out += day.standalone.map((e) => entryHtml(e, { showClub: true, inClub: false })).join('')
    }
    if (!total) out += '<div class="entry"><p class="entry__line">Nothing involving an MLB club.</p></div>'
  }
  return out
}

let view = 'club'
function render() {
  document.getElementById('viewnote').innerHTML = NOTES[view]
  document.getElementById('sheet').innerHTML =
    view === 'flat' ? renderFlat() : view === 'chain' ? renderChains() : renderClubs()
  for (const b of document.querySelectorAll('#switch button')) {
    b.setAttribute('aria-pressed', String(b.dataset.view === view))
  }
}
for (const b of document.querySelectorAll('#switch button')) {
  b.addEventListener('click', () => { view = b.dataset.view; render() })
}
render()

// Example blocks below the fold.
const chainBlock = (c) =>
  '<div class="quote"><div class="quote__h">' + esc(c.date) + ' · ' + esc(c.club ? c.club.abbr : '') + ' · ' + esc(c.personName) + '</div>' +
  c.lines.map((l) => '<p><code>' + esc(l.typeCode) + '</code> ' + esc(l.description) + '</p>').join('') + '</div>'

document.getElementById('echoes').innerHTML = D.backtest.echoes.examples.map(chainBlock).join('')
document.getElementById('chains').innerHTML = D.exampleChains.slice(0, 5).map(chainBlock).join('')

if (D.worstBlock) {
  document.getElementById('worst').innerHTML =
    '<div class="quote"><div class="quote__h">' + esc(D.worstBlock.date) + ' · ' + esc(D.worstBlock.club.name) + ' · ' + D.worstBlock.entries.length + ' entries</div>' +
    D.worstBlock.entries.slice(0, 10).map((e) => '<p>' + esc(e.lines[0].description) + '</p>').join('') +
    (D.worstBlock.entries.length > 10 ? '<p class="muted">…and ' + (D.worstBlock.entries.length - 10) + ' more.</p>' : '') +
    '</div>'
}
</script>
`

writeFileSync(join(here, 'joined.html'), html)
console.log(`wrote joined.html — ${(html.length / 1024).toFixed(0)} KB, ${payload.window.entries.length} entries`)
