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
    <button type="button" class="jumpbar__item is-current" aria-current="true">Standings <span class="jumpbar__count">4</span></button>
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
// ---- Report parts (ADR-0112). Club marks are monograms here: the project holds no logo files.
const mk = (ab) => `<span class="leaderrow__mark" style="display:grid;place-items:center;font-family:var(--font-display);font-size:var(--fs-label);letter-spacing:var(--ls-label)">${ab}</span>`
w('Report', 'StatBandAndStrip', page('Report', 'Stat Band And Strip',
`  .pv-stack { display: grid; gap: var(--space-6); }
  .pv-tiles { display: flex; flex-wrap: wrap; gap: var(--space-4); }`,
`<div class="pv-stack">
  <div class="card card--stamped statstrip">
    <div class="statcell"><span class="statcell__label">Clubs sampled</span><span class="statcell__value">30</span><span class="statcell__note">Regular season</span></div>
    <div class="statcell statcell--lead"><span class="statcell__label">Largest gate</span><span class="statcell__value">48,231</span><span class="statcell__note">Lead</span></div>
    <div class="statcell"><span class="statcell__label">Avg time of game</span><span class="statcell__value">2:41</span></div>
    <div class="statcell"><span class="statcell__label">Doubleheaders</span><span class="statcell__value">11</span></div>
  </div>
  <div class="pv-tiles">
    <div class="card card--stamped stattile stattile--band"><p class="stattile__label">League payroll</p><p class="stattile__value">$5.2B</p><p class="stattile__caption">30 clubs</p></div>
    <div class="card card--stamped stattile stattile--band stattile--lead"><p class="stattile__label">Top club</p><p class="stattile__value">$298M</p><p class="stattile__caption">Athletics</p></div>
    <div class="card card--stamped card--soft stattile stattile--compact"><p class="stattile__label">AVG</p><p class="stattile__value">.312</p></div>
  </div>
</div>
<p class="pv-note">Strip for three or four figures that read together; band for a figure that stands alone. One lead per row. Soft tone: the graphite offset shadow for a small tile.</p>`))

w('Report', 'LeaderList', page('Report', 'Leader List',
`  .pv-list { max-width: 440px; }`,
`<section class="card card--stamped card--named pv-list" aria-labelledby="l1">
  <h3 id="l1" class="card__name">Payroll leaders</h3>
  <span class="card__count">30 clubs</span>
  <ol class="leaders">
    <li class="leaderrow leaderrow--lead"><span class="pill pill--marker pill--figure pill--mark">1</span>${mk('ATH')}<div><div class="leaderrow__name">Athletics</div><span class="leaderrow__sub">AL West</span></div><div class="leaderrow__figure">$298M<span class="leaderrow__unit">payroll</span></div></li>
    <li class="leaderrow"><span class="pill pill--figure pill--mark">2</span>${mk('NYY')}<div><div class="leaderrow__name">Yankees</div><span class="leaderrow__sub">AL East</span></div><div class="leaderrow__figure">$281M<span class="leaderrow__unit">payroll</span></div></li>
    <li class="leaderrow leaderrow--mine"><span class="pill pill--figure pill--mark">3</span>${mk('MIL')}<div><div class="leaderrow__name">Brewers</div><span class="leaderrow__sub">NL Central · your club</span></div><div class="leaderrow__figure">$263M<span class="leaderrow__unit">payroll</span></div></li>
  </ol>
</section>
<p class="pv-note">Lead: field wash and a marker rank pill. Mine: an ink tint and an ink bar. The 36px mark slot takes a logo or a headshot.</p>`))

w('Report', 'ResultCard', page('Report', 'Result Card',
`  .pv-result { max-width: 440px; }`,
`<section class="card card--stamped card--soft result pv-result" aria-label="Sample final: Dodgers 5, Yankees 3">
  <div class="result__strip">
    <div class="result__club result__club--away" style="--result-tint: var(--accent-primary)"><span class="result__mark" style="display:grid;place-items:center;font-family:var(--font-display)">NYY</span><span class="result__runs">3</span></div>
    <div class="result__mid"><b class="result__status">Final</b><span class="result__note">Game 6</span></div>
    <div class="result__club result__club--home result__club--win"><span class="result__mark" style="display:grid;place-items:center;font-family:var(--font-display)">LAD</span><span class="result__runs">5</span></div>
  </div>
  <div class="result__bar"><span><b class="result__tag">WP</b>Sample Pitcher</span><span class="result__line">7.0 IP · 9 K</span></div>
  <div class="result__bar"><span><b class="result__tag">MVP</b>Sample Player</span><span class="result__line">2-for-4 · HR · 3 RBI</span></div>
  <div class="result__foot"><span>Sample data · Oct 28 · Sample Park</span><button type="button" class="btn btn--control">Box score</button></div>
</section>
<p class="pv-note">From the focus-mode scorebug. For a finished game on a history page only; a current score never goes in it.</p>`))

w('Report', 'MeterAndKey', page('Report', 'Meter And Key',
`  .pv-stack { display: grid; gap: var(--space-4); max-width: 440px; }`,
`<div class="pv-stack">
  <div class="meter" role="img" aria-label="Fresh 5, Ltd 2, Out 1">
    <div class="meter__seg meter__seg--good" style="--share:5">Fresh<span class="meter__figure">5</span></div>
    <div class="meter__seg meter__seg--caution" style="--share:2">Ltd<span class="meter__figure">2</span></div>
    <div class="meter__seg meter__seg--bad" style="--share:1">Out<span class="meter__figure">1</span></div>
  </div>
  <div class="meter" role="img" aria-label="FB 52%, SL 28%, OTH 20%">
    <div class="meter__seg meter__seg--good" style="--share:52">FB<span class="meter__figure">52%</span></div>
    <div class="meter__seg meter__seg--caution" style="--share:28">SL<span class="meter__figure">28%</span></div>
    <div class="meter__seg meter__seg--neutral meter__seg--ring" style="--share:20">OTH<span class="meter__figure">20%</span></div>
  </div>
  <ul class="key"><li class="key__item"><span class="key__swatch key__swatch--good"></span>Fresh</li><li class="key__item"><span class="key__swatch key__swatch--caution"></span>Limited</li><li class="key__item"><span class="key__swatch key__swatch--bad"></span>Down</li></ul>
  <ul class="key"><li class="key__item"><span class="pill pill--ink pill--mark">x</span>Clinched a postseason berth</li><li class="key__item"><span class="pill pill--mark" style="--pill-ink: var(--accent-negative)">e</span>Eliminated</li></ul>
</div>
<p class="pv-note">The player page's pitch mix bar as a shared part: 40px, a 2px ink edge, square, one segment per part as wide as its share.</p>`))

w('Report', 'PillMarks', page('Report', 'Pill Marks',
`  .pv-row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }`,
`<div class="pv-row">
  <span class="pill pill--marker pill--figure pill--mark">1</span>
  <span class="pill pill--figure pill--mark">12</span>
  <span class="pill pill--ink pill--figure pill--mark">7</span>
  <span class="pill pill--ink pill--mark">x</span>
  <span class="pill pill--mark" style="--pill-ink: var(--accent-positive)">y</span>
  <span class="pill pill--mark">CF</span>
  <span class="pill pill--ink">AAA</span>
  <span class="pill" style="--pill-ink: var(--accent-positive)">W5</span>
  <span class="pill" style="--pill-ink: var(--accent-negative)">L3</span>
</div>
<p class="pv-note">Square, like every pill and button. A mark holds one figure or one or two letters. Marker fill: the one pill in a row that leads.</p>`))

w('Report', 'ReportControls', page('Report', 'Report Controls',
`  .pv-stack { display: grid; gap: var(--space-4); max-width: 440px; }`,
`<div class="pv-stack">
  <div class="chips chips--rail" role="group" aria-label="Division">
    <button type="button" class="btn btn--control" aria-pressed="true">All <span class="chips__count">30</span></button>
    <button type="button" class="btn btn--control" aria-pressed="false">AL East <span class="chips__count">5</span></button>
    <button type="button" class="btn btn--control" aria-pressed="false">NL Central <span class="chips__count">5</span></button>
  </div>
  <button type="button" class="btn btn--block" aria-expanded="false"><span class="btn__icon" aria-hidden="true">›</span><span>More filters</span><span class="btn__hint">Level, age, ETA</span></button>
  <div class="stepper"><button type="button" class="btn btn--ghost stepper__btn" aria-label="Previous year">‹</button><span class="stepper__label">2025</span><button type="button" class="btn btn--ghost stepper__btn" aria-label="Next year" disabled>›</button></div>
  <button type="button" class="switch" role="switch" aria-checked="true"><span><span class="switch__label">Show headshots</span><span class="switch__hint">Turn off to save data</span></span><span class="switch__track" aria-hidden="true"><span class="switch__knob"></span></span></button>
</div>
<p class="pv-note">Selected: an ink fill and a marker underline, no checkmark. The switch is the one round shape.</p>`))
console.log('previews done')
