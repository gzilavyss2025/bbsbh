// Renders window.json (see pull-window.mjs) into report.html — a self-contained
// inspection page for the proposed home-page transaction log. No external
// requests: every byte of data is inlined, so the file opens from disk or
// publishes as an artifact unchanged.
//
// Run: node .scratch/home-transactions/build-report.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const w = JSON.parse(readFileSync(join(here, 'window.json'), 'utf8'))

// What the nightly precompute knows, so the report can say how stale a feed
// built on the static shards would be.
let shardGeneratedAt = null
try {
  shardGeneratedAt = JSON.parse(
    readFileSync(join(here, '..', '..', 'public', 'data', 'team-transactions', String(w.window.season), 'index.json'), 'utf8'),
  ).generatedAt
} catch { /* no shard on disk in this worktree */ }

// ---------------------------------------------------------------------------
// Reshape for the page: story -> its raw rows, and a row lookup by key.
// ---------------------------------------------------------------------------
const rowByKey = new Map(w.rows.map((r) => [r.key, r]))
const rowsByStory = new Map()
for (const r of w.rows) {
  for (const o of r.orgs) {
    if (!o.storyId) continue
    if (!rowsByStory.has(o.storyId)) rowsByStory.set(o.storyId, [])
    rowsByStory.get(o.storyId).push(r.key)
  }
}

const orgName = new Map(w.orgRuns.map((r) => [r.orgId, { name: r.orgName, abbr: r.orgAbbr }]))
const flagsByStory = new Map()
for (const f of w.flags) {
  if (!flagsByStory.has(f.storyId)) flagsByStory.set(f.storyId, [])
  flagsByStory.get(f.storyId).push(f)
}

// Feed items, each carrying every raw row that fed any of its copies.
const feed = w.feed.map((item) => {
  const keys = new Set()
  const flags = []
  for (const c of item.copies) {
    for (const k of rowsByStory.get(c.story.id) ?? []) keys.add(k)
    for (const f of flagsByStory.get(c.story.id) ?? []) flags.push({ ...f, orgAbbr: c.orgAbbr })
  }
  return {
    key: item.key,
    date: item.date,
    type: item.copies[0].story.type,
    typeLabel: item.copies[0].story.typeLabel,
    copies: item.copies.map((c) => ({
      orgId: c.orgId,
      orgAbbr: c.orgAbbr,
      text: c.story.cutline.map((s) => s.text).join(''),
      rail: c.story.rail.map((s) => ({ banner: s.banner, name: s.name, pos: s.pos, playerId: s.playerId, isMlb: s.isMlb })),
    })),
    rowKeys: [...keys],
    flags,
  }
})

// Only the rows the page can actually show: anything that reached a story, plus
// anything dropped that still touched an MLB club directly (the coverage gap).
const shownKeys = new Set()
for (const item of feed) for (const k of item.rowKeys) shownKeys.add(k)
const droppedShown = w.droppedMlbRows.map((d) => ({ key: d.key, orgId: d.orgId, reason: d.reason, raw: d.row }))
for (const d of droppedShown) shownKeys.add(d.key)

const rows = {}
for (const k of shownKeys) {
  const r = rowByKey.get(k)
  if (!r) continue
  rows[k] = {
    raw: r.raw,
    orgs: r.orgs.map((o) => ({
      orgId: o.orgId,
      abbr: orgName.get(o.orgId)?.abbr ?? '',
      directTouch: o.directTouch,
      collapsed: o.collapsedByDedupe,
      dropped: o.droppedByFilter,
      reason: o.dropReason,
      storyId: o.storyId,
    })),
  }
}

// Enrichment, trimmed to the people these rows name.
const people = {}
for (const k of shownKeys) {
  const pid = rowByKey.get(k)?.raw.person?.id
  if (pid != null && w.people[pid]) people[pid] = w.people[pid]
}
const teams = {}
for (const t of w.teams) teams[t.id] = t

// Drop-reason rollup, and the coverage-gap examples worth naming.
const dropRollup = new Map()
for (const d of droppedShown) {
  const k = `${d.raw.typeCode}|${d.reason}`
  if (!dropRollup.has(k)) dropRollup.set(k, { code: d.raw.typeCode, desc: d.raw.typeDesc, reason: d.reason, count: 0, sample: d.raw.description })
  dropRollup.get(k).count += 1
}

// Duplication split: rows in more than one org's story, and whether the two
// stories share a feed key (a key-based de-dupe would catch them) or not.
let exactDupRows = 0
let escapingDupRows = 0
const dupByCode = new Map()
const escapingExamples = []
for (const r of w.rows) {
  const withStory = r.orgs.filter((o) => o.storyId)
  if (withStory.length < 2) continue
  dupByCode.set(r.raw.typeCode, (dupByCode.get(r.raw.typeCode) ?? 0) + 1)
  const keys = new Set(withStory.map((o) => o.storyId.slice(String(o.orgId).length + 1)))
  if (keys.size === 1) exactDupRows += 1
  else {
    escapingDupRows += 1
    if (escapingExamples.length < 12) {
      escapingExamples.push({
        description: r.raw.description,
        typeCode: r.raw.typeCode,
        date: r.raw.date,
        copies: withStory.map((o) => {
          const item = feed.find((f) => f.copies.some((c) => c.story?.id === o.storyId)) // may miss; fall back below
          const copy = w.orgRuns
            .flatMap((run) => run.days.flatMap((d) => d.stories.map((s) => ({ run, s }))))
            .find((x) => x.s.id === o.storyId)
          return {
            abbr: orgName.get(o.orgId)?.abbr ?? String(o.orgId),
            label: copy?.s.typeLabel ?? '',
            text: copy ? copy.s.cutline.map((seg) => seg.text).join('') : '',
            _unused: item ? 1 : 0,
          }
        }),
      })
    }
  }
}

// A "last 48 hours" slice, the window the home card is actually proposed for.
const dates = [...new Set(feed.map((f) => f.date))].sort().reverse()
const last48 = dates.slice(0, 2)
const feed48 = feed.filter((f) => last48.includes(f.date))

const payload = {
  window: w.window,
  generatedAt: w.generatedAt,
  shardGeneratedAt,
  totals: {
    ...w.totals,
    exactDupRows,
    escapingDupRows,
    last48Items: feed48.length,
    last48Copies: feed48.reduce((n, f) => n + f.copies.length, 0),
    last48Dates: last48,
  },
  typeCodes: w.typeCodes,
  perDay: w.perDay,
  orgRuns: w.orgRuns.map((r) => ({ orgId: r.orgId, abbr: r.orgAbbr, name: r.orgName, ...r.counts })),
  dropRollup: [...dropRollup.values()].sort((a, b) => b.count - a.count),
  escapingExamples,
  feed,
  rows,
  dropped: droppedShown,
  people,
  teams,
  flags: w.flags.map((f) => ({ ...f, abbr: orgName.get(f.orgId)?.abbr ?? '' })),
}

// ---------------------------------------------------------------------------
// The page.
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const n = (v) => Number(v).toLocaleString('en-US')

const funnel = [
  { label: 'Rows in the API window', value: payload.totals.rawRows, note: 'every level, every affiliate' },
  { label: 'Claimed by an MLB org', value: payload.totals.rowsClaimedByAnOrg, note: 'the club or one of its affiliates' },
  { label: 'Survive the noise filter', value: payload.totals.rowsInAStory, note: 'roster moves worth telling' },
  { label: 'Club stories built', value: payload.totals.orgStories, note: 'grouped per club, per day' },
  { label: 'Distinct events', value: payload.totals.feedItemsUnique, note: 'after collapsing exact repeats' },
]

const html = `<title>Transaction wire — what a home-page log would show</title>
<style>
:root {
  --paper: #F3ECD8;
  --paper-raised: #FBF6E9;
  --paper-inset: #FFFDF6;
  --ink: #16222F;
  --ink-body: #1B2A3A;
  --ink-soft: #46525F;
  --graphite: #6B6558;
  --rule: #CBC1A7;
  --rule-soft: #E0D8C2;
  --amber: #8A5A1E;
  --amber-line: #B5824A;
  --amber-soft: #F4E7CE;
  --clay: #96382E;
  --clay-line: #B4453A;
  --clay-soft: #F5E1DC;
  --field: #2C6449;
  --field-line: #2F6E4F;
  --field-soft: #E1EDE3;
  --shadow: 0 1px 0 rgba(22,34,47,.06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #171C22;
    --paper-raised: #1E252C;
    --paper-inset: #232B33;
    --ink: #F0E7D2;
    --ink-body: #E2D9C4;
    --ink-soft: #B9B1A0;
    --graphite: #948C7C;
    --rule: #3A434C;
    --rule-soft: #2C343B;
    --amber: #E4B872;
    --amber-line: #A87E43;
    --amber-soft: #33291B;
    --clay: #E89184;
    --clay-line: #A34C40;
    --clay-soft: #35211E;
    --field: #86C79E;
    --field-line: #3D7B5A;
    --field-soft: #1C2A22;
    --shadow: 0 1px 0 rgba(0,0,0,.3);
  }
}
:root[data-theme="dark"] {
  --paper: #171C22;
  --paper-raised: #1E252C;
  --paper-inset: #232B33;
  --ink: #F0E7D2;
  --ink-body: #E2D9C4;
  --ink-soft: #B9B1A0;
  --graphite: #948C7C;
  --rule: #3A434C;
  --rule-soft: #2C343B;
  --amber: #E4B872;
  --amber-line: #A87E43;
  --amber-soft: #33291B;
  --clay: #E89184;
  --clay-line: #A34C40;
  --clay-soft: #35211E;
  --field: #86C79E;
  --field-line: #3D7B5A;
  --field-soft: #1C2A22;
  --shadow: 0 1px 0 rgba(0,0,0,.3);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink-body);
  font: 15px/1.55 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  -webkit-text-size-adjust: 100%;
}
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 18px 96px; }

/* ---- masthead ---- */
.mast { border-bottom: 3px double var(--rule); padding: 40px 0 18px; margin-bottom: 28px; }
.mast__eyebrow {
  font-size: 11px; letter-spacing: .22em; text-transform: uppercase;
  color: var(--amber); font-weight: 700; margin: 0 0 14px;
}
.mast h1 {
  font-size: clamp(26px, 5.4vw, 42px); line-height: 1.06; margin: 0 0 14px;
  color: var(--ink); font-weight: 700; letter-spacing: -.02em; text-wrap: balance;
}
.mast p { margin: 0 0 10px; max-width: 66ch; color: var(--ink-soft); font-size: 14px; }
.mast__meta {
  display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 16px;
  font-size: 12px; color: var(--graphite);
}
.mast__meta b { color: var(--ink-body); font-weight: 700; }

/* ---- section furniture ---- */
section { margin: 46px 0 0; scroll-margin-top: 62px; }
h2 {
  font-size: 12px; letter-spacing: .2em; text-transform: uppercase; font-weight: 700;
  color: var(--amber); margin: 0 0 4px; padding-bottom: 8px; border-bottom: 1px solid var(--rule);
}
h2 .h2num { color: var(--graphite); margin-right: 10px; }
.lede { margin: 14px 0 20px; max-width: 68ch; color: var(--ink-soft); font-size: 14px; }
h3 { font-size: 15px; margin: 26px 0 8px; color: var(--ink); font-weight: 700; }

/* ---- funnel ---- */
.funnel { display: grid; gap: 1px; background: var(--rule-soft); border: 1px solid var(--rule); }
@media (min-width: 760px) { .funnel { grid-template-columns: repeat(5, 1fr); } }
.fstep { background: var(--paper-raised); padding: 14px 14px 16px; }
.fstep__v { font-size: 28px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.fstep__l { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-soft); margin-top: 6px; }
.fstep__n { font-size: 11px; color: var(--graphite); margin-top: 3px; }
.fstep__track { height: 4px; background: var(--rule-soft); margin-top: 10px; }
.fstep__bar { height: 4px; background: var(--amber-line); }

/* ---- finding blocks ---- */
.finds { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.find {
  min-width: 0;
  background: var(--paper-raised); border: 1px solid var(--rule);
  border-left: 4px solid var(--clay-line); padding: 15px 16px; box-shadow: var(--shadow);
}
.find--warn { border-left-color: var(--amber-line); }
.find--ok { border-left-color: var(--field-line); }
.find__top { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin-bottom: 8px; }
.find__t {
  font-size: 15px; font-weight: 700; color: var(--ink); margin: 0;
  flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; text-wrap: balance;
}
.find p { margin: 8px 0 0; font-size: 13.5px; color: var(--ink-soft); }
.find p:first-of-type { margin-top: 0; }

.sev {
  font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700;
  padding: 3px 7px; border: 1px solid currentColor; white-space: nowrap;
}
.sev--bug { color: var(--clay); background: var(--clay-soft); }
.sev--dupe { color: var(--amber); background: var(--amber-soft); }
.sev--gap { color: var(--ink-soft); background: var(--paper-inset); }
.sev--ok { color: var(--field); background: var(--field-soft); }

/* ---- quoted feed prose ---- */
.quote {
  background: var(--paper-inset); border: 1px solid var(--rule-soft);
  padding: 10px 12px; margin: 10px 0 0; font-size: 13px; color: var(--ink-body);
  overflow-x: auto;
}
.quote__row { display: flex; gap: 10px; align-items: baseline; padding: 3px 0; }
.quote__row + .quote__row { border-top: 1px dotted var(--rule-soft); }
.quote__club {
  font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--amber);
  min-width: 42px; flex: none;
}
.quote__bad { color: var(--clay); }
.quote em { color: var(--graphite); font-style: normal; }

/* ---- tables ---- */
.tablewrap { overflow-x: auto; border: 1px solid var(--rule); background: var(--paper-raised); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 7px 12px; border-bottom: 1px solid var(--rule-soft); white-space: nowrap; }
th {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--graphite);
  font-weight: 700; background: var(--paper-inset); position: sticky; top: 0;
}
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.wrap-cell { white-space: normal; min-width: 260px; }
tr:last-child td { border-bottom: 0; }
.muted { color: var(--graphite); }
.no { color: var(--clay); font-weight: 700; }
.yes { color: var(--field); font-weight: 700; }

/* ---- filter bar ---- */
.filters {
  position: sticky; top: 0; z-index: 5; background: var(--paper);
  border-bottom: 1px solid var(--rule); padding: 10px 0;
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
}
.filters label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--graphite); }
select, input[type="search"] {
  font: inherit; font-size: 13px; padding: 5px 8px; background: var(--paper-inset);
  color: var(--ink-body); border: 1px solid var(--rule);
}
input[type="search"] { min-width: 180px; flex: 1 1 180px; }
.chip {
  font: inherit; font-size: 12px; padding: 5px 10px; cursor: pointer;
  background: var(--paper-inset); color: var(--ink-soft); border: 1px solid var(--rule);
}
.chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.count { font-size: 12px; color: var(--graphite); margin-left: auto; font-variant-numeric: tabular-nums; }

/* ---- feed items ---- */
.daybar {
  margin: 26px 0 8px; padding-bottom: 5px; border-bottom: 1px solid var(--rule);
  font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink);
  font-weight: 700; display: flex; justify-content: space-between; gap: 12px;
}
.daybar span { color: var(--graphite); font-weight: 400; letter-spacing: .04em; }
.item { min-width: 0; border-bottom: 1px solid var(--rule-soft); padding: 12px 0; }
.item__head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.item__text, .find p, .lede, .quote__row span { overflow-wrap: anywhere; }
.quote__row span { min-width: 0; }
.pill {
  font-size: 10px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700;
  padding: 2px 7px; border: 1px solid var(--rule); color: var(--ink-soft); background: var(--paper-inset);
}
.pill--trade { color: var(--field); border-color: var(--field-line); background: var(--field-soft); }
.pill--il { color: var(--clay); border-color: var(--clay-line); background: var(--clay-soft); }
.pill--dupe { color: var(--amber); border-color: var(--amber-line); background: var(--amber-soft); }
.pill--flag { color: var(--clay); border-color: var(--clay-line); background: var(--clay-soft); }
.item__text { margin: 8px 0 0; font-size: 14px; color: var(--ink-body); }
.item__rail { margin: 8px 0 0; font-size: 12px; color: var(--graphite); }
details { margin-top: 8px; }
summary {
  cursor: pointer; font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase;
  color: var(--amber); list-style: none;
}
summary::-webkit-details-marker { display: none; }
summary::before { content: "▸ "; }
details[open] > summary::before { content: "▾ "; }
summary:focus-visible { outline: 2px solid var(--amber-line); outline-offset: 2px; }
.detail { border-left: 2px solid var(--rule); margin: 10px 0 4px; padding: 2px 0 2px 14px; }
.detail h4 {
  font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--graphite);
  margin: 14px 0 6px; font-weight: 700;
}
.detail h4:first-child { margin-top: 4px; }
pre {
  margin: 0; padding: 10px 12px; background: var(--paper-inset); border: 1px solid var(--rule-soft);
  font-size: 12px; line-height: 1.5; overflow-x: auto; color: var(--ink-body); white-space: pre;
}
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; font-size: 12.5px; }
.kv dt { color: var(--graphite); }
.kv dd { margin: 0; color: var(--ink-body); }
.verdict { font-size: 12.5px; margin: 6px 0 0; }
.verdict b { color: var(--ink); }
a { color: var(--amber); }
a:focus-visible { outline: 2px solid var(--amber-line); outline-offset: 2px; }
.empty { padding: 28px 0; color: var(--graphite); font-size: 13px; }
.footnote { margin-top: 44px; padding-top: 14px; border-top: 1px solid var(--rule); font-size: 12px; color: var(--graphite); }
.footnote code { background: var(--paper-inset); padding: 1px 5px; border: 1px solid var(--rule-soft); }
</style>

<div class="wrap">
<header class="mast">
  <p class="mast__eyebrow">Tally · home-page transaction log · data study</p>
  <h1>Every MLB roster move the wire carried, and what our pipeline does with it</h1>
  <p>This is the last ${payload.window.days} days of the MLB Stats API transaction feed run through the exact pipeline the team page's Transactions card uses — the same de-dupe, noise filter, story grouping and prose builder, imported, not re-created. Every line the API sent is here, with what we can join to it and the verdict the pipeline reached.</p>
  <p>It exists to answer two questions before a home-page feed gets built: <b>where would the same move show up twice</b>, and <b>where would a move be described wrong</b>.</p>
  <div class="mast__meta">
    <span>Window <b>${payload.window.startDate}</b> → <b>${payload.window.endDate}</b></span>
    <span>Pulled <b>${payload.generatedAt.slice(0, 16).replace('T', ' ')}Z</b></span>
    <span>Source <b>statsapi.mlb.com/api/v1/transactions</b></span>
    <span>People resolved <b>${n(payload.totals.peopleResolved)}/${n(payload.totals.peopleRequested)}</b></span>
  </div>
</header>

<section id="funnel">
  <h2>The funnel</h2>
  <p class="lede">Most of the wire is minor-league housekeeping. Of ${n(payload.totals.rawRows)} rows in three weeks, ${n(payload.totals.rowsInAStory)} — about ${(payload.totals.rowsInAStory / payload.totals.rawRows * 100).toFixed(0)}% — describe a move an MLB club's roster actually felt.</p>
  <div class="funnel">
    ${funnel.map((f) => `<div class="fstep">
      <div class="fstep__v">${n(f.value)}</div>
      <div class="fstep__track"><div class="fstep__bar" style="width:${Math.max(2, (f.value / funnel[0].value) * 100).toFixed(1)}%"></div></div>
      <div class="fstep__l">${esc(f.label)}</div>
      <div class="fstep__n">${esc(f.note)}</div>
    </div>`).join('')}
  </div>
  <h3>A 48-hour card, sized</h3>
  <p class="lede">The two most recent days in this pull (${payload.totals.last48Dates.join(' and ')}) hold <b>${payload.totals.last48Items} distinct events</b> — ${payload.totals.last48Copies} club stories before duplicates are collapsed. That is the real size of the proposed card: a couple of dozen items, not a couple of hundred.</p>
  <div class="tablewrap">
    <table>
      <thead><tr><th>Day</th><th class="num">Distinct events</th><th class="num">Club stories</th><th class="num">Duplicated</th></tr></thead>
      <tbody>${payload.perDay.map((d) => `<tr><td>${d.date}</td><td class="num">${d.unique}</td><td class="num">${d.copies}</td><td class="num">${d.copies - d.unique > 0 ? `<span class="no">+${d.copies - d.unique}</span>` : '<span class="muted">0</span>'}</td></tr>`).join('')}</tbody>
    </table>
  </div>
</section>

<section id="findings">
  <h2>What would go wrong</h2>
  <p class="lede">Seven things to decide before this ships, and one that is already right. Each is measured against this window rather than guessed at, and every example below is verbatim — the rest of the evidence is in the browser that follows.</p>
  <div class="finds">

    <div class="find">
      <div class="find__top"><h3 class="find__t">A two-club move is logged by both clubs, so the feed shows it twice</h3><span class="sev sev--dupe">Duplication</span></div>
      <p>Of every row that reaches the feed, exactly two type codes name two <em>different</em> MLB clubs: <b>TR</b> (trade, 195 rows) and <b>CLW</b> (waiver claim, 18 rows). Every other code names one club and its own affiliates, and duplicates nothing. In this window ${n(payload.totals.rowsInMoreThanOneOrgStory)} rows land in two clubs' stories — ${[...dupByCode].sort((a, b) => b[1] - a[1]).map(([c, k]) => `${n(k)} ${c}`).join(', ')} — producing <b>${payload.totals.feedItemsDuplicated} duplicate pairs</b> out of ${payload.totals.feedItemsUnique} distinct events, or ${(payload.totals.feedItemsDuplicated / payload.totals.feedItemsUnique * 100).toFixed(0)}% of the feed.</p>
      <p>A trade's two copies are each <em>correct</em> from their own club's side, which is why they read as redundant rather than wrong. The fix is to pick one copy, not to repair either.</p>
    </div>

    <div class="find">
      <div class="find__top"><h3 class="find__t">${payload.totals.escapingDupRows} of those duplicates survive a naive de-dupe</h3><span class="sev sev--dupe">Duplication</span></div>
      <p>De-duplicating on the story's own identity catches ${n(exactDupRows)} of the ${n(payload.totals.rowsInMoreThanOneOrgStory)} two-club rows. The other ${n(escapingDupRows)} escape, because the two clubs <em>grouped the same move differently</em> — one club filed the claim as a solo roster move, the other folded it into a three-player shuffle. The two stories share no key, so a key-based de-dupe passes both through.</p>
      <p>This is the finding that decides the architecture: a home feed cannot be assembled by merging the 30 per-club files and de-duplicating on story id. It has to group league-wide, once, from the raw rows.</p>
      ${payload.escapingExamples.slice(0, 3).map((e) => `<div class="quote">
        <div class="quote__row"><span class="quote__club">wire</span><span><em>${esc(e.description)}</em></span></div>
        ${e.copies.map((c) => `<div class="quote__row"><span class="quote__club">${esc(c.abbr)}</span><span>${esc(c.text)}</span></div>`).join('')}
      </div>`).join('')}
    </div>

    <div class="find">
      <div class="find__top"><h3 class="find__t">The club that <em>lost</em> a waiver claim is described as making it</h3><span class="sev sev--bug">Reads wrong</span></div>
      <p>A claim's description is written from the claiming club's side: "Baltimore Orioles claimed C Yohel Pozo off waivers from St. Louis Cardinals." The prose builder strips whichever club name leads the sentence, which is right on the claiming club's page and wrong on the other one — the Cardinals' card ends up reading "Claimed C Yohel Pozo off waivers from St. Louis Cardinals."</p>
      <p>Trades avoid this because the trade builder writes its own lead from the club's own direction ("Acquired … from" versus "Traded … to"). Claims never got that treatment. <b>This is live on team pages today</b>, not just a home-feed risk — 18 rows in three weeks.</p>
      <div class="quote">
        <div class="quote__row"><span class="quote__club">wire</span><span><em>Seattle Mariners claimed RHP Nolan Kingham off waivers from Texas Rangers.</em></span></div>
        <div class="quote__row"><span class="quote__club">SEA</span><span>Claimed RHP Nolan Kingham off waivers from Texas Rangers.</span></div>
        <div class="quote__row"><span class="quote__club">TEX</span><span class="quote__bad">Claimed RHP Nolan Kingham off waivers from Texas Rangers. ← Texas lost him</span></div>
      </div>
    </div>

    <div class="find">
      <div class="find__top"><h3 class="find__t">One player appears twice inside a single story</h3><span class="sev sev--bug">Reads wrong</span></div>
      <p>Five stories in this window picture the same player twice and name him twice. Two causes, both real baseball:</p>
      <p><b>Designated, then released, same day.</b> The pair-up step only knows how to pair a departure with a free-agency election, so a DFA followed by a release stays two rows: "designated RHP Lance McCullers Jr. for assignment; released RHP Lance McCullers Jr."</p>
      <p><b>A trade whose 40-man clearing move names a player already in the trade.</b> Cleveland genuinely designated Juan Brito for assignment and traded him to Cincinnati on the same day, so the story reads "Acquired DH Nathaniel Lowe … for 2B Juan Brito and RHP Alejandro Rivera; designated 2B Juan Brito for assignment."</p>
    </div>

    <div class="find find--warn">
      <div class="find__top"><h3 class="find__t">A busy club's story runs to 400 characters</h3><span class="sev sev--gap">Presentation</span></div>
      <p>The shuffle grouper clusters every unpaired add and subtract on a day into one story, with no cap. Four stories here run past 320 characters; the longest is 413 — five clauses, five faces in the rail. That is readable on a club's own dense timeline and would dominate a home card.</p>
    </div>

    <div class="find find--warn">
      <div class="find__top"><h3 class="find__t">${n(payload.totals.droppedButTouchesMlbClub)} rows touch an MLB club and never appear</h3><span class="sev sev--gap">Coverage</span></div>
      <p>Most of that is deliberate and correct — rehab assignments belong to the rehab page, minor-league signings would bury everything else. Two slices are worth a decision before this ships:</p>
      <p><b>Independent-league acquisitions</b> (type code <code>ACQ</code>, 5 rows) are dropped only because the code isn't on the whitelist. "Cincinnati Reds acquired LHP Kent Emanuel from the High Point Rockers of the Atlantic League" is a real major-league signing story.</p>
      <p><b>Plain activations</b> (78 rows) read "Washington Nationals activated RHP Miles Mikolas" with no mention of an injured list, so the injured-list test doesn't match them and they fall through.</p>
      <div class="tablewrap" style="margin-top:12px">
        <table>
          <thead><tr><th>Code</th><th>Why it was dropped</th><th class="num">Rows</th><th class="wrap-cell">Example</th></tr></thead>
          <tbody>${payload.dropRollup.map((d) => `<tr><td><b>${esc(d.code)}</b> <span class="muted">${esc(d.desc)}</span></td><td>${esc(d.reason)}</td><td class="num">${d.count}</td><td class="wrap-cell muted">${esc((d.sample || '').slice(0, 120))}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="find find--warn">
      <div class="find__top"><h3 class="find__t">A precomputed feed is up to a day behind; the wire is not</h3><span class="sev sev--gap">Freshness</span></div>
      <p>The club files this pipeline writes are rebuilt once a night${shardGeneratedAt ? ` (this checkout's copy: <b>${esc(shardGeneratedAt.slice(0, 16).replace('T', ' '))}Z</b>)` : ''}. A "last 48 hours" card fed from them would carry today's moves only after the next run. Two other timing details matter at this window size: 74 rows in this pull carry an <code>effectiveDate</code> different from their <code>date</code>, and the pipeline keys on <code>effectiveDate</code>; and a claim logged late can arrive after the day it belongs to.</p>
    </div>

    <div class="find find--ok">
      <div class="find__top"><h3 class="find__t">Nothing is silently lost</h3><span class="sev sev--ok">Clean</span></div>
      <p>Every row that survives the filter is accounted for in a story — zero rows enter the grouper and vanish. Repeated wire entries are collapsing correctly too: ${n(payload.totals.rawRows - payload.totals.distinctIds)} rows in this pull repeat an id another row already used, and the de-dupe pass absorbs them.</p>
    </div>

  </div>
</section>

<section id="browser">
  <h2>Every event, and every line behind it</h2>
  <p class="lede">The full ${payload.window.days}-day feed as a home-page log would carry it, newest first. Open an event to see the verbatim API rows that built it, what each club's pipeline decided about each row, and everything we can join to it.</p>
  <div class="filters">
    <input type="search" id="q" placeholder="Search name, club, prose…" aria-label="Search the feed">
    <label for="ftype" class="sr">Type</label>
    <select id="ftype"><option value="">All types</option></select>
    <label for="forg" class="sr">Club</label>
    <select id="forg"><option value="">All clubs</option></select>
    <button type="button" class="chip" id="fdupe" aria-pressed="false">Duplicates only</button>
    <button type="button" class="chip" id="fflag" aria-pressed="false">Flagged only</button>
    <span class="count" id="count"></span>
  </div>
  <div id="feed"></div>
</section>

<section id="dropped">
  <h2>What the filter throws away</h2>
  <p class="lede">Rows that name an MLB club directly and still never reach the feed. Grouped above; listed here in full so a judgment call about any of them is made against the real text.</p>
  <div class="filters">
    <label for="dcode" class="sr">Code</label>
    <select id="dcode"><option value="">All codes</option></select>
    <input type="search" id="dq" placeholder="Search dropped rows…" aria-label="Search dropped rows">
    <span class="count" id="dcount"></span>
  </div>
  <div class="tablewrap"><table>
    <thead><tr><th>Date</th><th>Code</th><th>Club</th><th class="wrap-cell">Description</th><th class="wrap-cell">Why</th></tr></thead>
    <tbody id="droppedbody"></tbody>
  </table></div>
</section>

<section id="reference">
  <h2>The wire's own shape</h2>
  <p class="lede">What a transaction row contains, measured across all ${n(payload.totals.rawRows)} rows in the window rather than taken from documentation — the API publishes none.</p>

  <h3>Fields, and how often they arrive</h3>
  <div class="tablewrap"><table>
    <thead><tr><th>Field</th><th class="num">Present</th><th class="wrap-cell">What it is</th></tr></thead>
    <tbody>
      <tr><td><b>id</b></td><td class="num">100%</td><td class="wrap-cell">Wire id. <b>Not unique</b> — every player in a trade shares one, and repeats happen.</td></tr>
      <tr><td><b>date</b></td><td class="num">100%</td><td class="wrap-cell">Filed date.</td></tr>
      <tr><td><b>effectiveDate</b></td><td class="num">99.8%</td><td class="wrap-cell">When the move takes effect. The pipeline keys on this; 74 rows differ from <code>date</code>.</td></tr>
      <tr><td><b>resolutionDate</b></td><td class="num">71%</td><td class="wrap-cell">When it resolved. Unused today.</td></tr>
      <tr><td><b>typeCode</b> / <b>typeDesc</b></td><td class="num">100%</td><td class="wrap-cell">The move's kind — the table below.</td></tr>
      <tr><td><b>description</b></td><td class="num">99.8%</td><td class="wrap-cell">The wire's own sentence, always led by the acting club. All prose is built from this.</td></tr>
      <tr><td><b>person</b></td><td class="num">99.5%</td><td class="wrap-cell"><code>{id, fullName, link}</code>. A trade's mirror copy carries none.</td></tr>
      <tr><td><b>toTeam</b></td><td class="num">99.8%</td><td class="wrap-cell"><code>{id, name, link}</code> — the receiving club, MLB or affiliate.</td></tr>
      <tr><td><b>fromTeam</b></td><td class="num">33%</td><td class="wrap-cell">Only on moves that have a losing side.</td></tr>
      <tr><td><b>team</b></td><td class="num"><span class="no">0%</span></td><td class="wrap-cell">Documented elsewhere, never sent on this endpoint. Don't read it.</td></tr>
    </tbody>
  </table></div>

  <h3>Type codes in this window</h3>
  <div class="tablewrap"><table>
    <thead><tr><th>Code</th><th>Means</th><th class="num">Rows</th><th class="num">Reach the feed</th><th>On the whitelist</th></tr></thead>
    <tbody>${payload.typeCodes.map((t) => `<tr><td><b>${esc(t.code)}</b></td><td>${esc(t.desc)}</td><td class="num">${n(t.raw)}</td><td class="num">${n(t.kept)}</td><td>${t.whitelisted ? '<span class="yes">yes</span>' : '<span class="no">no</span>'}</td></tr>`).join('')}</tbody>
  </table></div>

  <h3>What we can join to a row</h3>
  <p class="lede">Everything below is resolved for real in this pull — it isn't a list of what's theoretically available. Player records come from one batched <code>/people</code> call; club records from the clubs and affiliates endpoints the generator already makes.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Joined from</th><th class="wrap-cell">Gives</th><th class="wrap-cell">Already used for</th></tr></thead>
    <tbody>
      <tr><td><b>person.id</b> → /people</td><td class="wrap-cell">Position and position name, bats/throws, age, height and weight, birth date and birthplace, MLB debut date, active flag. Resolved for ${n(payload.totals.peopleResolved)} of the ${n(payload.totals.peopleRequested)} people named in this window. <b>Current club does not come back</b> from the batched form of this call — it is always empty, so read the club off the row's own <code>toTeam</code> instead. Only 730 of ${n(payload.totals.peopleResolved)} carry an MLB debut date, which is what makes that field a usable filter.</td><td class="wrap-cell">The position in the prose, and the debut date deciding whether a signing is worth showing</td></tr>
      <tr><td><b>person.id</b> → headshot CDN</td><td class="wrap-cell">A portrait at any size, no lookup needed</td><td class="wrap-cell">The face rail on every story card</td></tr>
      <tr><td><b>person.id</b> → app route</td><td class="wrap-cell"><code>/player/{id}</code></td><td class="wrap-cell">Every name in the prose is a link</td></tr>
      <tr><td><b>team.id</b> → clubs + affiliates</td><td class="wrap-cell">Club name, abbreviation, level, and the parent org an affiliate belongs to</td><td class="wrap-cell">Bucketing an affiliate's row up to its MLB club; the club link in the prose</td></tr>
      <tr><td><b>team.id</b> → app identity data</td><td class="wrap-cell">Club colours, logo treatments, the knockout mark</td><td class="wrap-cell">Tinting a headshot; available and unused on the card itself</td></tr>
      <tr><td><b>description</b> → parsing</td><td class="wrap-cell">Position token, injured-list length, injury reason, trade return ("for cash", "for a player to be named later")</td><td class="wrap-cell">The banner over a face, the parenthetical after an injury</td></tr>
    </tbody>
  </table></div>
</section>

<section id="orgs">
  <h2>Per club, in this window</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Club</th><th class="num">Rows claimed</th><th class="num">After de-dupe</th><th class="num">After filter</th><th class="num">Days</th><th class="num">Stories</th></tr></thead>
    <tbody>${payload.orgRuns.slice().sort((a, b) => b.stories - a.stories).map((r) => `<tr><td><b>${esc(r.abbr)}</b> <span class="muted">${esc(r.name)}</span></td><td class="num">${n(r.bucketed)}</td><td class="num">${n(r.deduped)}</td><td class="num">${n(r.kept)}</td><td class="num">${r.days}</td><td class="num">${r.stories}</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<p class="footnote">Regenerate: <code>node .scratch/home-transactions/pull-window.mjs 21</code> then <code>node .scratch/home-transactions/build-report.mjs</code>. The pipeline functions are imported from <code>src/api/teamTransactions.js</code>, so this page and the app can never disagree about what a story is. Data pulled ${payload.generatedAt.slice(0, 10)}.</p>
</div>

<script type="application/json" id="data">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent)
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MON = ['January','February','March','April','May','June','July','August','September','October','November','December']
function dateline(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return WEEK[dt.getUTCDay()] + ', ' + MON[m - 1] + ' ' + d
}

// ---- filter controls ----
const types = [...new Set(D.feed.map((f) => f.typeLabel))].sort()
const ftype = document.getElementById('ftype')
for (const t of types) ftype.append(new Option(t, t))
const orgs = D.orgRuns.slice().sort((a, b) => a.abbr.localeCompare(b.abbr))
const forg = document.getElementById('forg')
for (const o of orgs) forg.append(new Option(o.abbr + ' — ' + o.name, String(o.orgId)))

const state = { q: '', type: '', org: '', dupe: false, flag: false }

function matches(f) {
  if (state.type && f.typeLabel !== state.type) return false
  if (state.org && !f.copies.some((c) => String(c.orgId) === state.org)) return false
  if (state.dupe && f.copies.length < 2) return false
  if (state.flag && !f.flags.length) return false
  if (state.q) {
    const hay = (f.copies.map((c) => c.orgAbbr + ' ' + c.text).join(' ') + ' ' +
      f.rowKeys.map((k) => (D.rows[k] ? D.rows[k].raw.description : '')).join(' ')).toLowerCase()
    if (!hay.includes(state.q)) return false
  }
  return true
}

function railLine(rail) {
  if (!rail.length) return ''
  return rail.map((s) => esc(s.banner) + ' · ' + esc(s.pos || '—') + ' ' + esc(s.name || '(no name)')).join('  |  ')
}

function rowBlock(key) {
  const r = D.rows[key]
  if (!r) return ''
  const p = r.raw.person ? D.people[r.raw.person.id] : null
  const from = r.raw.fromTeam ? D.teams[r.raw.fromTeam.id] : null
  const to = r.raw.toTeam ? D.teams[r.raw.toTeam.id] : null
  const verdicts = r.orgs.map((o) => {
    const what = o.storyId ? '<b>used in a story</b>' :
      o.dropped ? 'dropped — ' + esc(o.reason || '') :
      o.collapsed ? 'collapsed as a repeat' : 'kept, no story'
    return '<div class="verdict">' + esc(o.abbr || o.orgId) + (o.directTouch ? '' : ' <span class="muted">(via an affiliate)</span>') + ' → ' + what + '</div>'
  }).join('')
  const teamLine = (t, label) => t ? '<dt>' + label + '</dt><dd>' + esc(t.name) + ' · id ' + t.id + ' · ' + esc(t.level || 'level unknown') +
    (t.isMlbClub ? ' · <b>MLB club</b>' : (t.parentOrgName ? ' · affiliate of ' + esc(t.parentOrgName) : '')) + '</dd>' : ''
  const person = p ? '<dl class="kv">' +
    '<dt>Name</dt><dd>' + esc(p.fullName) + ' · id ' + esc(r.raw.person.id) + '</dd>' +
    '<dt>Position</dt><dd>' + esc(p.position || '—') + (p.positionName ? ' (' + esc(p.positionName) + ')' : '') + '</dd>' +
    '<dt>Bats / throws</dt><dd>' + esc(p.batSide || '—') + ' / ' + esc(p.pitchHand || '—') + '</dd>' +
    '<dt>Age</dt><dd>' + esc(p.age == null ? '—' : p.age) + ' · born ' + esc(p.birthDate || '—') + ' · ' + esc([p.birthCity, p.birthCountry].filter(Boolean).join(', ') || '—') + '</dd>' +
    '<dt>MLB debut</dt><dd>' + (p.mlbDebutDate ? esc(p.mlbDebutDate) : '<span class="no">never — a signing of this player is suppressed</span>') + '</dd>' +
    '<dt>Listed at</dt><dd>' + esc(p.height || '—') + ' · ' + esc(p.weight == null ? '—' : p.weight + ' lb') + ' · ' + (p.active ? 'active' : 'inactive') + '</dd>' +
    '<dt>Headshot</dt><dd><a href="' + esc(p.headshot) + '" target="_blank" rel="noreferrer">' + esc(p.headshot) + '</a></dd>' +
    '<dt>Player page</dt><dd><a href="https://tallybb.com/player/' + esc(r.raw.person.id) + '" target="_blank" rel="noreferrer">/player/' + esc(r.raw.person.id) + '</a></dd>' +
    '</dl>' : '<p class="muted">This row names no player — it is a trade\\'s second-perspective copy.</p>'
  return '<div class="detail">' +
    '<h4>Verbatim from the API</h4><pre>' + esc(JSON.stringify(r.raw, null, 2)) + '</pre>' +
    '<h4>What each club\\'s pipeline decided</h4>' + verdicts +
    '<h4>Joined player record</h4>' + person +
    '<h4>Joined clubs</h4><dl class="kv">' + teamLine(from, 'From') + teamLine(to, 'To') + '</dl>' +
    '</div>'
}

function render() {
  const host = document.getElementById('feed')
  host.textContent = ''
  const shown = D.feed.filter(matches)
  document.getElementById('count').textContent = shown.length + ' of ' + D.feed.length + ' events'
  if (!shown.length) { host.append(el('p', 'empty', 'Nothing matches those filters.')); return }
  let day = null
  for (const f of shown) {
    if (f.date !== day) {
      day = f.date
      const dayItems = shown.filter((x) => x.date === day)
      host.append(el('div', 'daybar', dateline(day) + ' <span>' + dayItems.length + ' event' + (dayItems.length === 1 ? '' : 's') + '</span>'))
    }
    const item = el('div', 'item')
    const pillClass = f.type === 'trade' ? 'pill pill--trade' : f.type === 'injured-list' ? 'pill pill--il' : 'pill'
    let head = '<span class="' + pillClass + '">' + esc(f.typeLabel) + '</span>'
    head += '<span class="pill">' + f.copies.map((c) => esc(c.orgAbbr)).join(' + ') + '</span>'
    if (f.copies.length > 1) head += '<span class="pill pill--dupe">' + f.copies.length + '× duplicate</span>'
    for (const fl of f.flags) head += '<span class="pill pill--flag">' + esc(fl.kind) + '</span>'
    item.append(el('div', 'item__head', head))
    for (const c of f.copies) {
      item.append(el('p', 'item__text', '<b>' + esc(c.orgAbbr) + '</b> — ' + esc(c.text)))
      if (c.rail.length) item.append(el('p', 'item__rail', railLine(c.rail)))
    }
    const det = el('details')
    det.append(el('summary', null, f.rowKeys.length + ' API row' + (f.rowKeys.length === 1 ? '' : 's') + ' behind this'))
    det.insertAdjacentHTML('beforeend', f.rowKeys.map(rowBlock).join(''))
    item.append(det)
    host.append(item)
  }
}

document.getElementById('q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); render() })
ftype.addEventListener('change', (e) => { state.type = e.target.value; render() })
forg.addEventListener('change', (e) => { state.org = e.target.value; render() })
for (const [id, keyName] of [['fdupe', 'dupe'], ['fflag', 'flag']]) {
  document.getElementById(id).addEventListener('click', (e) => {
    state[keyName] = !state[keyName]
    e.currentTarget.setAttribute('aria-pressed', String(state[keyName]))
    render()
  })
}
render()

// ---- dropped-row table ----
const dcode = document.getElementById('dcode')
for (const c of [...new Set(D.dropped.map((d) => d.raw.typeCode))].sort()) dcode.append(new Option(c, c))
const dstate = { code: '', q: '' }
function renderDropped() {
  const body = document.getElementById('droppedbody')
  const shown = D.dropped.filter((d) =>
    (!dstate.code || d.raw.typeCode === dstate.code) &&
    (!dstate.q || (d.raw.description || '').toLowerCase().includes(dstate.q)))
  document.getElementById('dcount').textContent = shown.length + ' of ' + D.dropped.length + ' rows'
  body.innerHTML = shown.slice(0, 700).map((d) => {
    const club = D.orgRuns.find((o) => o.orgId === d.orgId)
    return '<tr><td>' + esc(d.raw.date) + '</td><td><b>' + esc(d.raw.typeCode) + '</b></td><td>' + esc(club ? club.abbr : d.orgId) +
      '</td><td class="wrap-cell">' + esc(d.raw.description || '') + '</td><td class="wrap-cell muted">' + esc(d.reason || '') + '</td></tr>'
  }).join('') + (shown.length > 700 ? '<tr><td colspan="5" class="muted">Showing the first 700. Narrow with the filters above.</td></tr>' : '')
}
dcode.addEventListener('change', (e) => { dstate.code = e.target.value; renderDropped() })
document.getElementById('dq').addEventListener('input', (e) => { dstate.q = e.target.value.trim().toLowerCase(); renderDropped() })
renderDropped()
</script>
`

writeFileSync(join(here, 'report.html'), html)
console.log(`wrote report.html — ${(html.length / 1024 / 1024).toFixed(2)} MB, ${payload.feed.length} events, ${Object.keys(payload.rows).length} rows, ${Object.keys(payload.people).length} people`)
