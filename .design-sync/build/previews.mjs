import fs from 'node:fs'
const OUT = (process.env.DS_OUT || 'ds-bundle') + '/components/'
function page(group, title, css, body) {
  return `<!-- @dsCard group="${group}" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../../../styles.css">
<style>
  /* Preview layout only. Every part below takes its look from styles.css. */
  .pv { padding: var(--space-8) var(--space-4) var(--space-4); }
  .pv h2, .pv h3, .pv p, .pv dl, .pv dd { margin: 0; }
  .pv .pv-note { margin-top: var(--space-4); color: var(--text-caption); font-family: var(--font-mono); font-size: var(--fs-cell); }
${css}
</style>
</head>
<body>
<div id="root" class="pv">
${body}
</div>
</body>
</html>
`
}
const w = (group, name, html) => {
  fs.mkdirSync(`${OUT}${group}/${name}`, { recursive: true })
  fs.writeFileSync(`${OUT}${group}/${name}/${name}.html`, html)
}

// ---- Stamped Card
w('Frames', 'StampedCard', page('Frames', 'Stamped Card',
`  .pv-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-8) var(--space-6); }`,
`<div class="pv-row">
  <section class="card card--stamped card--named card--stamp-in" aria-labelledby="c1">
    <h2 id="c1" class="card__name">Standing</h2>
    <span class="card__count">3 cards</span>
    <div class="card__body"><p>Plain tone. Card paper, a 2px ink edge, a hard 4px offset shadow. The name tab is the card heading.</p></div>
  </section>
  <section class="card card--stamped card--tint card--named card--stamp-in" style="--stamp-delay:55ms" aria-labelledby="c2">
    <h2 id="c2" class="card__name">Last 10</h2>
    <span class="card__count">8-2</span>
    <div class="card__body"><p>Tint tone. The field-wash fill under ink text.</p></div>
  </section>
  <section class="card card--stamped card--ink card--named card--stamp-in" style="--stamp-delay:110ms" aria-labelledby="c3">
    <h2 id="c3" class="card__name">Lead</h2>
    <span class="card__count">1 of 1</span>
    <div class="card__body"><p>Ink tone. The shadow turns graphite so it still shows on ink.</p></div>
  </section>
</div>
<p class="pv-note">Square corners. The name tab hangs --space-3h above the card, so leave room above it.</p>`))

// ---- Stat Tile
w('Frames', 'StatTile', page('Frames', 'Stat Tile',
`  .pv-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-4); }
  .pv-note .rankmark { margin: 0; }
  .pv-compact { grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); }`,
`<div class="pv-tiles">
  <div class="card card--stamped card--ink stattile card--stamp-in"><p class="stattile__label">W-L · 2026</p><p class="stattile__value">103-59</p><p class="stattile__caption">.636 PCT</p></div>
  <div class="card card--stamped card--tint stattile card--stamp-in" style="--stamp-delay:55ms"><p class="stattile__label">Run diff</p><p class="stattile__value">+214</p><p class="stattile__caption">Season</p></div>
  <div class="card card--stamped stattile card--stamp-in" style="--stamp-delay:110ms"><p class="stattile__label">Last 10</p><p class="stattile__value">8-2</p><p class="stattile__caption">Streak W5</p></div>
  <div class="card card--stamped stattile card--stamp-in" style="--stamp-delay:165ms"><p class="stattile__label">Season grade</p><p class="stattile__value">9.5</p><p class="stattile__caption">Making it look easy</p></div>
</div>
<p class="pv-note">Compact (stattile--compact, about 40% smaller):</p>
<div class="pv-tiles pv-compact">
  <div class="card card--stamped card--ink stattile stattile--compact"><p class="stattile__label">W-L · 2026</p><p class="stattile__value">103-59</p><p class="stattile__caption">.636 PCT</p></div>
  <div class="card card--stamped card--tint stattile stattile--compact"><p class="stattile__label">Run diff</p><p class="stattile__value">+214</p><p class="stattile__caption">Season</p></div>
  <div class="card card--stamped stattile stattile--compact"><p class="stattile__label">Last 10</p><p class="stattile__value">8-2</p><p class="stattile__caption">Streak W5</p></div>
  <div class="card card--stamped stattile stattile--compact"><p class="stattile__label">Season grade</p><p class="stattile__value">9.5</p><p class="stattile__caption">Making it look easy</p></div>
</div>
<p class="pv-note">The lead tile is ink, the second is tint, the rest are plain. Rank format, on its own line, no "#": <span class="rankmark">78 of 89</span></p>`))

// ---- Fact Strip
w('Frames', 'FactStrip', page('Frames', 'Fact Strip',
``,
`<section class="card card--stamped card--named" aria-labelledby="f1">
  <h2 id="f1" class="card__name">Milwaukee Brewers</h2>
  <span class="card__count">2026</span>
  <div class="card__body"><p class="pv-note" style="margin:0">Hero row sits here: name, club, record.</p></div>
  <dl class="factgrid factgrid--strip">
    <div class="fact"><dt class="fact__label">Record</dt><dd class="fact__value">103-59</dd></div>
    <div class="fact"><dt class="fact__label">Pct</dt><dd class="fact__value">.636</dd></div>
    <div class="fact"><dt class="fact__label">Division</dt><dd class="fact__value">1st NL Central</dd></div>
    <div class="fact"><dt class="fact__label">Run diff</dt><dd class="fact__value">+214</dd></div>
    <div class="fact"><dt class="fact__label">Last 10</dt><dd class="fact__value">8-2</dd></div>
    <div class="fact"><dt class="fact__label">Streak</dt><dd class="fact__value">W5</dd></div>
  </dl>
</section>
<p class="pv-note">Three columns on a phone, six from 740px, on a hairline under an ink rule.</p>`))

// ---- Jump Bar
w('Navigation', 'JumpBar', page('Navigation', 'Jump Bar',
`  .pv { padding-top: 0; }
  .pv-sticky { position: sticky; top: 0; z-index: var(--z-sticky); }`,
`<nav class="jumpbar pv-sticky" aria-label="Team page sections">
  <div class="cluster cluster--snug jumpbar__row">
    <button type="button" class="jumpbar__item is-current" aria-current="true">Standing <span class="jumpbar__count">4</span></button>
    <button type="button" class="jumpbar__item">Ranks <span class="jumpbar__count">6</span></button>
    <button type="button" class="jumpbar__item">Games <span class="jumpbar__count">12</span></button>
    <button type="button" class="jumpbar__item">Roster <span class="jumpbar__count">3</span></button>
    <button type="button" class="jumpbar__item">Farm <span class="jumpbar__count">5</span></button>
    <button type="button" class="jumpbar__item">Money <span class="jumpbar__count">2</span></button>
    <button type="button" class="jumpbar__item">About <span class="jumpbar__count">4</span></button>
  </div>
</nav>
<p class="pv-note">Counts are sample numbers. The current item is ink with an accent-tint badge. Under 740px the bar scrolls sideways; from 740px it wraps inside a stamped box. It is sticky on the page.</p>`))

// ---- Section Head
w('Headings', 'SectionHead', page('Headings', 'Section Head',
`  .pv-row { margin-bottom: var(--space-4); }`,
`<div class="pv-row"><div class="sectionhead sectionhead--label"><h3 class="sectionhead__title">Standing</h3><em class="sectionhead__note">1st NL Central</em></div></div>
<div class="pv-row"><div class="sectionhead sectionhead--rule"><h3 class="sectionhead__title">Last 10</h3><em class="sectionhead__note">8-2</em></div></div>
<div class="pv-row"><div class="sectionhead sectionhead--band sectionhead--house"><h3 class="sectionhead__title">Run differential</h3><em class="sectionhead__note">+214</em></div></div>
<p class="pv-note">Label: graphite caps on a hairline. Rule: the label, then a pencil leader to the note. House band: navy with a pencil rule. Every band carries the ripple rings and sheen. A club colour may fill only a band that names the club (ADR-0030).</p>`))

// ---- Table
w('Data', 'Table', page('Data', 'Table',
``,
`<section class="card card--stamped card--named" style="padding-top: var(--space-4)" aria-labelledby="t1">
  <h2 id="t1" class="card__name">Record</h2>
  <div class="table table--bare table--row table--sticky" role="region" tabindex="0" aria-label="Brewers record splits">
    <table class="table__grid">
      <thead><tr><th scope="col">Split</th><th scope="col">W-L</th><th scope="col">PCT</th><th scope="col">Streak</th></tr></thead>
      <tbody>
        <tr><th scope="row">Season</th><td>103-59</td><td>.636</td><td>W5</td></tr>
        <tr><th scope="row">Last 10</th><td>8-2</td><td>.800</td><td>—</td></tr>
      </tbody>
    </table>
  </div>
</section>
<p class="pv-note">A table sits flush in a stamped card. Mono figures, condensed heads, a hairline above each row, a pinned first column.</p>`))
console.log('previews done')
