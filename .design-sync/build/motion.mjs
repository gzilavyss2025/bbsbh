import fs from 'node:fs'
const dir = (process.env.DS_OUT || 'ds-bundle') + '/components/Motion/Motion'
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(`${dir}/Motion.html`, `<!-- @dsCard group="Motion" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motion</title>
<link rel="stylesheet" href="../../../styles.css">
<style>
  /* Preview layout only. The motion comes from styles.css. */
  .pv { padding: var(--space-8) var(--space-4) var(--space-4); }
  .pv h2, .pv h3, .pv p { margin: 0; }
  .pv-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-4); margin: var(--space-4) 0 var(--space-6); }
  .pv-rows { display: grid; gap: var(--space-2); margin: var(--space-4) 0 var(--space-6); }
  .pv-row { padding: var(--space-2h) var(--space-3); border: var(--bw-hair) solid var(--border-rule); background: var(--surface-card); font-family: var(--font-mono); font-size: var(--fs-small); }
  .pv .pv-note { color: var(--text-caption); font-family: var(--font-mono); font-size: var(--fs-cell); margin-top: var(--space-4); }
  .pv-bar { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
  /* The arrival card. The app gets these from its pitching-change styles (12-sealbox.css), which the project does not ship:
     the event card's room for its name tab, and the head row. */
  .pv-arrive { display: flex; flex-direction: column; gap: var(--space-2h); max-width: 390px; margin: var(--space-8) 0 var(--space-6); }
  .pv-arrive > .change { padding: calc(var(--space-6) + var(--space-1)) var(--space-4) var(--space-4); display: flex; align-items: center; gap: var(--space-3); }
  .pv-arrive .pv-who { display: grid; gap: var(--space-1); margin: 0; font-family: var(--font-mono); font-size: var(--fs-small); }
  .pv-arrive .pv-who b { font-family: var(--font-display); font-size: var(--fs-card-name); text-transform: uppercase; color: var(--text-heading); }
  .pv-arrive .pv-line { padding: 0 var(--space-4) var(--space-4); }
</style>
</head>
<body>
<div id="root" class="pv">
  <div class="pv-bar">
    <button type="button" class="jumpbar__item" id="replay">Replay</button>
    <span class="pv-note" style="margin:0">Press the button, or hold it down to see the 2px press.</span>
  </div>
  <p class="pv-note">Stamp-in: a card drops 4px into its shadow, 380ms on the stamp curve. Stagger with --stamp-delay.</p>
  <div class="pv-tiles" id="stamps">
    <div class="card card--stamped card--ink stattile card--stamp-in"><p class="stattile__label">W-L</p><p class="stattile__value">103-59</p><p class="stattile__caption">.636 PCT</p></div>
    <div class="card card--stamped card--tint stattile card--stamp-in" style="--stamp-delay:55ms"><p class="stattile__label">Run diff</p><p class="stattile__value">+214</p><p class="stattile__caption">Season</p></div>
    <div class="card card--stamped stattile card--stamp-in" style="--stamp-delay:110ms"><p class="stattile__label">Last 10</p><p class="stattile__value">8-2</p><p class="stattile__caption">Streak W5</p></div>
  </div>
  <p class="pv-note">Rise: a block comes up 6px as it fades in, 420ms, one row every 55ms (--rise-i).</p>
  <div class="pv-rows" id="rises">
    <div class="pv-row player-rise" style="--rise-i:0">Standing</div>
    <div class="pv-row player-rise" style="--rise-i:1">Ranks</div>
    <div class="pv-row player-rise" style="--rise-i:2">Games</div>
    <div class="pv-row player-rise" style="--rise-i:3">Roster</div>
  </div>
  <div class="pv-bar">
    <button type="button" class="jumpbar__item" id="replay-arrival">Replay arrival</button>
    <span class="pv-note" style="margin:0">Arrival: a plain yellow card, then its data lands.</span>
  </div>
  <p class="pv-note">Left: a club band (--bar-fill, --bar-accent, --bar-text). Right: no club, so the house navy. The tab fades, the band wipes across in 380ms, the head grows, and the line unfolds 380ms in.</p>
  <div class="pv-arrive card card--stamped card--event arrival" id="arrive-club" style="--bar-fill:#005A9C; --bar-accent:#A5ACAF; --bar-text:#FFFFFF">
    <div class="cardband sectionhead--band" aria-hidden="true"><span class="cardband__label">Now pitching</span></div>
    <div class="change">
      <p class="card__name">Now pitching</p>
      <p class="pv-who"><b>Phillips, E.</b><span>Right-handed · #36</span></p>
    </div>
    <div class="unfold" style="--unfold-delay:380ms"><div class="unfold__in"><div class="pv-line"><span class="pv-note" style="margin:0">Season 2.84 ERA · 31 SO · 9 BB</span></div></div></div>
  </div>
  <div class="pv-arrive card card--stamped card--event arrival" id="arrive-house">
    <div class="cardband sectionhead--band sectionhead--house" aria-hidden="true"><span class="cardband__label">Departing</span></div>
    <div class="change">
      <p class="card__name">Departing</p>
      <p class="pv-who"><b>Millard, K.</b><span>Left-handed · #51</span></p>
    </div>
    <div class="unfold" style="--unfold-delay:380ms"><div class="unfold__in"><div class="pv-line"><span class="pv-note" style="margin:0">1.1 IP · 22 P · 2 ER</span></div></div></div>
  </div>
  <div class="table table--bare table--row" role="region" tabindex="0" aria-label="Motion tokens">
    <table class="table__grid">
      <thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col">Use</th></tr></thead>
      <tbody>
        <tr><th scope="row">dur-stamp-in</th><td>380ms</td><td>Stamp-in, on ease-stamp</td></tr>
        <tr><th scope="row">dur-rise</th><td>420ms</td><td>A card or row comes up</td></tr>
        <tr><th scope="row">stagger-step</th><td>55ms</td><td>Row n waits n steps</td></tr>
        <tr><th scope="row">dur-grow</th><td>750ms</td><td>A bar fills to its value</td></tr>
        <tr><th scope="row">dur-draw</th><td>900ms</td><td>A line inks itself</td></tr>
        <tr><th scope="row">dur-unfold</th><td>400ms</td><td>A menu or panel opens, on ease-unfold</td></tr>
        <tr><th scope="row">dur-fast</th><td>120ms</td><td>Press and hover</td></tr>
        <tr><th scope="row">dur-arrive</th><td>380ms</td><td>Arrival: the band wipe, the head's growth, a section's unfold</td></tr>
        <tr><th scope="row">dur-arrive-fade</th><td>260ms</td><td>Arrival: a section's opacity</td></tr>
        <tr><th scope="row">dur-arrive-label</th><td>220ms</td><td>Arrival: the band's label fades in, after delay-arrive-label (200ms)</td></tr>
        <tr><th scope="row">dur-arrive-texture</th><td>520ms</td><td>Arrival: the band's ripple and sheen fade in, after delay-arrive-texture (260ms)</td></tr>
      </tbody>
    </table>
  </div>
  <p class="pv-note">Everything here is off under prefers-reduced-motion. An entrance plays once, the first time the block is seen. A tap the reader made may animate every time.</p>
</div>
<script>
  document.getElementById('replay').addEventListener('click', function () {
    var els = document.querySelectorAll('#stamps .card--stamp-in, #rises .player-rise');
    els.forEach(function (e) { var c = e.classList.contains('card--stamp-in') ? 'card--stamp-in' : 'player-rise'; e.classList.remove(c); });
    void document.body.offsetWidth;
    els.forEach(function (e, i) { e.classList.add(i < 3 ? 'card--stamp-in' : 'player-rise'); });
  });
  // The arrival. Reset to the plain card, force a reflow, then add the classes the app's useArrival sets:
  // arrival--play (every transition hangs off it) and is-in (the arrived look).
  var cards = document.querySelectorAll('.pv-arrive');
  function arrive() {
    cards.forEach(function (c) { c.classList.remove('arrival--play', 'is-in'); c.querySelectorAll('.unfold').forEach(function (u) { u.removeAttribute('data-open'); }); });
    void document.body.offsetWidth;
    cards.forEach(function (c) { c.classList.add('arrival--play', 'is-in'); c.querySelectorAll('.unfold').forEach(function (u) { u.setAttribute('data-open', ''); }); });
  }
  document.getElementById('replay-arrival').addEventListener('click', arrive);
  setTimeout(arrive, 600);
</script>
</body>
</html>
`)
console.log('motion preview written')
