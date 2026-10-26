// The checkpoint (#2572) in the stage's slot, at each size. The numbers are checkpoint.js's own pages
// (PAGE_ORDER: tally, pitching, atBats, gameSoFar), run on 824716 by tools/extract2.mjs; atBats and
// gameSoFar are not built in the app yet, so their rows come from computeHalfInningFeed and the linescore.
// SPOILER FOOTING: the checkpoint mounts only for a half at or under revealedThrough; its last half keys on
// revealedThrough === finalHalfIndex (ADR-0043), never on selectIsFinal.
;(function () {
  const { esc, rowOf, ord } = window.GDR, R2 = window.GD_R2
  const LABEL = { tally: 'Tally', pitching: 'Pitching', atBats: 'At-bats', gameSoFar: 'Game', facts: 'Notes' }
  const HALF = { top2: R2.halves.top2, bot9: R2.halves.bot9 }

  function pages(key, withFacts) {
    const h = HALF[key], ids = h.pages.map((p) => p.id)
    return withFacts ? [...ids, 'facts'] : ids
  }

  // Gary, round 2: the half's pitches, whiffs and fouls belong with the tally (today's tally grid has them).
  function tally(h, sm) {
    const f = h.pages.find((p) => p.id === 'tally').fields, p = h.pages.find((x) => x.id === 'pitching').fields
    const bat = h.half === 'top' ? 'Seattle' : 'Boston', fld = h.half === 'top' ? 'Boston' : 'Seattle'
    const row = (cells) => `<div class="gd-tally ${sm ? 'is-sm' : ''}">${cells.map(([k, v]) => `<div><b>${v}</b><span class="lbl">${k}</span></div>`).join('')}</div>`
    return `<h4>${h.half === 'top' ? 'Top' : 'Bottom'} ${ord(h.inning)} · ${bat}</h4>
      ${row([['R', f.runs], ['H', f.hits], ['E', f.errors], ['LOB', f.leftOnBase]])}
      ${row([['Pitches', p.pitches], ['Whiffs', p.whiffs], ['Fouls', p.fouls]]).replace('gd-tally', 'gd-tally gd-tally--3')}
      <span class="gd-note">E is ${fld}'s, the side in the field.</span>`
  }
  function pitching(h) {
    const f = h.pages.find((p) => p.id === 'pitching').fields
    const rows = f.pitchers.map((p) => `<tr><td>${esc(p.last)}</td><td>${p.pitches}</td><td>${p.strikes}</td><td>${p.whiffs}</td><td>${p.fouls}</td></tr>`).join('')
    return `<h4>Pitching this half</h4><table class="gd-ptbl"><tr><th>Pitcher</th><th>P</th><th>S</th><th>Whiffs</th><th>Fouls</th></tr>${rows}
      ${f.pitchers.length > 1 ? `<tr class="tot"><td>Half</td><td>${f.pitches}</td><td>${f.strikes}</td><td>${f.whiffs}</td><td>${f.fouls}</td></tr>` : ''}</table>`
  }
  // `star` marks a scoring play (The Show 13's post-game list); off here, on in the whole-half candidate.
  function atBats(h, star = false) {
    const ev = (r) => r.type === 'pinch_hitting' ? r.text.replace('Offensive substitution: Pinch-hitter ', 'PH ').replace(' replaces ', ' for ').replace('.', '')
      : r.type === 'pitching_substitution' ? r.text.replace('Pitching change: ', 'P ').replace(' replaces ', ' for ').replace('.', '') : null
    const rows = h.rows.map((r) => {
      if (r.kind !== 'ab') { const t = ev(r); return t ? `<div class="ev"><span></span><span>${esc(t)}</span></div>` : '' }
      return `<div><span class="num">#${esc(r.num)}</span><span class="nm">${star && r.rbi ? '<span class="star">★ </span>' : ''}${esc(r.first[0])}. ${esc(r.last)}</span><span class="c">${esc(r.code)}</span><span class="gd-note">${r.rbi ? r.rbi + ' RBI' : ''}</span><span>${r.out ? `<span class="o">${r.out}</span>` : ''}</span></div>`
    }).join('')
    return `<h4>The half's at-bats</h4><div class="gd-abrows">${rows}</div>`
  }
  function gameSoFar(h, key) {
    const end = key === 'bot9'
    const head = ['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 'R', 'H', 'E']
    const cells = (side) => R2.innings.map((i) => {
      const idx = 2 * (i.n - 1) + (side === 'home' ? 1 : 0)
      return `<td class="${end && i.n === 9 ? 'dbl' : ''}">${idx <= h.idx ? i[side].runs : ''}</td>`
    }).join('')
    const t = h.soFar
    const tr = (side, nm) => `<tr><td>${nm}</td>${cells(side)}<td class="tot">${t[side].r}</td><td>${t[side].h}</td><td>${t[side].e}</td></tr>`
    const due = end ? '' : (() => {
      const bos = R2.lineups.home, i = bos.findIndex((x) => x.name === 'Nick Sogard')
      return `<span class="lbl">Due up · bottom 2nd</span><div class="gd-due" style="margin-top:0">${[0, 1, 2].map((k) => bos[(i + k) % 9]).map((u) => `<span>${ord(u.slot)} · #${u.num} ${esc(u.name.split(' ').at(-1))}</span>`).join('')}</div>`
    })()
    return `<h4>${end ? 'Final' : 'The game so far'}</h4><table class="gd-mini"><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr>${tr('away', 'SEA')}${tr('home', 'BOS')}</table>${due}
      ${end ? '<span class="gd-note">The double rule closes the 9th. Next tap: the box score.</span>' : ''}`
  }
  // The notes come from another game (window.GD_FACTS.meta): 824716 has no callout bundle.
  function facts(n = 5) {
    const F = window.GD_FACTS?.top2 || [], m = window.GD_FACTS?.meta
    if (!F.length) return '<h4>Notes</h4><span class="gd-note">None for this half.</span>'
    return `<h4>Notes for the next half</h4><div class="gd-facts">${F.slice(0, n).map((x) => `<p>${x.who ? `<b>${esc(x.who)}</b> · ` : ''}${esc(x.text)}</p>`).join('')}</div>
      ${m ? `<span class="gd-note">Real notes from ${esc(m.game)}, top 2nd: 824716 has no notes bundle.</span>` : ''}`
  }
  function page(id, key, opts = {}) {
    const h = HALF[key]
    const body = id === 'tally' ? tally(h, opts.sm) : id === 'pitching' ? pitching(h) : id === 'atBats' ? atBats(h) : id === 'gameSoFar' ? gameSoFar(h, key) : facts(opts.factsN)
    return `<div class="gd-page" data-page="${id}" style="${opts.area ? `grid-area:${opts.area}` : ''}">${body}</div>`
  }

  // The layer that takes the stage slot. cp: { key, page, mode: 'one'|'grid', nav: 'tabs'|'dots', facts: 'page'|'menu'|'none' }
  function layer(cp, size) {
    return (w, h) => {
      const H = HALF[cp.key], ids = pages(cp.key, cp.facts === 'page' && cp.key === 'top2')
      const title = cp.key === 'bot9' ? 'Final · end of the 9th' : 'End of the top 2nd'
      const head = `<div class="gd-cp__head"><span>${title}</span><small>SEA ${H.soFar.away.r} · BOS ${H.soFar.home.r}</small></div>`
      const grid = cp.mode === 'grid' && size !== 'P'
      if (grid) {
        // Left column: tally, pitching, game. Right: the at-bats (the tallest page), then the notes.
        const notes = ids.includes('facts')
        const areas = notes ? "'t a' 'p a' 'g n'" : "'t a' 'p a' 'g a'"
        return `<div class="gd-cp">${head}<div class="gd-cp__body" style="grid-template-columns:1fr 1fr;grid-template-areas:${areas};grid-template-rows:auto auto 1fr">
          ${page('tally', cp.key, { area: 't', sm: true })}${page('pitching', cp.key, { area: 'p' })}${page('gameSoFar', cp.key, { area: 'g' })}${page('atBats', cp.key, { area: 'a' })}${notes ? page('facts', cp.key, { area: 'n', factsN: 2 }) : ''}</div></div>`
      }
      const cur = ids.includes(cp.page) ? cp.page : ids[0]
      const strip = cp.nav === 'dots'
        ? `<div class="gd-strip is-dots">${ids.map((id) => `<span class="${id === cur ? 'on' : ''}" aria-label="${LABEL[id]}"></span>`).join('')}</div>`
        : `<div class="gd-strip">${ids.map((id) => `<span class="${id === cur ? 'on' : ''}">${LABEL[id]}</span>`).join('')}</div>`
      const arrows = cp.nav === 'dots' ? '<span class="gd-arrow l">‹</span><span class="gd-arrow r">›</span>' : ''
      return `<div class="gd-cp">${head}${cp.nav === 'dots' ? '' : strip}<div class="gd-cp__body" style="${arrows ? 'padding:0 40px' : ''}">${page(cur, cp.key)}${arrows}</div>${cp.nav === 'dots' ? strip : ''}</div>`
    }
  }

  window.GDCP = { layer, pages, page, LABEL, atBats, HALF }
})()
