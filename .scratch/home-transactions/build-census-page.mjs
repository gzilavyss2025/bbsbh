// Renders census.json (see type-census.mjs) into census.html — the wire's own
// vocabulary, with the most recent examples of every kind, verbatim.
//
// Run: node .scratch/home-transactions/build-census-page.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const c = JSON.parse(readFileSync(join(here, 'census.json'), 'utf8'))

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))
const n = (v) => Number(v).toLocaleString('en-US')
const pct = (a, b) => b ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : '0%'

const html = `<title>The transaction wire's own vocabulary</title>
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
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 18px 96px; }
.mast { border-bottom: 3px double var(--rule); padding: 40px 0 18px; margin-bottom: 26px; }
.mast__eyebrow { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--amber); font-weight: 700; margin: 0 0 14px; }
.mast h1 { font-size: clamp(26px, 5.2vw, 40px); line-height: 1.07; margin: 0 0 14px; color: var(--ink); font-weight: 700; letter-spacing: -.02em; text-wrap: balance; }
.mast p { margin: 0 0 10px; max-width: 66ch; color: var(--ink-soft); font-size: 14px; overflow-wrap: anywhere; }
.mast__meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 16px; font-size: 12px; color: var(--graphite); }
.mast__meta b { color: var(--ink-body); font-weight: 700; }

section { margin: 44px 0 0; scroll-margin-top: 16px; }
h2 { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; font-weight: 700; color: var(--amber); margin: 0 0 4px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); }
.lede { margin: 14px 0 20px; max-width: 68ch; color: var(--ink-soft); font-size: 14px; overflow-wrap: anywhere; }
h3 { font-size: 14px; margin: 24px 0 8px; color: var(--ink); font-weight: 700; }

.tablewrap { overflow-x: auto; border: 1px solid var(--rule); background: var(--paper-raised); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 7px 12px; border-bottom: 1px solid var(--rule-soft); white-space: nowrap; }
th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--graphite); font-weight: 700; background: var(--paper-inset); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.wrap-cell { white-space: normal; min-width: 220px; }
tr:last-child td { border-bottom: 0; }
.muted { color: var(--graphite); }
a { color: var(--amber); }
a:focus-visible, summary:focus-visible, button:focus-visible { outline: 2px solid var(--amber-line); outline-offset: 2px; }

/* jump nav */
.jump { display: flex; flex-wrap: wrap; gap: 6px; margin: 16px 0 0; }
.jump a {
  font-size: 12px; padding: 4px 9px; border: 1px solid var(--rule); background: var(--paper-inset);
  color: var(--ink-soft); text-decoration: none;
}
.jump a b { color: var(--ink); }
.jump a:hover { border-color: var(--amber-line); color: var(--ink); }

/* a code block */
.code { min-width: 0; margin: 26px 0 0; border: 1px solid var(--rule); background: var(--paper-raised); }
.code__head { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: baseline; padding: 13px 16px; border-bottom: 1px solid var(--rule); background: var(--paper-inset); }
.code__id { font-size: 21px; font-weight: 700; color: var(--ink); letter-spacing: .04em; }
.code__desc { font-size: 14px; color: var(--ink-soft); flex: 1 1 160px; min-width: 0; }
.code__stat { font-size: 12px; color: var(--graphite); font-variant-numeric: tabular-nums; }
.code__stat b { color: var(--ink); }
.code__body { padding: 14px 16px 16px; }
.code__note { font-size: 13px; color: var(--ink-soft); margin: 0 0 14px; padding-left: 10px; border-left: 3px solid var(--amber-line); overflow-wrap: anywhere; }

.grouplabel { font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--graphite); font-weight: 700; margin: 16px 0 8px; }
.grouplabel:first-child { margin-top: 0; }

/* one example row */
.ex { border-top: 1px solid var(--rule-soft); padding: 9px 0; min-width: 0; }
.ex:first-of-type { border-top: 0; }
.ex__top { display: flex; flex-wrap: wrap; gap: 7px; align-items: baseline; }
.ex__date { font-size: 12px; color: var(--graphite); font-variant-numeric: tabular-nums; }
.tag { font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border: 1px solid var(--rule); color: var(--ink-soft); background: var(--paper-inset); }
.tag--mlb { color: var(--field); border-color: var(--field-line); background: var(--field-soft); }
.tag--minor { color: var(--graphite); }
.tag--fam { color: var(--amber); border-color: var(--amber-line); background: var(--amber-soft); }
.ex__desc { margin: 6px 0 0; font-size: 14px; color: var(--ink-body); overflow-wrap: anywhere; }
.ex__none { font-size: 13px; color: var(--graphite); font-style: italic; }

details { margin-top: 7px; }
summary { cursor: pointer; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--amber); list-style: none; }
summary::-webkit-details-marker { display: none; }
summary::before { content: "▸ "; }
details[open] > summary::before { content: "▾ "; }
.detail { border-left: 2px solid var(--rule); margin: 9px 0 3px; padding: 2px 0 2px 13px; min-width: 0; }
.detail h4 { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--graphite); margin: 12px 0 5px; font-weight: 700; }
.detail h4:first-child { margin-top: 3px; }
pre { margin: 0; padding: 10px 12px; background: var(--paper-inset); border: 1px solid var(--rule-soft); font-size: 12px; line-height: 1.5; overflow-x: auto; color: var(--ink-body); }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; font-size: 12.5px; margin: 0; }
.kv dt { color: var(--graphite); }
.kv dd { margin: 0; color: var(--ink-body); overflow-wrap: anywhere; }
.no { color: var(--clay); font-weight: 700; }
.yes { color: var(--field); font-weight: 700; }

.controls { position: sticky; top: 0; z-index: 5; background: var(--paper); border-bottom: 1px solid var(--rule); padding: 10px 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.chip { font: inherit; font-size: 12px; padding: 5px 10px; cursor: pointer; background: var(--paper-inset); color: var(--ink-soft); border: 1px solid var(--rule); }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.footnote { margin-top: 44px; padding-top: 14px; border-top: 1px solid var(--rule); font-size: 12px; color: var(--graphite); }
.footnote code { background: var(--paper-inset); padding: 1px 5px; border: 1px solid var(--rule-soft); }
</style>

<div class="wrap">
<header class="mast">
  <p class="mast__eyebrow">Tally · home-page transaction log · clean slate</p>
  <h1>The transaction wire's own vocabulary</h1>
  <p>Every kind of move MLB has published this season, straight from <code>/api/v1/transactions</code> — no filter, no grouping, no pipeline. ${n(c.totals.rows)} rows from Opening Day to today, sorted into the ${c.totals.codes} type codes the wire uses, with the most recent examples of each printed verbatim.</p>
  <p>This is the raw material for a home-page log, before anyone decides what it should show.</p>
  <div class="mast__meta">
    <span>Season <b>${c.window.startDate}</b> → <b>${c.window.endDate}</b></span>
    <span>Rows <b>${n(c.totals.rows)}</b></span>
    <span>Touching an MLB club <b>${n(c.totals.mlbTouching)}</b> (${pct(c.totals.mlbTouching, c.totals.rows)})</span>
    <span>Pulled <b>${c.generatedAt.slice(0, 16).replace('T', ' ')}Z</b></span>
  </div>
</header>

<section id="census">
  <h2>The census</h2>
  <p class="lede">Sorted by volume. "Touches an MLB club" means the row names a major-league club on either side — the rest is affiliate business the parent org never sees. Note how few codes carry the moves a fan would call news.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Code</th><th>MLB calls it</th><th class="num">Rows</th><th class="num">Touch an MLB club</th><th class="num">Share</th><th class="wrap-cell">Kinds inside it</th></tr></thead>
    <tbody>${c.codes.map((e) => `<tr>
      <td><a href="#code-${esc(e.code)}"><b>${esc(e.code)}</b></a></td>
      <td>${esc(e.desc)}</td>
      <td class="num">${n(e.total)}</td>
      <td class="num">${e.mlb ? n(e.mlb) : '<span class="muted">0</span>'}</td>
      <td class="num">${pct(e.mlb, e.total)}</td>
      <td class="wrap-cell muted">${e.families.length > 1 ? esc(e.families.map((f) => f.label).join(' · ')) : '<span class="muted">one kind</span>'}</td>
    </tr>`).join('')}</tbody>
  </table></div>
  <div class="jump">${c.codes.map((e) => `<a href="#code-${esc(e.code)}"><b>${esc(e.code)}</b> ${n(e.total)}</a>`).join('')}</div>
</section>

<section id="notice">
  <h2>Four things to know before designing anything</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th class="wrap-cell">What</th><th class="wrap-cell">Why it shapes the design</th></tr></thead>
    <tbody>
      <tr><td>1</td><td class="wrap-cell"><b>A type code is not a kind of move.</b> <code>SC</code> covers eleven different things — the injured list, the restricted list, paternity, bereavement, a development list, and a bare "roster status changed" that explains nothing.</td><td class="wrap-cell">The unit a feed shows is the kind, not the code. Every code below is broken into its kinds.</td></tr>
      <tr><td>2</td><td class="wrap-cell"><b>Some rows name no club at all.</b> "RHP Bryse Wilson elected free agency." "RHP Miles Mikolas suspended." "C Casey Opitz retired." The club exists only in the row's <code>toTeam</code> field, never in the sentence.</td><td class="wrap-cell">A league-wide feed cannot print these sentences as-is — there is nothing in them to say whose news this is.</td></tr>
      <tr><td>3</td><td class="wrap-cell"><b>Four codes mean nearly the same thing.</b> <code>ACQ</code>, <code>OBT</code>, <code>PUR</code> and <code>CP</code> all describe a player arriving from outside affiliated ball, in four different sentence shapes.</td><td class="wrap-cell">Group by meaning, not by code, or the same event type reads four ways.</td></tr>
      <tr><td>4</td><td class="wrap-cell"><b>Volume is wildly uneven.</b> Two codes are ${pct(c.codes[0].total + c.codes[1].total, c.totals.rows)} of the wire and almost none of it matters to a major-league club; number changes alone are ${n(c.codes.find((x) => x.code === 'NUM')?.total ?? 0)} rows, nearly all MLB.</td><td class="wrap-cell">Any feed needs a stated rule for what earns a slot, not a volume cap.</td></tr>
    </tbody>
  </table></div>
</section>

<section id="codes">
  <h2>Every code, with its five most recent</h2>
  <p class="lede">Each block holds the five newest rows for that code, then the five newest that touch an MLB club when those are different rows, then the same five-deep view of each kind inside the code. Open any row for the verbatim JSON and the records we can join to it.</p>
  <div class="controls">
    <button type="button" class="chip" id="mlbonly" aria-pressed="false">Hide rows with no MLB club</button>
    <button type="button" class="chip" id="expand" aria-pressed="false">Open every row</button>
  </div>
  <div id="codes"></div>
</section>

<section id="shape">
  <h2>What a row carries</h2>
  <p class="lede">Field presence measured across all ${n(c.totals.rows)} rows of the season, not taken from documentation — this endpoint publishes none.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Field</th><th class="num">Present</th><th class="num">Share</th><th class="wrap-cell">Notes</th></tr></thead>
    <tbody>${Object.entries(c.fieldCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr>
      <td><b>${esc(k)}</b></td><td class="num">${n(v)}</td><td class="num">${pct(v, c.totals.rows)}</td>
      <td class="wrap-cell muted">${esc({
        id: 'Not unique — every player in one trade shares an id, and repeats happen.',
        date: 'Filed date.',
        effectiveDate: 'When it takes effect. Differs from date on a small share of rows.',
        resolutionDate: 'Carries no date information — it equals effectiveDate on all 29,526 rows that have one, with no exception all season. Its PRESENCE is the signal: a row that moves a player between two clubs has none, a row where one club changes the status of a player it already holds always does. See below.',
        typeCode: 'The code in the table above.',
        typeDesc: "MLB's own words for the code.",
        description: 'The wire sentence, led by the acting club when there is one.',
        person: '{id, fullName, link}. Absent on a trade\u2019s second copy.',
        toTeam: '{id, name, link}. The receiving club, MLB or affiliate.',
        fromTeam: 'Only on moves with a losing side.',
      }[k] ?? '')}</td>
    </tr>`).join('')}
      <tr><td><b>team</b></td><td class="num"><span class="no">0</span></td><td class="num">0%</td><td class="wrap-cell muted">Never sent on this endpoint. Do not read it.</td></tr>
    </tbody>
  </table></div>

  <h3>What <code>resolutionDate</code> actually marks</h3>
  <p class="lede">Measured over the full season. The value itself is redundant, but which rows carry it is not random — it separates a player changing clubs from a club changing a player's status, and it does so without reading a word of the sentence.</p>
  <div class="tablewrap"><table>
    <thead><tr><th class="wrap-cell">Kind of row</th><th class="wrap-cell">Type codes</th><th class="num">Rows</th><th class="num">Carry it</th></tr></thead>
    <tbody>
      <tr><td class="wrap-cell"><b>One club, one player it already holds.</b> A status change, a release, a signing, a designation, a free-agency election, a retirement, a suspension, a number change.</td><td class="wrap-cell">SC, NUM, REL, SFA, SGN, DES, DFA, RET, SU</td><td class="num">17,077</td><td class="num"><span class="yes">17,045 — 99.8%</span></td></tr>
      <tr><td class="wrap-cell"><b>A player moves between two clubs.</b> An option, a recall, a trade, a selection, an outright, a waiver claim, an acquisition, a return, a loan, a purchase.</td><td class="wrap-cell">OPT, CU, TR, SE, OUT, CLW, ACQ, RTN, OBT, LON, CP, PUR</td><td class="num">2,891</td><td class="num"><span class="no">0%</span></td></tr>
      <tr><td class="wrap-cell"><b>An assignment</b> splits on exactly the same line: "assigned to Reading" with no origin club carries one; "assigned to Reading from Lehigh Valley" does not.</td><td class="wrap-cell">ASG, with an origin club</td><td class="num">6,653</td><td class="num"><span class="no">0.2%</span></td></tr>
      <tr><td class="wrap-cell">The same assignment with no origin club named</td><td class="wrap-cell">ASG, no origin club</td><td class="num">10,311</td><td class="num"><span class="yes">99.9%</span></td></tr>
      <tr><td class="wrap-cell"><b>A rehab assignment is the one deliberate exception.</b> It names both clubs, and still carries one — because the player never leaves the parent club's control, he is only playing somewhere else.</td><td class="wrap-cell">ASG, rehab</td><td class="num">2,164</td><td class="num"><span class="yes">99.9%</span></td></tr>
    </tbody>
  </table></div>
  <p class="lede">Practical value for a league-wide feed: <b>a row with no <code>resolutionDate</code> is a row two clubs can both see</b>, which is the entire surface on which a feed can print the same move twice. <code>fromTeam</code> answers almost the same question — the one thing this field adds is telling a rehab assignment apart from a real transfer without parsing the description.</p>
</section>

<p class="footnote">Regenerate: <code>node .scratch/home-transactions/type-census.mjs</code> then <code>node .scratch/home-transactions/build-census-page.mjs</code>. Nothing here passes through <code>src/api/teamTransactions.js</code> — it is the API's own output, grouped only by its own fields. Pulled ${c.generatedAt.slice(0, 10)}.</p>
</div>

<script type="application/json" id="data">${JSON.stringify(c).replace(/</g, '\\u003c')}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent)
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]))
const state = { mlbOnly: false, expand: false }
const ORG = new Set(Object.values(D.teams).filter((t) => t.isMlbClub).map((t) => t.id))
const touchesMlb = (t) => (t.fromTeam && ORG.has(t.fromTeam.id)) || (t.toTeam && ORG.has(t.toTeam.id))

function clubLine(side, label) {
  if (!side) return ''
  const t = D.teams[side.id]
  if (!t) return '<dt>' + label + '</dt><dd>' + esc(side.name) + ' · id ' + esc(side.id) + '</dd>'
  const bits = [esc(t.name), 'id ' + t.id]
  if (t.isMlbClub) bits.push('<b>MLB club</b>')
  else if (t.parentOrgName) bits.push(esc(t.level || 'affiliate') + ' of ' + esc(t.parentOrgName))
  else bits.push(t.known ? esc(t.level || 'affiliated club') + ', no parent org listed' : '<span class="no">not an affiliated club</span>')
  return '<dt>' + label + '</dt><dd>' + bits.join(' · ') + '</dd>'
}

function detail(t) {
  const p = t.person ? D.people[t.person.id] : null
  const person = p
    ? '<dl class="kv">' +
      '<dt>Name</dt><dd>' + esc(p.fullName) + ' · id ' + esc(t.person.id) + '</dd>' +
      '<dt>Position</dt><dd>' + esc(p.position || '—') + (p.positionName ? ' (' + esc(p.positionName) + ')' : '') + '</dd>' +
      '<dt>Bats / throws</dt><dd>' + esc(p.batSide || '—') + ' / ' + esc(p.pitchHand || '—') + '</dd>' +
      '<dt>Age</dt><dd>' + esc(p.age == null ? '—' : p.age) + ' · born ' + esc(p.birthDate || '—') + ' · ' + esc(p.birthPlace || '—') + '</dd>' +
      '<dt>MLB debut</dt><dd>' + (p.mlbDebutDate ? esc(p.mlbDebutDate) : '<span class="no">no major-league debut on file</span>') + '</dd>' +
      '<dt>Listed at</dt><dd>' + esc(p.height || '—') + ' · ' + esc(p.weight == null ? '—' : p.weight + ' lb') + ' · ' + (p.active ? 'active' : 'inactive') + '</dd>' +
      '<dt>Headshot</dt><dd><a href="https://midfield.mlbstatic.com/v1/people/' + esc(t.person.id) + '/spots/120" target="_blank" rel="noreferrer">midfield.mlbstatic.com/…/' + esc(t.person.id) + '</a></dd>' +
      '</dl>'
    : '<p class="ex__none">This row names no player.</p>'
  const clubs = clubLine(t.fromTeam, 'From') + clubLine(t.toTeam, 'To')
  return '<div class="detail">' +
    '<h4>Verbatim from the API</h4><pre>' + esc(JSON.stringify(t, null, 2)) + '</pre>' +
    '<h4>Player, joined</h4>' + person +
    '<h4>Clubs, joined</h4>' + (clubs ? '<dl class="kv">' + clubs + '</dl>' : '<p class="ex__none">This row names no club.</p>') +
    '</div>'
}

function example(t, famLabel) {
  const mlb = touchesMlb(t)
  return '<div class="ex">' +
    '<div class="ex__top">' +
      '<span class="ex__date">' + esc(t.effectiveDate || t.date) + '</span>' +
      (mlb ? '<span class="tag tag--mlb">MLB club</span>' : '<span class="tag tag--minor">affiliate only</span>') +
      (famLabel ? '<span class="tag tag--fam">' + esc(famLabel) + '</span>' : '') +
    '</div>' +
    '<p class="ex__desc">' + esc(t.description || '(no description sent)') + '</p>' +
    '<details' + (state.expand ? ' open' : '') + '><summary>Row data</summary>' + detail(t) + '</details>' +
    '</div>'
}

function list(rows, famLabel) {
  const shown = state.mlbOnly ? rows.filter(touchesMlb) : rows
  if (!shown.length) return '<p class="ex__none">No rows here name an MLB club.</p>'
  return shown.map((t) => example(t, famLabel)).join('')
}

const NOTES = {
  ASG: 'Almost all of this is a prospect moving between two affiliates, which no major-league roster feels. The MLB-touching share is nearly all rehab assignments.',
  SC: 'The busiest code and the least specific. Eleven different kinds sit inside it, and one of them explains nothing at all.',
  NUM: 'A uniform number change. Almost entirely major-league, and almost certainly not news — but it is the third-largest MLB-touching code on the wire, so it needs an explicit decision rather than an accident.',
  DFA: 'Despite the letters, this is a player electing free agency, not a designation for assignment. That is DES. The sentence never names a club.',
  DES: 'Designated for assignment. Every row touches an MLB club, because that is the only place a 40-man roster exists.',
  ACQ: 'A player bought out of an independent league. Same meaning as OBT, PUR and CP, in a fourth sentence shape.',
  OBT: 'Same event as ACQ, different verb and a shorter sentence. Nine rows all season.',
  PUR: 'One row all season. Same meaning again.',
  CP: 'One row all season, and the only one of these four that names no source club in the sentence.',
  RTN: 'A player coming back from somewhere he was lent or assigned. The sentence leads with the PLAYER, so there is no club name to strip off the front.',
  LON: 'A loan to a Mexican League club. No MLB club involved in any row this season.',
  SU: 'A suspension. The sentence names no club and gives no reason or length.',
  RET: 'A retirement. The sentence names no club.',
  TR: 'A trade. Logged once per player per side, so one deal produces several rows sharing an id — including a copy that names no player at all.',
  CLW: 'A waiver claim, and the only other code besides a trade that names two different MLB clubs. Written from the claiming club\\'s side.',
}

function render() {
  const host = document.getElementById('codes')
  host.innerHTML = D.codes.map((e) => {
    const sameFive = JSON.stringify(e.latest.map((t) => t.id)) === JSON.stringify(e.latestMlb.map((t) => t.id))
    const multi = e.families.length > 1
    return '<div class="code" id="code-' + esc(e.code) + '">' +
      '<div class="code__head">' +
        '<span class="code__id">' + esc(e.code) + '</span>' +
        '<span class="code__desc">' + esc(e.desc) + '</span>' +
        '<span class="code__stat"><b>' + e.total.toLocaleString('en-US') + '</b> rows</span>' +
        '<span class="code__stat"><b>' + e.mlb.toLocaleString('en-US') + '</b> touch an MLB club</span>' +
      '</div>' +
      '<div class="code__body">' +
        (NOTES[e.code] ? '<p class="code__note">' + NOTES[e.code] + '</p>' : '') +
        '<div class="grouplabel">Five most recent</div>' + list(e.latest, null) +
        (sameFive || !e.latestMlb.length ? '' :
          '<div class="grouplabel">Five most recent involving an MLB club</div>' + list(e.latestMlb, null)) +
        (multi ? '<div class="grouplabel">The kinds inside this code</div>' +
          e.families.map((f) =>
            '<details' + (state.expand ? ' open' : '') + '><summary>' + esc(f.label) + ' — ' + f.total.toLocaleString('en-US') + ' rows, ' + f.mlb.toLocaleString('en-US') + ' touching an MLB club</summary>' +
            list(f.latestMlb.length ? f.latestMlb : f.latest, f.label) + '</details>').join('')
          : '') +
      '</div></div>'
  }).join('')
}

for (const [id, key] of [['mlbonly', 'mlbOnly'], ['expand', 'expand']]) {
  document.getElementById(id).addEventListener('click', (ev) => {
    state[key] = !state[key]
    ev.currentTarget.setAttribute('aria-pressed', String(state[key]))
    render()
  })
}
render()
</script>
`

writeFileSync(join(here, 'census.html'), html)
console.log(`wrote census.html — ${(html.length / 1024).toFixed(0)} KB, ${c.codes.length} codes`)
