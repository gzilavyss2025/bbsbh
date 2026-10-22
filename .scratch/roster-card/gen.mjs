// Draws the four Roster-card directions (A, B, C, D) as static HTML.
//   node .scratch/roster-card/gen.mjs   (needs ../data.json beside it; see NOTES.md)
// Real markup: cardClassName, tableParts and segmentedMarkup come from src/lib/design.
// Real CSS: the pages link /src/index.css and the worldseries home sheet through the dev server.
import fs from 'node:fs'
import { createElement as h, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cardClassName } from '../../src/lib/design/cardClass.js'
import { tableParts } from '../../src/lib/design/tableClass.js'
import { segmentedMarkup } from '../../src/lib/design/segmentedClass.js'
import { teamLogoUrl, teamClubNameShort, headshotSources } from '../../src/lib/teams.js'

const here = new URL('.', import.meta.url).pathname
const DATA = JSON.parse(fs.readFileSync(here + 'data.json', 'utf8'))

// ---------- data ----------
const ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
const rank = (p) => (ORDER.indexOf(p) === -1 ? ORDER.length : ORDER.indexOf(p))
const groups = (club) => {
  const all = DATA[club]
  return {
    hitters: all.filter((p) => p.pos !== 'P').sort((a, b) => rank(a.pos) - rank(b.pos) || a.name.localeCompare(b.name)),
    pitchers: all.filter((p) => p.pos === 'P').sort((a, b) => a.name.localeCompare(b.name)),
  }
}
// Position groups (Gary): catchers, infielders, outfielders, DH and two-way, starters, relievers.
// A starter has a postseason start, or (no postseason line) most regular-season games as a starter.
const isStarter = (p) => {
  const po = p.s?.P?.pitching
  if (po) return po.gamesStarted > 0
  const rs = p.s?.R?.pitching
  return !!rs && rs.gamesStarted * 2 > rs.gamesPlayed
}
const sections = (club) => {
  const g = groups(club)
  const pos = (set) => g.hitters.filter((p) => set.includes(p.pos))
  const sp = g.pitchers.filter(isStarter)
  return {
    hg: [
      { key: 'c', title: 'Catchers', kind: 'h', players: pos(['C']), open: false },
      { key: 'inf', title: 'Infielders', kind: 'h', players: pos(['1B', '2B', '3B', 'SS']), open: true },
      { key: 'of', title: 'Outfielders', kind: 'h', players: pos(['LF', 'CF', 'RF']), open: false },
      { key: 'dh', title: 'DH and two-way', kind: 'h', players: pos(['DH', 'TWP']), open: false },
    ],
    pg: [
      { key: 'sp', title: 'Starting pitchers', kind: 'p', players: sp, open: true },
      { key: 'rp', title: 'Relievers', kind: 'p', players: g.pitchers.filter((p) => !sp.includes(p)), open: false },
    ],
  }
}
const ghead = (gr) => `<button type="button" class="btn btn--ghost rc-gbtn" aria-expanded="${gr.open}"><span>${gr.title}</span><b class="rc-num">${gr.players.length}</b><span class="rc-chev" aria-hidden="true">${gr.open ? '▴' : '▾'}</span></button>`
const find = (club, id) => DATA[club].find((p) => p.id === id)
const dash = (v) => (v == null || v === '' || /^[-.]+$/.test(String(v)) ? '—' : String(v))
const SETS = [
  { value: 'P', label: 'Postseason' },
  { value: 'R', label: 'Regular season' },
  { value: 'C', label: 'Career' },
]
const SETNAME = { P: 'Postseason so far', R: 'Regular season 2025', C: 'Career' }
const HIT = [['AVG', 'avg'], ['OBP', 'obp'], ['SLG', 'slg'], ['OPS', 'ops'], ['HR', 'homeRuns'], ['RBI', 'rbi']]
const HIT_MORE = [['G', 'gamesPlayed'], ['PA', 'plateAppearances'], ['H', 'hits'], ['2B', 'doubles'], ['BB', 'baseOnBalls'], ['SO', 'strikeOuts'], ['SB', 'stolenBases'], ['R', 'runs']]
const PIT = [['ERA', 'era'], ['WHIP', 'whip'], ['IP', 'inningsPitched'], ['SO', 'strikeOuts'], ['W-L', 'wl'], ['SV', 'saves']]
const PIT_MORE = [['G', 'gamesPlayed'], ['GS', 'gamesStarted'], ['H', 'hits'], ['ER', 'earnedRuns'], ['BB', 'baseOnBalls'], ['HR', 'homeRuns'], ['K/9', 'strikeoutsPer9Inn'], ['BAA', 'avg']]
const isP = (p) => p.pos === 'P'
const line = (p, set) => {
  const st = p.s?.[set]?.[isP(p) ? 'pitching' : 'hitting']
  return (key) => (key === 'wl' ? (st ? `${st.wins}-${st.losses}` : '—') : dash(st?.[key]))
}
const cols = (p) => (isP(p) ? PIT : HIT)
const more = (p) => (isP(p) ? PIT_MORE : HIT_MORE)

// ---------- markup helpers ----------
const card = ({ frame = 'stamped', label, count, className = '', body, as = 'section', flush = false, attrs = '' }) => {
  const named = label != null
  const cls = cardClassName({ frame, as, named, flush, className })
  return `<${as} class="${cls}" ${attrs}>${named ? `<h3 class="card__name">${label}</h3>` : ''}${count ? `<span class="card__count">${count}</span>` : ''}${flush ? body : `<div class="card__body">${body}</div>`}</${as}>`
}
const strip = (cells, className = '') =>
  `<div class="${cardClassName({ frame: 'stamped', as: 'div', className: `statstrip ${className}` })}">${cells
    .map(([label, value, lead]) => `<div class="statcell${lead ? ' statcell--lead' : ''}"><span class="statcell__label">${label}</span><span class="statcell__value">${value}</span></div>`)
    .join('')}</div>`
const seg = (opts) => renderToStaticMarkup(segmentedMarkup(h, opts))
const logo = (id, size = 24) => h('img', { src: teamLogoUrl(id), width: size, height: size, alt: '', className: 'rc-logo' })
const tabs = ({ at = 119, fill = true, short = false, count = true, className = '' }) =>
  seg({
    label: 'Club', fill, className, value: at, onChange: null,
    options: [119, 141].map((id) => ({
      value: id,
      label: h(Fragment, null, logo(id, 26), h('span', { className: 'rc-tab' }, short ? clubAbbr(id) : teamClubNameShort(id))),
      count: count ? 26 : undefined,
    })),
  })
const clubAbbr = (id) => ({ 119: 'LAD', 141: 'TOR' })[id]
const setToggle = (at = 'P', className = '', labels = SETS) =>
  seg({ label: 'Stat set', fill: true, className: `segmented--lean ${className}`, value: at, options: labels })
const door = (p, text = 'Player page') => `<a class="door door--inline" href="#player-${p.id}">${text} ›</a>`
const shot = (p, size = 36) => `<span class="rc-shot" style="--s:${size}px"><img src="${headshotSources(p.id, { mlb: true })[0]}" alt="" loading="eager"></span>`
const sr = (t) => `<span class="sr-only">${t}</span>`

// ---------- shared page + css ----------
const head = (title, extraCss) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/src/index.css">
<link rel="stylesheet" href="/src/styles/worldseries/home.css">
<style>
body{margin:0}
.mock{max-width:1272px;margin:0 auto;padding:var(--space-4)}
.rc-logo{display:block;flex:none;background:var(--paper-2);padding:var(--space-1);box-sizing:content-box;border-radius:var(--radius-xs)}
.rc-tab{font-family:var(--font-display);text-transform:uppercase;letter-spacing:var(--ls-label)}
.rc .segmented__btn{gap:var(--space-2)}
.rc .segmented__btn .segmented__count{color:inherit;opacity:.7}
.rc-shot{display:block;flex:none;width:var(--s);height:var(--s);overflow:hidden;background:var(--surface-inset);border:var(--bw-hair) solid var(--border-hairline)}
.rc-shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}
.rc-gbtn{display:flex;width:100%;justify-content:flex-start;gap:var(--space-2);padding:0 var(--space-1h);border-bottom:var(--bw-hair) solid var(--border-hairline);color:var(--text-heading)}
.rc-gbtn b{font-weight:var(--w-medium);color:var(--text-muted)}
.rc-gbtn .rc-chev{margin-left:auto}
.rc-gh{margin:0;font-family:var(--font-display);font-size:var(--fs-label);letter-spacing:var(--ls-xwide);text-transform:uppercase;color:var(--text-muted)}
.rc-gh b{font-family:var(--font-mono);font-weight:var(--w-medium);margin-left:var(--space-1h)}
.rc-note{margin:0;font-size:var(--fs-small);line-height:var(--lh-ui);color:var(--text-caption)}
.rc-num{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.rc-jersey{font-family:var(--font-mono);font-variant-numeric:tabular-nums;color:var(--text-muted);font-size:var(--fs-small);min-width:2.2ch;text-align:right}
.rc-pos{font-family:var(--font-display);text-transform:uppercase;letter-spacing:var(--ls-label);font-size:var(--fs-label);color:var(--text-muted)}
.rc-name{font-size:var(--fs-body);color:var(--text-heading)}
.rc .statstrip{grid-template-columns:repeat(3,minmax(0,1fr))}
.rc .statcell__value{font-size:var(--fs-title-lg)}
@media (max-width:480px){.rc .segmented--lean .segmented__btn{font-size:var(--fs-label);letter-spacing:var(--ls-none);padding:0 var(--space-1h)}}
@media (min-width:740px){.mock{padding:var(--space-6)} .rc .statstrip{grid-template-columns:repeat(6,minmax(0,1fr))} .rc .statcell__value{font-size:var(--fs-hero-sm)}}
${extraCss}
</style></head><body><main class="mock"><div class="ww-scout"><div class="ww-scout__card ww-scout__card--wide">`
const foot = `</div></div></main></body></html>`

// ============ A: INLINE EXPAND ============
function rowA(p, open, set) {
  const f = line(p, set)
  const lead = isP(p) ? 'ERA' : 'OPS'
  const panel = open
    ? `<div class="rc-a__panel" role="region" aria-label="${p.name} ${SETNAME[set]}">
        ${strip(cols(p).map(([l, k]) => [l, f(k), l === lead]))}
        <p class="rc-note rc-num">${more(p).map(([l, k]) => `${l} ${f(k)}`).join(' · ')}</p>
        ${door(p)}
      </div>` : ''
  return `<li class="rc-a__item${open ? ' is-open' : ''}"><button type="button" class="btn btn--ghost rc-row" aria-expanded="${open}">
      <span class="rc-jersey">${dash(p.jersey)}</span>${shot(p)}<span class="rc-name">${p.name}</span><span class="rc-pos">${p.pos}</span><span class="rc-chev" aria-hidden="true">${open ? '▴' : '▾'}</span>
    </button>${panel}</li>`
}
function pageA({ declared = true } = {}) {
  const g = groups(119)
  const open = new Set([518692, 808967])
  const sec = sections(119)
  const list = (gr) => `<section class="rc-a__group" aria-label="${gr.title}">${ghead(gr)}${gr.open ? `<ul class="rc-list">${gr.players.map((p) => rowA(p, open.has(p.id), 'P')).join('')}</ul>` : ''}</section>`
  const body = declared
    ? `<div class="rc-a__cols"><div class="rc-a__col">${sec.hg.map(list).join('')}</div><div class="rc-a__col">${sec.pg.map(list).join('')}</div></div>`
    : `<p class="rc-note rc-a__undeclared">The Dodgers have not named their Series roster yet. Clubs name 26 players by the morning of Game 1. This is their current roster.</p><div class="rc-a__cols"><div class="rc-a__col">${sec.hg.map(list).join('')}</div><div class="rc-a__col">${sec.pg.map(list).join('')}</div></div>`
  const inner = `<div class="stack stack--base rc">
    ${tabs({ at: 119 })}
    <div class="rc-a__bar">${setToggle('P')}</div>
    ${body}
  </div>`
  return head('Roster · A', `
.rc-a__bar{position:sticky;top:var(--space-1);z-index:var(--z-sticky)}
.rc-a__cols{display:grid;gap:var(--space-5);align-items:start}
@media (min-width:740px){.rc-a__cols{grid-template-columns:1fr 1fr;gap:var(--space-8)}}
.rc-a__col{display:flex;flex-direction:column;gap:var(--space-2)}
.rc-a__group{display:flex;flex-direction:column;gap:var(--space-2)}
.rc-list{list-style:none;margin:0;padding:0;border-top:var(--bw-hair) solid var(--border-hairline)}
.rc-a__item{border-bottom:var(--bw-hair) solid var(--border-hairline)}
.rc-row{display:grid;grid-template-columns:3ch 36px 1fr auto 2ch;gap:var(--space-3);width:100%;justify-content:stretch;text-align:left;text-transform:none;font-family:var(--font-body);letter-spacing:var(--ls-none);padding:0 var(--space-1h);min-height:var(--tap-min)}
.rc-chev{color:var(--text-muted);font-size:var(--fs-small);text-align:center}
.rc-a__item.is-open{background:var(--surface-row-selected)}
.rc-a__item.is-open .rc-row{box-shadow:inset 3px 0 0 var(--text-heading)}
.rc-a__panel{display:flex;flex-direction:column;gap:var(--space-2h);padding:var(--space-2) var(--space-1h) var(--space-3) calc(3ch + 36px + var(--space-3) * 2 + var(--space-1h))}
.rc-a__panel .door{align-self:flex-start}
.rc-a__panel .statcell__value{font-size:var(--fs-title-md)}
.rc-a__undeclared{padding:var(--space-3);background:var(--surface-inset);border-left:3px solid var(--border-stamped)}

`) + card({ label: 'Roster', count: 'Series · 26 a club', className: 'ww-roster rc-card', body: inner }) + foot
}

// ============ B: MASTER / DETAIL ============
function pageB({ view = 'detail' } = {}) {
  const g = groups(119)
  const sel = find(119, 518692)
  const f = line(sel, 'P')
  const li = (p) => `<li><button type="button" class="btn btn--ghost rc-row rc-b__row" ${p.id === sel.id ? 'aria-current="true"' : ''}>
      <span class="rc-jersey">${dash(p.jersey)}</span>${shot(p)}<span class="rc-name">${p.name}</span><span class="rc-pos">${p.pos}</span></button></li>`
  const sec = sections(119)
  const group = (gr) => `<li class="rc-b__grp">${ghead(gr)}${gr.open ? `<ul class="rc-list">${gr.players.map(li).join('')}</ul>` : ''}</li>`
  const listPane = `<nav class="rc-b__list" aria-label="Dodgers roster">
      <div class="rc-b__clubs">${tabs({ at: 119, short: true, count: false })}</div>
      <ul class="rc-b__scroll" style="list-style:none;margin:0;padding:0">${[...sec.hg, ...sec.pg].map(group).join('')}</ul>
    </nav>`
  const detail = `<article class="rc-b__detail" aria-label="${sel.name}">
      <button type="button" class="btn btn--ghost rc-b__back">‹ Roster</button>
      <header class="rc-b__who">
        ${shot(sel, 88)}
        <div><h4 class="rc-b__name">${sel.name}</h4><p class="rc-note rc-num">#${sel.jersey} · ${sel.pos} · Dodgers</p></div>
      </header>
      ${setToggle('P')}
      <p class="rc-gh">${SETNAME.P}</p>
      ${strip(cols(sel).map(([l, k]) => [l, f(k), l === 'OPS']))}
      <p class="rc-note rc-num">${more(sel).map(([l, k]) => `${l} ${f(k)}`).join(' · ')}</p>
      ${door(sel)}
    </article>`
  return head('Roster · B', `
.rc-b{display:grid;gap:var(--space-4)}
.rc-b__clubs{margin-bottom:var(--space-2)}
.rc-b__scroll>li+li{margin-top:var(--space-1)}
.rc-b__list{display:flex;flex-direction:column}
.rc-b__detail{display:flex;flex-direction:column;gap:var(--space-3);align-items:stretch}
.rc-b__detail>.door{align-self:flex-start}
.rc-b__who{display:flex;gap:var(--space-3);align-items:center}
.rc-b__name{margin:0;font-family:var(--font-display);font-size:var(--fs-title-lg);text-transform:uppercase;letter-spacing:var(--ls-title);color:var(--text-heading);line-height:var(--lh-tight)}
.rc-b__back{align-self:flex-start;padding-left:0}
.rc-row{display:grid;grid-template-columns:3ch 36px 1fr auto;gap:var(--space-3);width:100%;justify-content:stretch;text-align:left;text-transform:none;font-family:var(--font-body);letter-spacing:var(--ls-none);padding:0 var(--space-1h);min-height:var(--tap-min)}
.rc-list{list-style:none;margin:0;padding:0;border-top:var(--bw-hair) solid var(--border-hairline)}
.rc-b__row{border-bottom:var(--bw-hair) solid var(--border-hairline)}
.rc-b__row[aria-current=true]{background:var(--surface-row-selected);box-shadow:inset 3px 0 0 var(--text-heading)}
${view === 'list' ? '.rc-b__detail{display:none}' : '.rc-b__list{display:none}'}
@media (min-width:740px){
  .rc-b{grid-template-columns:minmax(260px,340px) 1fr;gap:0;align-items:start}
  .rc-b__list,.rc-b__detail{display:flex!important}
  .rc-b__scroll{max-height:480px;overflow:auto;padding-right:var(--space-2)}
  .rc-b__detail{padding-left:var(--space-6);border-left:var(--bw-rule) solid var(--border-rule);min-height:480px}
  .rc-b__back{display:none}
  .rc-b__name{font-size:var(--fs-hero-sm)}
}
`) + card({ label: 'Roster', count: 'Series · 26 a club', className: 'ww-roster rc-card', body: `<div class="rc rc-b">${listPane}${detail}</div>` }) + foot
}

// ============ C: TILES + SHEET ============
function pageC() {
  const g = groups(119)
  const sel = find(119, 605141)
  const f = line(sel, 'P')
  const tile = (p) => `<li><button type="button" class="btn rc-tile${p.id === sel.id ? ' is-on' : ''}" ${p.id === sel.id ? 'aria-current="true"' : ''}>
      ${shot(p, 64)}<span class="rc-tile__no">${dash(p.jersey)}</span><span class="rc-tile__name">${p.name}</span><span class="rc-pos">${p.pos}</span></button></li>`
  const sec = sections(119)
  const grp = (gr) => `<section aria-label="${gr.title}" class="rc-c__grp">${ghead(gr)}${gr.open ? `<ul class="rc-c__grid">${gr.players.map(tile).join('')}</ul>` : ''}</section>`
  const sheet = `<aside class="rc-c__sheet" role="dialog" aria-label="${sel.name}">
      <span class="rc-c__grab" aria-hidden="true"></span>
      <header class="rc-c__sh">
        ${shot(sel, 72)}<div style="flex:1"><h4 class="rc-b__name">${sel.name}</h4><p class="rc-note rc-num">#${sel.jersey} · ${sel.pos} · Dodgers</p></div>
        <button type="button" class="btn btn--ghost btn--icon" aria-label="Close">✕</button>
      </header>
      ${setToggle('P')}
      <p class="rc-gh">${SETNAME.P}</p>
      ${strip(cols(sel).map(([l, k]) => [l, f(k), l === 'OPS']))}
      <p class="rc-note rc-num">${more(sel).map(([l, k]) => `${l} ${f(k)}`).join(' · ')}</p>
      ${door(sel)}
    </aside>`
  const inner = `<div class="rc rc-c">
      <div class="stack stack--base rc-c__main">${tabs({ at: 119 })}${[...sec.hg, ...sec.pg].map(grp).join('')}</div>
      <div class="rc-c__scrim"></div>${sheet}
    </div>`
  return head('Roster · C', `
.rc-c{position:relative;height:880px;overflow:hidden}
.rc-c__main{opacity:1}
.rc-c__grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-2)}
.rc-c__grp{display:flex;flex-direction:column;gap:var(--space-2)}
.rc-tile{display:grid;grid-template-columns:auto 1fr;grid-template-areas:'shot shot' 'no pos' 'name name';justify-items:start;align-items:baseline;gap:var(--space-1) var(--space-2);width:100%;padding:var(--space-2);text-align:left;text-transform:none;letter-spacing:var(--ls-none)}
.rc-tile .rc-shot{grid-area:shot;justify-self:stretch;width:auto;height:auto;aspect-ratio:1/1}
.rc-tile__no{grid-area:no;font-family:var(--font-mono);font-size:var(--fs-title-lg);color:var(--text-heading);line-height:var(--lh-solid);font-variant-numeric:tabular-nums}
.rc-tile .rc-pos{grid-area:pos;justify-self:end}
.rc-tile__name{grid-area:name;font-family:var(--font-body);font-size:var(--fs-ui);color:var(--text-heading);text-align:left}
.rc-tile[aria-current=true]{box-shadow:inset 0 -4px 0 var(--marker);--btn-fill:var(--surface-stamped-tint);--btn-edge:var(--border-stamped)}
.rc-c__scrim{position:absolute;inset:0;background:color-mix(in srgb,var(--text-heading) 35%,transparent)}
.rc-c__sheet{position:absolute;left:calc(var(--space-4) * -1);right:calc(var(--space-4) * -1);bottom:calc(var(--space-4) * -1);display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-3) var(--space-4) var(--space-5);background:var(--surface-card);border-top:var(--bw-heavy) solid var(--border-stamped)}
.rc-c__sheet>.door{align-self:flex-start}
.rc-c__grab{align-self:center;width:44px;height:4px;background:var(--border-rule)}
.rc-c__sh{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-3)}
.rc-b__name{margin:0;font-family:var(--font-display);font-size:var(--fs-title-lg);text-transform:uppercase;letter-spacing:var(--ls-title);color:var(--text-heading);line-height:var(--lh-tight)}
@media (min-width:740px){
  .rc-c__grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
  .rc-c{height:auto;overflow:visible;min-height:760px}
  .rc-c__grab{display:none}
  .rc-c__sheet{left:auto;top:calc(var(--space-4) * -1);width:min(460px,52%);right:calc(var(--space-4) * -1);bottom:calc(var(--space-4) * -1);border-top:0;border-left:var(--bw-heavy) solid var(--border-stamped);padding:var(--space-5) var(--space-5);overflow:auto}
  .rc-c__sheet .statstrip{grid-template-columns:repeat(3,minmax(0,1fr))}
}
`) + card({ label: 'Roster', count: 'Series · 26 a club', className: 'ww-roster rc-card', body: inner }) + foot
}

// ============ D: STATS TABLE + DOCKED LINE ============
function pageD() {
  const g = groups(119)
  const sel = find(119, 518692)
  const sec = sections(119)
  const tbl = (gr) => {
    const title = gr.title, ps = gr.players, kind = gr.kind
    if (!gr.open) return `<section class="rc-d__grp" aria-label="${title}">${ghead(gr)}</section>`
    const cs = kind === 'h'
      ? [['G', 'gamesPlayed'], ['PA', 'plateAppearances'], ['AVG', 'avg'], ['OBP', 'obp'], ['SLG', 'slg'], ['OPS', 'ops'], ['HR', 'homeRuns'], ['RBI', 'rbi']]
      : [['G', 'gamesPlayed'], ['IP', 'inningsPitched'], ['ERA', 'era'], ['WHIP', 'whip'], ['SO', 'strikeOuts'], ['BB', 'baseOnBalls'], ['W-L', 'wl'], ['SV', 'saves']]
    const { wrap, grid, region } = tableParts({ frame: 'bare', density: 'row', sticky: true, label: `${title} stats`, className: 'rc-d__grid' })
    const reg = region ? ` role="${region.role}" tabindex="0" aria-label="${region['aria-label']}"` : ''
    const rows = ps.map((p) => {
      const f = line(p, 'P')
      return `<tr${p.id === sel.id ? ' aria-selected="true" class="is-on"' : ''}><th scope="row"><button type="button" class="btn btn--ghost rc-d__who"><span class="rc-jersey">${dash(p.jersey)}</span>${shot(p, 32)}<span class="rc-name">${p.name}</span><span class="rc-pos">${p.pos}</span></button></th>${cs.map(([, k]) => `<td class="rc-num">${f(k)}</td>`).join('')}</tr>`
    }).join('')
    return `<section class="rc-d__grp" aria-label="${title}">${ghead(gr)}<div class="${wrap}"${reg}><table class="${grid}"><thead><tr><th scope="col">Player</th>${cs.map(([l]) => `<th scope="col">${l}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>`
  }
  const f = line(sel, 'P')
  const dock = `<aside class="rc-d__dock" aria-label="${sel.name}, full line">
      <header class="rc-d__dh">
        ${shot(sel, 64)}<div style="flex:1"><h4 class="rc-b__name">${sel.name}</h4><p class="rc-note rc-num">#${sel.jersey} · ${sel.pos} · ${SETNAME.P} · full line</p></div>
        ${door(sel)}
      </header>
      ${strip(more(sel).map(([l, k]) => [l, f(k)]), 'rc-d__strip')}
    </aside>`
  const inner = `<div class="rc stack stack--base">
      ${tabs({ at: 119 })}
      ${setToggle('P')}
      ${[...sec.hg, ...sec.pg].map(tbl).join('')}
      ${dock}
    </div>`
  return head('Roster · D', `
.rc-d__grp{display:flex;flex-direction:column;gap:var(--space-2)}
.rc-d__grid th:first-child,.rc-d__grid td:first-child{min-width:168px;padding-left:0}
.rc-d__who .rc-jersey,.rc-d__who .rc-pos{display:none}
.rc-d__grid thead th:first-child{text-align:left}
.rc-d__grid td{text-align:right;color:var(--text-body)}
.rc-d__grid thead th:not(:first-child){text-align:right}
.rc-d__who{display:grid;grid-template-columns:32px 1fr;gap:var(--space-2h);width:100%;justify-content:stretch;text-align:left;text-transform:none;font-family:var(--font-body);letter-spacing:var(--ls-none);padding:0 var(--space-1h);min-height:var(--tap-min)}
.rc-d__grid tr.is-on{background:var(--surface-row-selected);--table-pin:var(--surface-row-selected)}
.rc-d__grid tr.is-on .rc-d__who{box-shadow:inset 3px 0 0 var(--text-heading)}
.rc-d__grid tr.is-on td{color:var(--text-heading)}
.rc-d__dock{display:flex;flex-direction:column;gap:var(--space-2h);padding:var(--space-3);background:var(--surface-stamped-tint);border:var(--bw-heavy) solid var(--border-stamped);box-shadow:var(--shadow-stamped)}
.rc-d__dh{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-3);flex-wrap:wrap}
.rc-b__name{margin:0;font-family:var(--font-display);font-size:var(--fs-title-lg);text-transform:uppercase;letter-spacing:var(--ls-title);color:var(--text-heading);line-height:var(--lh-tight)}
.rc .rc-d__strip{grid-template-columns:repeat(4,minmax(0,1fr))}
.rc .rc-d__strip .statcell__value{font-size:var(--fs-title-md)}
@media (min-width:740px){
  .rc-d__grid th:first-child,.rc-d__grid td:first-child{min-width:250px}
  .rc-d__who{grid-template-columns:3ch 32px 1fr auto}
  .rc-d__who .rc-jersey,.rc-d__who .rc-pos{display:block}
  .rc .rc-d__strip{grid-template-columns:repeat(8,minmax(0,1fr))}
}
`) + card({ label: 'Roster', count: 'Series · 26 a club', className: 'ww-roster rc-card', body: inner }) + foot
}

fs.writeFileSync(here + 'A.html', pageA())
fs.writeFileSync(here + 'A-undeclared.html', pageA({ declared: false }))
fs.writeFileSync(here + 'B.html', pageB())
fs.writeFileSync(here + 'B-list.html', pageB({ view: 'list' }))
fs.writeFileSync(here + 'C.html', pageC())
fs.writeFileSync(here + 'D.html', pageD())
console.log('written')
