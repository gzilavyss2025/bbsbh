// Emits the .dc.html artboards + canvas.json for the Tally slate design canvas.
// Run: node build.mjs   (from this directory)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Always write beside this script, whatever the caller's cwd is.
const HERE = dirname(fileURLToPath(import.meta.url))
const out = (name, src) => writeFileSync(join(HERE, name), src)

import { flowArtboards } from './flow.mjs'
import { extraArtboards, milbArtboards } from './extras.mjs'

/* ------------------------------------------------------------------ data
   Real MLB slate, Sat 22 Aug 2026, times Central. Colours are lifted from
   src/lib/data/mlb-team-colors.json so the mockups use the same identity
   values the app already resolves. */
const T = {
  TB:  { city: 'Tampa Bay',     nick: 'Rays',       p: '#092C5C', s: '#8FBCE6', logo: 'tb.svg' },
  BAL: { city: 'Baltimore',     nick: 'Orioles',    p: '#DF4601', s: '#000000', logo: 'bal.svg' },
  LAA: { city: 'Los Angeles',   nick: 'Angels',     p: '#003263', s: '#BA0021', logo: 'laa.svg' },
  TEX: { city: 'Texas',         nick: 'Rangers',    p: '#003278', s: '#C0111F', logo: 'tex.svg' },
  ATH: { city: "It's just",   nick: 'Athletics',  p: '#003831', s: '#EFB21E', logo: 'ath.svg' },
  HOU: { city: 'Houston',       nick: 'Astros',     p: '#002D62', s: '#EB6E1F', logo: 'hou.svg' },
  NYM: { city: 'New York',      nick: 'Mets',       p: '#002D72', s: '#FF5910', logo: 'nym.svg' },
  CWS: { city: 'Chicago',       nick: 'White Sox',  p: '#27251F', s: '#C4CED4', logo: 'cws.svg' },
  DET: { city: 'Detroit',       nick: 'Tigers',     p: '#0C2340', s: '#FA4616', logo: 'det.svg' },
  KC:  { city: 'Kansas City',   nick: 'Royals',     p: '#004687', s: '#BD9B60', logo: 'kc.svg' },
  PIT: { city: 'Pittsburgh',    nick: 'Pirates',    p: '#27251F', s: '#FDB827', logo: 'pit.svg' },
  LAD: { city: 'Los Angeles',   nick: 'Dodgers',    p: '#005A9C', s: '#EF3E42', logo: 'lad.svg' },
  CHC: { city: 'Chicago',       nick: 'Cubs',       p: '#0E3386', s: '#CC3433', logo: 'chc.svg' },
  SEA: { city: 'Seattle',       nick: 'Mariners',   p: '#0C2C56', s: '#005C5C', logo: 'sea.svg' },
  SF:  { city: 'San Francisco', nick: 'Giants',     p: '#FD5A1E', s: '#27251F', logo: 'sf.svg' },
  BOS: { city: 'Boston',        nick: 'Red Sox',    p: '#BD3039', s: '#0C2340', logo: 'bos.svg' },
  ATL: { city: 'Atlanta',       nick: 'Braves',     p: '#CE1141', s: '#13274F', logo: 'atl.svg' },
  MIL: { city: 'Milwaukee',     nick: 'Brewers',    p: '#12284B', s: '#FFC52F', logo: 'mil.svg' },
  TOR: { city: 'Toronto',       nick: 'Blue Jays',  p: '#134A8E', s: '#E8291C', logo: 'tor.svg' },
  NYY: { city: 'New York',      nick: 'Yankees',    p: '#0C2340', s: '#E4002C', logo: 'nyy.svg' },
  CIN: { city: 'Cincinnati',    nick: 'Reds',       p: '#C6011F', s: '#000000' , logo: 'cin.svg' },
  ARI: { city: 'Arizona',       nick: 'D-backs',    p: '#A71930', s: '#E3D4AD' , logo: 'ari.svg' },
  CLE: { city: 'Cleveland',     nick: 'Guardians',  p: '#00385D', s: '#E50022' , logo: 'cle.svg' },
  COL: { city: 'Colorado',      nick: 'Rockies',    p: '#333366', s: '#C4CED4' , logo: 'col.svg' },
  MIN: { city: 'Minnesota',     nick: 'Twins',      p: '#002B5C', s: '#D31145' , logo: 'min.svg' },
  SD:  { city: 'San Diego',     nick: 'Padres',     p: '#2F241D', s: '#FFC425' , logo: 'sd.svg' },
  WSH: { city: 'Washington',    nick: 'Nationals',  p: '#AB0003', s: '#14225A' , logo: 'wsh.svg' },
  MIA: { city: 'Miami',         nick: 'Marlins',    p: '#00A3E0', s: '#EF3340' , logo: 'mia.svg' },
  STL: { city: 'St. Louis',     nick: 'Cardinals',  p: '#C41E3A', s: '#0C2340' , logo: 'stl.svg' },
  PHI: { city: 'Philadelphia',  nick: 'Phillies',   p: '#E81828', s: '#002D72' , logo: 'phi.svg' },
}

// state: 'live' | 'pre' | 'sealed'   (never a score — see the spoiler rule)
// `jh` / `ja` = tonight's KNOWN jersey for the home / away club: the tile tint
// and the jersey's own logo art, the same two values the app resolves from the
// uniforms feed and jerseys.json (BOS drawn in City Connect as the demo).
const GAMES = [
  { a: 'TB',  h: 'BAL', t: '6:05', park: 'Oriole Park at Camden Yards',  state: 'live' },
  { a: 'LAA', h: 'TEX', t: '6:05', park: 'Globe Life Field',             state: 'live' },
  { a: 'ATH', h: 'HOU', t: '6:10', park: 'Daikin Park',                  state: 'live' },
  { a: 'NYM', h: 'CWS', t: '6:10', park: 'Rate Field',                   state: 'live' },
  { a: 'DET', h: 'KC',  t: '6:15', park: 'Kauffman Stadium',             state: 'live' },
  { a: 'PIT', h: 'LAD', t: '6:15', park: 'Dodger Stadium',    tv: 'FOX', state: 'live' },
  { a: 'CHC', h: 'SEA', t: '6:15', park: 'T-Mobile Park',     tv: 'FOX', state: 'live' },
  { a: 'SF',  h: 'BOS', t: '6:15', park: 'Fenway Park',       tv: 'FOX', state: 'live',
    jh: { tint: '#5A8D84', logo: 'cc-bos.png', ink: true } },
  { a: 'CIN', h: 'ARI', t: '7:10', park: 'Chase Field',       in: 'IN 55M',    state: 'pre' },
  { a: 'CLE', h: 'COL', t: '7:10', park: 'Coors Field',       in: 'IN 55M',    state: 'pre' },
  { a: 'MIN', h: 'SD',  t: '7:40', park: 'Petco Park',        in: 'IN 1H 25M', state: 'pre' },
  { a: 'ATL', h: 'MIL', t: '1:10', park: 'American Family Field', pin: true, state: 'sealed' },
  { a: 'TOR', h: 'NYY', t: '12:35', park: 'Yankee Stadium',              state: 'sealed' },
  { a: 'WSH', h: 'MIA', t: '3:10', park: 'loanDepot park',    tv: 'FS1', state: 'sealed' },
  { a: 'STL', h: 'PHI', t: '5:05', park: 'Citizens Bank Park',           state: 'sealed' },
]

const g = (a, h) => GAMES.find((x) => x.a === a && x.h === h)

// ONE list, first-pitch order, your club pinned on top. The shipping slate is
// already a flat list; the sectioned draft ("on now / earlier today") was this
// canvas's invention, and the grouping itself was a spoiler — walking up to the
// slate told you which games were still going before you asked. Start-time
// order says nothing you did not already know from the schedule.
const FEED_ORDER = (() => {
  const pin = GAMES.find((x) => x.pin)
  // Clock strings with no meridiem: hours 8-12 read as the AM/noon block,
  // 1-7 as evening — an MLB slate runs 11:35 AM to 10 PM ET.
  const mins = (t) => {
    const [h, m] = t.split(':').map(Number)
    return (h >= 8 ? h : h + 12) * 60 + m
  }
  return [pin, ...GAMES.filter((x) => !x.pin).sort((a, b) => mins(a.t) - mins(b.t))]
})()

/* --------------------------------------------------------------- helpers */
// WCAG relative luminance, so the seam and the LIVE chip are decided by
// measurement rather than by looking at the six clubs a mock happens to show.
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
// Which ink a club's own field can carry. Same measurement that picks the seam.
const onField = (c) => (contrast('#FFFFFF', c) >= 3.4 ? '#FFFFFF' : '#0A0B0D')
const dimOn = (c) => (contrast('#FFFFFF', c) >= 3.4 ? 'rgba(255,255,255,.84)' : 'rgba(10,11,13,.74)')

const SIGNAL = '#E9DA00'      // scoreboard-bulb yellow: the one non-club colour
const INK = '#0A0B0D'         // near-black ground for the dark mode

const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900' +
  '&family=JetBrains+Mono:wght@400;500;700' +
  '&family=Lora:ital,wght@0,400;1,400&display=swap'

// Compressed athletic caps. font-stretch AND font-variation-settings so the
// axis applies whether the browser reads the shorthand or the low-level prop.
const disp = (size, { w = 62, wt = 900, ls = '-0.02em', lh = 0.84 } = {}) =>
  `font-family:'Archivo','Helvetica Neue',Arial,sans-serif;font-stretch:${w}%;` +
  `font-variation-settings:'wdth' ${w},'wght' ${wt};font-weight:${wt};` +
  `font-size:${size}px;line-height:${lh};letter-spacing:${ls};` +
  `word-spacing:0.09em;text-transform:uppercase`

const mono = (size, { wt = 500, ls = '0.16em', color = null } = {}) =>
  // 10px floor, enforced here rather than at 40-odd call sites.
  `font-family:'JetBrains Mono',ui-monospace,monospace;font-size:${Math.max(size, 10)}px;` +
  `font-weight:${wt};letter-spacing:${ls};text-transform:uppercase` +
  (color ? `;color:${color}` : '')

// DIAMONDBACKS at 74px in this face is 434px wide in a 368px slot. Step the
// size by length instead — the poster keeps one line.
const nickSize = (nick) =>
  nick.length <= 7 ? 74 : nick.length <= 9 ? 62 : nick.length <= 11 ? 52 : 44

// GHOST is the field texture — big, cropped, barely there.
const ghost = (team, css) =>
  T[team].logo
    ? `<img src="${T[team].logo}" alt="" style="position:absolute;${css};` +
      `filter:brightness(0) invert(1);pointer-events:none" />`
    : ''

/* ------------------------------------------------------------- THE BASE
   Redrawn photo-real after review. The reference is the thing itself: an
   18-inch Hollywood base is heavy-gauge rubber over a foam core — a white
   pillow with a slight dome, a rolled bevel on every side, and rounded
   corners ("looks like a pizza box" — Alex Cora, 2023). What a close-up
   photograph actually shows:

   - a pebbled rubber top, lit — drawn with feTurbulence bumped through
     feDiffuseLighting, a real lighting model, not a dot pattern
   - the beveled side walls, brightest on the lit edge, falling to shadow
   - slide scuffs: gray streaks dragged across the top, broken up by a
     displacement map so no streak has a straight edge
   - clay ground into the corners and the foot; the middle gets stepped
     clean and stays white — which is what lets a mark print there
   - at poster size, a cast shadow: the bag sits ON something

   One SVG, generated below, shipped as a data URI — the tile is a photo
   of a base the way the park backdrop is a photo of a park. Scaled down,
   it loses texture the way a photo does; no per-size layers. */
const baseArtSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <radialGradient id="dome" cx="36%" cy="28%" r="92%">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset=".45" stop-color="#F8F5EC"/>
      <stop offset=".8" stop-color="#EDE7D6"/>
      <stop offset="1" stop-color="#DCD3BE"/>
    </radialGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FDFCF8"/>
      <stop offset=".45" stop-color="#D9D2C0"/>
      <stop offset="1" stop-color="#AFA48D"/>
    </linearGradient>
    <filter id="rubber" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="7" result="n"/>
      <feDiffuseLighting in="n" lighting-color="#ffffff" surfaceScale="0.9" diffuseConstant="1.08" result="l">
        <feDistantLight azimuth="235" elevation="62"/>
      </feDiffuseLighting>
      <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
    </filter>
    <filter id="streak" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.010 0.14" numOctaves="3" seed="11" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="16"/>
      <feGaussianBlur stdDeviation="0.7"/>
    </filter>
    <filter id="blotch" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.085" numOctaves="3" seed="4" result="t"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.5 -0.45" result="m"/>
      <feComposite in="SourceGraphic" in2="m" operator="in"/>
    </filter>
    <radialGradient id="clay" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#96713F" stop-opacity=".8"/>
      <stop offset="1" stop-color="#96713F" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="top"><rect x="9" y="9" width="142" height="136" rx="10"/></clipPath>
  </defs>
  <rect x="4" y="4" width="152" height="152" rx="14" fill="url(#wall)"/>
  <rect x="9" y="9" width="142" height="136" rx="10" fill="url(#dome)" filter="url(#rubber)"/>
  <rect x="14" y="14" width="132" height="126" rx="7" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="2"/>
  <rect x="15.5" y="15.5" width="132" height="126" rx="7" fill="none" stroke="#A08D6C" stroke-opacity=".22" stroke-width="1.6"/>
  <g clip-path="url(#top)">
    <g filter="url(#streak)" opacity=".55">
      <rect x="18" y="52" width="118" height="5" fill="#6E675C" opacity=".5" transform="rotate(-14 80 80)"/>
      <rect x="30" y="72" width="112" height="3.4" fill="#7A7368" opacity=".42" transform="rotate(-12 80 80)"/>
      <rect x="12" y="96" width="104" height="4.2" fill="#5E574C" opacity=".38" transform="rotate(-15 80 80)"/>
      <rect x="44" y="116" width="90" height="2.6" fill="#6E675C" opacity=".4" transform="rotate(-11 80 80)"/>
    </g>
    <g filter="url(#blotch)" style="mix-blend-mode:multiply">
      <circle cx="8" cy="8" r="46" fill="url(#clay)"/>
      <circle cx="152" cy="148" r="52" fill="url(#clay)"/>
      <circle cx="152" cy="10" r="32" fill="url(#clay)" opacity=".6"/>
      <circle cx="8" cy="148" r="42" fill="url(#clay)" opacity=".8"/>
      <ellipse cx="80" cy="152" rx="84" ry="22" fill="url(#clay)" opacity=".7"/>
    </g>
  </g>
  <rect x="4" y="4" width="152" height="152" rx="14" fill="none" stroke="#6B5B41" stroke-opacity=".26" stroke-width="1.4"/>
</svg>`
const BASE_ART = 'data:image/svg+xml;utf8,' + encodeURIComponent(baseArtSvg().replace(/\n\s*/g, ' ').trim())

// A base, with a mark printed on it. Takes a filename rather than a team key
// so the minor-league boards, which carry their own club table, print on the
// same bag. The mark multiplies onto the rubber — ink on a white surface, so
// the pebble grain shows through the print the way it does on a real
// special-event bag. A club with no art still gets the bag, empty: the honest
// drawing for "the game is there, the logo is not".
const baseTileSrc = (src, size, { colour = false, ink = false } = {}) => {
  const pad = Math.round(size * 0.18)
  const lift = colour && size >= 90 ? 'filter:drop-shadow(0 5px 7px rgba(10,11,13,.4));' : ''
  // `ink`: jersey art shipped as a white knockout (cut for a tinted tile)
  // would multiply away on the white bag — print it as ink instead.
  const markFilter = ink ? ';filter:brightness(0) opacity(.82)' : colour ? '' : ';filter:grayscale(1) contrast(1.08)'
  return `<span class="base" style="display:grid;place-items:center;` +
    `width:${size}px;height:${size}px;padding:${pad}px;${lift}flex:none">` +
    (src
      ? `<img src="${src}" alt="" style="position:relative;width:100%;height:100%;object-fit:contain;` +
        `mix-blend-mode:multiply${markFilter}" />`
      : '') +
    `</span>`
}

const baseTile = (team, size, opts = {}) => baseTileSrc(T[team].logo || null, size, opts)

// CHEST MARK — the feed's treatment: grayscale, the pencil version.
const chestMark = (team, size) => baseTile(team, size)
// COLOUR MARK — the payoff: opening the game is where the mark inks in.
const colourMark = (team, size) => baseTile(team, size, { colour: true })

const liveDot = (color = SIGNAL, size = 6) =>
  `<span class="pulse" style="width:${size}px;height:${size}px;border-radius:50%;` +
  `background:${color};display:inline-block;flex:none"></span>`

// The LIVE marker is ONE object at ONE contrast, everywhere: an ink chip,
// 10.5:1 on whatever club colour it lands on.
const liveChip = (label = 'LIVE', dot = 6) =>
  `<span style="display:flex;align-items:center;gap:6px;flex:none;background:${INK};` +
  `padding:4px 7px 3px">${liveDot(SIGNAL, dot)}` +
  `<span style="${mono(10, { wt: 700, ls: '0.18em', color: SIGNAL })}">${label}</span></span>`

const sealGlyph = (color, size = 11) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 12 12" fill="none" aria-hidden="true" ` +
  `style="flex:none"><rect x="1.5" y="5" width="9" height="6" rx="1" stroke="${color}" ` +
  `stroke-width="1.4"/><path d="M3.8 5V3.6a2.2 2.2 0 0 1 4.4 0V5" stroke="${color}" ` +
  `stroke-width="1.4"/></svg>`

const starGlyph = (color, size = 11) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 12 12" aria-hidden="true" style="flex:none">` +
  `<path d="M6 0.6l1.6 3.5 3.8.4-2.8 2.6.8 3.8L6 9l-3.4 1.9.8-3.8L.6 4.5l3.8-.4z" fill="${color}"/></svg>`

// The shipping app's national-broadcast mark is the network's own PNG logo
// (public/broadcast-logos/, 16px tall on the card) — kept, on the ink rail.
// FOX ships as black-on-transparent and inverts to print on ink; FS1 carries
// its own navy box and needs nothing.
const TV_LOGOS = { FOX: { src: 'tv-fox.png', css: 'filter:invert(1);opacity:.92' }, FS1: { src: 'tv-fs1.png', css: '' } }
const tvMark = (tv) => {
  const t = TV_LOGOS[tv]
  if (!t) return `<span style="${mono(8, { wt: 700, ls: '0.12em', color: 'rgba(255,255,255,.88)' })};border:1px solid rgba(255,255,255,.5);padding:2px 4px 1px">${tv}</span>`
  return `<img src="${t.src}" alt="${tv}" style="height:13px;width:auto;max-width:52px;display:block;${t.css}" />`
}

/* ------------------------------------------------------------- themes
   Light and dark both ship — the app already renders in the reader's theme.
   The bands are club colour and identical in both; the theme is carried by
   the chrome, the seals and the tables. Dark separates bands with a hairline
   (band and page share a value too often for a gap); light separates with a
   4px gap of page, which is what a rack of jerseys actually looks like. */
const THEMES = {
  dark: {
    key: 'dark',
    page: INK,
    tx: (a) => `rgba(255,255,255,${a})`,
    rule: 'rgba(255,255,255,.12)',
    logoTint: null,
    wordmark: '#fff',
    signal: SIGNAL,
    tabBg: SIGNAL, tabInk: INK,
    bandSep: 'border-bottom:1px solid rgba(255,255,255,.16)',
    bandGap: 0,
    scrim: { live: null, pre: 'rgba(10,11,13,.16)', sealed: 'rgba(10,11,13,.46)' },
    pinRing: '#FFFFFF',
    sheet: '#101216',
  },
  light: {
    key: 'light',
    page: '#E7E6E1',
    tx: (a) => `rgba(16,17,20,${a})`,
    rule: 'rgba(16,17,20,.16)',
    logoTint: null,
    wordmark: '#101114',
    signal: '#B8A800', // the bulb, dimmed to hold 3:1 on the light page
    tabBg: '#101114', tabInk: '#E7E6E1',
    bandSep: '',
    bandGap: 4,
    scrim: { live: null, pre: 'rgba(231,230,225,.18)', sealed: 'rgba(231,230,225,.52)' },
    pinRing: '#101114',
    sheet: '#FFFFFF',
  },
}

/* ------------------------------------------------------------- shell/head */
const head = (extraStyle = '') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${FONTS}">
  <style>
    body { margin: 0; font-family: 'Archivo','Helvetica Neue',Arial,sans-serif; }
    a { color: ${SIGNAL}; text-decoration: none; }
    a:hover { color: #ffffff; }
    * { box-sizing: border-box; }
    @keyframes tallypulse { 0%,100% { opacity: 1 } 50% { opacity: .28 } }
    .pulse { animation: tallypulse 1.9s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .pulse { animation: none } }
    /* THE BASE — a photo of a base (one SVG data URI: lit pebbled rubber,
       beveled walls, slide scuffs, clay in the corners; the middle stepped
       clean so the mark prints). See the generator for the drawing. */
    .base { position: relative; background: url("${BASE_ART}") center / 100% 100% no-repeat; }

    /* THE SHEEN — the shipping slate's scroll-driven band of light
       (06a-gamecard-parkart.css), same soft-light blend and the same softened
       stops. In the app it rides a view timeline and tracks the thumb; an
       artboard cannot scroll for you, so here the same band loops slowly,
       staggered down the slate, to show the effect. */
    .bandsheen { position: absolute; inset: 0; z-index: 3; overflow: hidden;
      pointer-events: none; mix-blend-mode: soft-light; }
    .bandsheen::before { content: ''; position: absolute;
      left: -30%; right: -30%; top: -50%; bottom: -50%;
      background: linear-gradient(172deg,
        transparent 26%, rgba(10,11,13,.10) 40%,
        rgba(252,250,244,.46) 50%, rgba(10,11,13,.08) 60%, transparent 74%);
      animation: bandsheen 9s linear infinite; animation-delay: var(--d, 0s); }
    @keyframes bandsheen {
      0% { transform: translate3d(0,-34%,0) }
      52% { transform: translate3d(0,34%,0) }
      100% { transform: translate3d(0,34%,0) }
    }
    @media (prefers-reduced-motion: reduce) { .bandsheen { display: none } }

    /* The seal's own surface: the one signal colour, raked — the kraft tape
       of this palette. */
    .hatch { position: absolute; inset: 0; pointer-events: none; opacity: .13;
      background-image: repeating-linear-gradient(-38deg, #E9DA00 0 2px, transparent 2px 11px); }
${extraStyle}  </style>
</helmet>
`

const tail = `</x-dc>
</body>
</html>
`

/* ------------------------------------------------- shared chrome, themed */
const iconBtn = (kind, tx) => {
  const c = tx(0.82)
  const path = {
    search: `<circle cx="7.5" cy="7.5" r="5.2" stroke="${c}" stroke-width="1.6"/><path d="M11.4 11.4 15 15" stroke="${c}" stroke-width="1.6" stroke-linecap="square"/>`,
    log: `<rect x="2" y="2.5" width="12" height="13" rx="1" stroke="${c}" stroke-width="1.6"/><path d="M5.2 2.5v13" stroke="${c}" stroke-width="1.6"/>`,
    menu: `<path d="M2 4h14M2 9h14M2 14h14" stroke="${c}" stroke-width="1.6" stroke-linecap="square"/>`,
  }[kind]
  return `<span style="display:grid;place-items:center;width:44px;height:44px;margin:0 -8px">` +
    `<svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">${path}</svg></span>`
}

const masthead = (level = 'MLB', th = THEMES.dark) => `
  <header style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px 10px;border-bottom:1px solid ${th.rule}">
    <div style="display:flex;align-items:center;gap:9px">
      <span style="${disp(23, { w: 66, ls: '0.005em' })};color:${th.wordmark}">TAL<span style="color:${th.signal}">1</span>Y</span>
      <span style="${mono(8, { ls: '0.3em', color: th.tx(0.62) })};padding-top:3px">BASEBALL</span>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      ${iconBtn('search', th.tx)}
      ${iconBtn('log', th.tx)}
      ${iconBtn('menu', th.tx)}
    </div>
  </header>
  <nav style="display:flex;align-items:center;gap:2px;padding:0 14px;border-bottom:1px solid ${th.rule}">
    ${['MLB', 'AAA', 'AA', 'A+', 'A'].map((lv) => `
    <span style="display:grid;place-items:center;min-width:46px;height:44px;${lv === level ? `background:${th.tabBg};` : ''}">
      <span style="${mono(10, { wt: 700, ls: '0.14em', color: lv === level ? th.tabInk : th.tx(0.6) })}">${lv}</span>
    </span>`).join('')}
  </nav>`

// Date rail + the ADR-0026 Scores Unlocked switch (a control, not a label).
const dayrail = (th = THEMES.dark) => `
  <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 14px;border-bottom:1px solid ${th.rule}">
    <div style="display:flex;align-items:center;gap:4px">
      <span style="display:grid;place-items:center;width:44px;height:44px;${mono(15, { wt: 400, ls: '0', color: th.tx(0.66) })}">&#8249;</span>
      <span style="${disp(19, { w: 78, wt: 800, ls: '0.01em' })};color:${th.wordmark}">SAT 22 AUG</span>
      <span style="display:grid;place-items:center;width:44px;height:44px;${mono(15, { wt: 400, ls: '0', color: th.tx(0.66) })}">&#8250;</span>
    </div>
    <span style="display:flex;align-items:center;gap:7px;min-height:44px;border:1px solid ${th.tx(0.28)};padding:0 11px">
      ${sealGlyph(th.tx(0.8), 12)}
      <span style="${mono(10, { wt: 700, ls: '0.16em', color: th.tx(0.8) })}">SEALED</span>
      <span style="width:26px;height:15px;border:1px solid ${th.tx(0.4)};position:relative;display:block">
        <span style="position:absolute;left:1px;top:1px;width:11px;height:11px;background:${th.tx(0.6)}"></span>
      </span>
    </span>
  </div>`

/* -------------------------------------------------------- THE CLUB STRIP
   Back from the shipping page (TeamFilterStrip): every club at this level,
   full colour, one tap to its team page, your club centred. 36px marks in
   48px targets, edge-faded, scrolls sideways. */
const STRIP_CLUBS = ['CHC', 'STL', 'CIN', 'PIT', 'ATL', 'MIL', 'NYY', 'LAD', 'BOS', 'HOU', 'SEA']
const logoStrip = (th = THEMES.dark) => `
  <div style="position:relative;padding:9px 0;border-bottom:1px solid ${th.rule}">
    <div style="display:flex;gap:6px;justify-content:center;overflow:hidden;` +
      `-webkit-mask-image:linear-gradient(to right, transparent, #000 18px, #000 calc(100% - 18px), transparent);` +
      `mask-image:linear-gradient(to right, transparent, #000 18px, #000 calc(100% - 18px), transparent)">
      ${STRIP_CLUBS.map((k) => `
      <span style="display:grid;place-items:center;width:48px;height:48px;flex:none${k === 'MIL' ? `;box-shadow:inset 0 -2px 0 ${th.signal}` : ''}">
        <img src="${T[k].logo}" alt="${T[k].nick}" style="width:36px;height:36px;object-fit:contain" />
      </span>`).join('')}
    </div>
  </div>`

/* ---------------------------------------------------------- THE WIRE DOCK
   Back from the shipping page (WireDock): the league's roster moves, resting
   as a one-line sheet at the foot of the screen; drag up for the feed. Club
   spine, club mark, the latest move in reading type, the count. */
const wireDock = (th = THEMES.dark) => `
  <div style="position:absolute;left:0;right:0;top:${844 - 62}px;height:62px;z-index:8;` +
    `background:${th.sheet};border-top:1px solid ${th.rule};border-radius:12px 12px 0 0;` +
    `box-shadow:0 -8px 22px rgba(10,11,13,${th.key === 'dark' ? '.55' : '.18'})">
    <div style="display:flex;justify-content:center;padding-top:6px">
      <span style="width:36px;height:4px;border-radius:2px;background:${th.tx(0.3)}"></span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:7px 16px 0 14px">
      <span style="width:3px;align-self:stretch;background:${T.MIL.p};flex:none"></span>
      <img src="${T.MIL.logo}" alt="" style="width:20px;height:20px;object-fit:contain;flex:none" />
      <span style="${mono(10, { wt: 700, ls: '0.1em', color: th.tx(0.85) })};flex:none">MIL</span>
      <span style="font-family:'Lora',Georgia,serif;font-size:12.5px;line-height:1.35;color:${th.tx(0.72)};` +
        `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1">` +
        `Brewers reinstate RHP Freddy Peralta from the 15-day injured list</span>
      <span style="${mono(10, { wt: 700, ls: '0.08em', color: th.tx(0.55) })};flex:none">27</span>
      <span style="${mono(12, { wt: 400, ls: '0', color: th.tx(0.6) })};flex:none">&#8963;</span>
    </div>
  </div>`

/* ------------------------------------------------------------ MARQUEE band
   A full-bleed colour block, no gutter and no card. ONE height for every
   game — the same width and the same size, whatever the game is doing, so
   the slate ranks nothing. State lives inside the band: the chip says LIVE,
   a time, or SEALED, and a played game desaturates under its scrim.
   When tonight's jersey is KNOWN (uniforms feed by day, jerseys.json ahead),
   the band wears it: the field takes the jersey tile's tint and the bag
   prints that jersey's own art. */
const BAND_H = 118
function marqueeBand(game, h = BAND_H, idx = 0, th = THEMES.dark) {
  const A = T[game.a]
  const H = T[game.h]
  const aTint = game.ja?.tint || A.p
  const hTint = game.jh?.tint || H.p
  const aLogo = game.ja?.logo || A.logo
  const hLogo = game.jh?.logo || H.logo
  const big = h >= 108
  const mid = h >= 88
  const abbrA = big ? 44 : mid ? 34 : 27
  const abbrH = big ? 39 : mid ? 30 : 24
  const rail = big ? 32 : 30
  const markSize = big ? 48 : mid ? 36 : 28
  const wedge = 'polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)'
  // THE SEAM IS ACHROMATIC, ALWAYS — 173 of 435 matchups put two primaries
  // within 1.35:1. White separates every pair but Miami's; that takes ink.
  const seam = contrast('#FFFFFF', aTint) < 3 || contrast('#FFFFFF', hTint) < 3 ? '#0A0B0D' : '#FFFFFF'
  const scrim = th.scrim[game.state]
  const status =
    game.state === 'live'
      ? liveChip()
      : game.state === 'sealed'
        ? `<span style="display:flex;align-items:center;gap:5px">${sealGlyph('rgba(255,255,255,.78)', 10)}<span style="${mono(9, { wt: 700, ls: '0.2em', color: 'rgba(255,255,255,.78)' })}">SEALED</span></span>`
        : `<span style="${mono(9, { wt: 700, ls: '0.2em', color: 'rgba(255,255,255,.82)' })}">${game.t} PM</span>`
  return `
    <article style="position:relative;height:${h}px;overflow:hidden;background:${hTint};${th.bandSep}${game.pin ? `;box-shadow:inset 0 0 0 2px ${th.pinRing}` : ''}">
      <div style="position:absolute;inset:0;width:calc(45% + 6px);background:${seam};clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:calc(45% + 2px);background:${A.s};clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:45%;background:${aTint};clip-path:${wedge}"></div>
      ${ghost(game.a, `left:-30px;top:-18px;height:${h + 48}px;opacity:.09`)}
      ${ghost(game.h, `right:-26px;top:-22px;height:${h + 54}px;opacity:.09`)}
      ${scrim ? `<span style="position:absolute;inset:0;background:${scrim};pointer-events:none;z-index:2"></span>` : ''}
      <div style="position:absolute;left:0;right:0;top:0;height:${h - rail}px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;max-width:calc(45% - 20px)">
          ${baseTileSrc(aLogo, markSize, { ink: game.ja?.ink })}
          <div style="min-width:0">
            <div style="${disp(abbrA)};color:${onField(aTint)}">${game.a}</div>
            ${mid ? `<div style="${mono(8, { wt: 700, ls: '0.14em' })};color:${dimOn(aTint)};margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${A.nick}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="text-align:right;min-width:0">
            <div style="${disp(abbrH)};color:${onField(hTint)}">${game.h}</div>
            ${mid ? `<div style="${mono(8, { wt: 700, ls: '0.14em' })};color:${dimOn(hTint)};margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${H.nick}</div>` : ''}
          </div>
          ${baseTileSrc(hLogo, markSize, { ink: game.jh?.ink })}
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:${rail}px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px;background:${INK};z-index:2">
        <span style="display:flex;align-items:center;gap:5px;${mono(8, { ls: '0.17em', color: 'rgba(255,255,255,.74)' })};overflow:hidden;white-space:nowrap">${game.pin ? starGlyph('#FFFFFF', 10) : ''}<span style="overflow:hidden;text-overflow:ellipsis">${game.park}</span></span>
        <span style="display:flex;align-items:center;gap:9px;flex:none">
          ${game.tv ? tvMark(game.tv) : ''}
          ${status}
        </span>
      </div>
      <span class="bandsheen" style="--d:-${((idx % 8) * 1.15).toFixed(2)}s"></span>
    </article>`
}

/* ----------------------------------------------------------- RUNDOWN row
   Departure board. Survives as the desktop rail and the compact density. */
function rundownRow(game, h = 56, th = THEMES.dark) {
  const A = T[game.a]
  const H = T[game.h]
  const sealed = game.state === 'sealed'
  const dim = sealed ? 0.46 : 1
  const right =
    game.state === 'live'
      ? `<span style="display:flex;align-items:center;gap:5px">${liveDot(SIGNAL, 5)}<span style="${mono(8.5, { wt: 700, ls: '0.18em', color: SIGNAL })}">LIVE</span></span>`
      : sealed
        ? `<span style="display:flex;align-items:center;gap:4px">${sealGlyph('rgba(255,255,255,.55)', 9)}<span style="${mono(8.5, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.68)' })}">SEALED</span></span>`
        : `<span style="${mono(8, { wt: 700, ls: '0.14em', color: 'rgba(255,255,255,.66)' })};white-space:nowrap">${game.in || ''}</span>`
  return `
    <div style="display:grid;grid-template-columns:46px minmax(0,1fr) 68px;gap:14px;align-items:center;height:${h}px;padding:0 20px;border-bottom:1px solid rgba(255,255,255,.075);opacity:${dim}">
      <div>
        <div style="${mono(13, { wt: 700, ls: '0.01em', color: '#fff' })}">${game.t}</div>
        <div style="${mono(7.5, { ls: '0.16em', color: 'rgba(255,255,255,.6)' })};margin-top:2px">PM CT</div>
      </div>
      <div style="min-width:0">
        <div style="display:flex;align-items:baseline;gap:9px">
          <span style="${disp(22, { w: 74, wt: 800 })};color:#fff;flex:none">${game.a}</span>
          <span style="flex:1;border-bottom:2px dotted rgba(255,255,255,.24);transform:translateY(-5px)"></span>
          <span style="${disp(22, { w: 74, wt: 800 })};color:#fff;flex:none">${game.h}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:5px;min-width:0">
          <span style="width:16px;height:3px;background:${A.p};flex:none"></span>
          <span style="width:16px;height:3px;background:${H.p};flex:none"></span>
          <span style="${mono(7.5, { ls: '0.15em', color: 'rgba(255,255,255,.62)' })};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${game.park}</span>
          ${game.tv ? `<span style="flex:none">${tvMark(game.tv)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">${right}</div>
    </div>`
}

/* ------------------------------------------------------- THE FEED, themed
   One builder, both modes. Flat list: your club pinned, then first pitch
   order. The dashed rule marks the iPhone fold. */
const fold = (th) => `
  <div style="position:absolute;left:0;right:0;top:844px;height:0;pointer-events:none;z-index:9">
    <div style="border-top:1px dashed ${th.tx(0.5)}"></div>
    <span style="position:absolute;right:8px;top:5px;${mono(9, { wt: 700, ls: '0.18em', color: th.tx(0.6) })}">FOLD &#183; IPHONE 14 PRO</span>
  </div>`

const feed = (themeKey = 'dark') => {
  const th = THEMES[themeKey]
  const bands = FEED_ORDER.map((x, i) => marqueeBand(x, BAND_H, i, th)).join(
    th.bandGap ? `<div style="height:${th.bandGap}px"></div>` : ''
  )
  return head() + `
<div style="position:relative;width:390px;background:${th.page};overflow:hidden">
${fold(th)}
${wireDock(th)}
${masthead('MLB', th)}
${dayrail(th)}
${logoStrip(th)}
${bands}
  <div style="height:70px"></div>
</div>
` + tail
}

const main = feed('dark')
const feedLight = feed('light')

/* -- DESKTOP: the same system at 1440, flat, with the wire as the rail ---- */
const WIRE_ROWS = [
  ['MIL', T.MIL.p, 'Brewers reinstate RHP Freddy Peralta from the 15-day injured list', 'IL'],
  ['NYM', T.NYM.p, 'Mets acquire OF Jordan Walker from the Cardinals for two prospects', 'TRADE'],
  ['SEA', T.SEA.p, 'Mariners select the contract of C Harry Ford from Tacoma', 'CALL-UP'],
  ['BOS', T.BOS.p, 'Red Sox place LHP Garrett Crochet on the paternity list', 'MOVE'],
  ['LAD', T.LAD.p, 'Dodgers option RHP Bobby Miller to Oklahoma City', 'MOVE'],
]
const wireRailRow = ([abbr, colour, text, kind]) => `
  <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.075)">
    <span style="width:3px;align-self:stretch;background:${colour};flex:none"></span>
    <div style="min-width:0">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="${mono(10, { wt: 700, ls: '0.1em', color: 'rgba(255,255,255,.85)' })}">${abbr}</span>
        <span style="${mono(7.5, { wt: 700, ls: '0.14em', color: 'rgba(255,255,255,.5)' })};margin-left:auto">${kind}</span>
      </div>
      <div style="font-family:'Lora',Georgia,serif;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.72);margin-top:4px">${text}</div>
    </div>
  </div>`

const desktop = head() + `
<div style="width:1440px;min-height:900px;background:${INK};overflow:hidden">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:22px 60px;border-bottom:1px solid rgba(255,255,255,.12)">
    <div style="display:flex;align-items:center;gap:34px">
      <span style="${disp(26, { w: 66, ls: '0.005em' })};color:#fff">TAL<span style="color:${SIGNAL}">1</span>Y</span>
      <nav style="display:flex;align-items:center;gap:16px">
        <span style="${mono(10, { wt: 700, ls: '0.14em', color: INK })};background:${SIGNAL};padding:5px 8px 4px">MLB</span>
        <span style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">AAA</span>
        <span style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">AA</span>
        <span style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">A+</span>
        <span style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">A</span>
      </nav>
    </div>
    <div style="display:flex;align-items:center;gap:22px">
      <span style="${disp(20, { w: 78, wt: 800, ls: '0.01em' })};color:#fff">SAT 22 AUG</span>
      <span style="display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.22);padding:6px 10px 5px">
        ${sealGlyph('rgba(255,255,255,.6)', 11)}<span style="${mono(9, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.6)' })}">SCORES SEALED</span>
      </span>
      <span style="${mono(9, { wt: 700, ls: '0.18em', color: INK })};background:#fff;padding:6px 10px 5px">GAME LOG</span>
    </div>
  </header>
  <div style="display:grid;grid-template-columns:minmax(0,1fr) 392px;gap:44px;padding:30px 60px 40px">
    <!-- The SAME flat list at 1440: all fifteen games, one height, pinned
         then first pitch, wrapped two across. No tiers, no groups. -->
    <section style="min-width:0">
      <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:2px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.16)">
${FEED_ORDER.map((x, i) => marqueeBand(x, 172, i)).join('')}
        <div style="display:grid;place-items:center;height:172px;background:${INK}">
          <span style="${mono(9, { ls: '0.22em', color: 'rgba(255,255,255,.45)' })}">15 GAMES &#183; SAT 22 AUG</span>
        </div>
      </div>
    </section>
    <aside style="border-left:1px solid rgba(255,255,255,.12);padding-left:30px;min-width:0">
      <div style="display:flex;align-items:center;gap:10px;padding:0 0 10px">
        <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">THE WIRE</span>
        <span style="${mono(8.5, { wt: 400, ls: '0.1em', color: 'rgba(255,255,255,.6)' })}">LAST 3 DAYS &#183; 27</span>
        <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
      </div>
${WIRE_ROWS.map(wireRailRow).join('')}
      <div style="display:flex;align-items:center;justify-content:center;height:44px;margin-top:12px;border:1px solid rgba(255,255,255,.2)">
        <span style="${mono(9, { wt: 700, ls: '0.2em', color: 'rgba(255,255,255,.72)' })}">22 MORE &#8250;</span>
      </div>
    </aside>
  </div>
</div>
` + tail

/* ------------------------------------------- the original four directions
   Kept as drawn (page 3): the sketches the chosen system came from. */
const sectionRule = (label, count, right = '') => `
  <div style="display:flex;align-items:center;gap:10px;padding:9px 20px 8px;background:rgba(255,255,255,.035)">
    <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">${label}</span>
    ${count ? `<span style="${mono(8.5, { wt: 400, ls: '0.1em', color: 'rgba(255,255,255,.6)' })}">${count}</span>` : ''}
    <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    ${right}
  </div>`

const marquee = head() + `
<div style="width:390px;min-height:844px;background:${INK};overflow:hidden">
${masthead()}
${dayrail()}
${GAMES.slice(0, 6).map((x, i) => marqueeBand(x, 118, i)).join('')}
  <article style="position:relative;height:30px;overflow:hidden;background:${T.SEA.p}">
    <div style="position:absolute;inset:0;width:57%;background:${T.CHC.p};clip-path:polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)"></div>
    <div style="position:absolute;left:20px;top:5px;${disp(22)};color:rgba(255,255,255,.9)">CHC</div>
    <div style="position:absolute;right:20px;top:5px;${disp(22)};color:rgba(255,255,255,.9)">SEA</div>
  </article>
</div>
` + tail

const rundown = head(
  `    .vgrid { position:absolute; inset:0; pointer-events:none;
      background-image: repeating-linear-gradient(to right, rgba(255,255,255,.05) 0 1px, transparent 1px 78px);
      background-position: 20px 0; }
`) + `
<div style="position:relative;width:390px;min-height:844px;background:#0C0D0F;overflow:hidden">
  <div class="vgrid"></div>
  <div style="position:relative">
${masthead()}
${dayrail()}
${sectionRule('NOW PLAYING', '08')}
${GAMES.slice(0, 8).map((x) => rundownRow(x)).join('')}
${sectionRule('FIRST PITCH TO COME', '03')}
${GAMES.slice(8, 11).map((x) => rundownRow(x)).join('')}
${sectionRule('EARLIER TODAY', '04')}
${rundownRow(GAMES[11])}
  </div>
</div>
` + tail

/* -- C. STUB ------------------------------------------------------------- */
const RISO_PINK = '#FF4FA3'
const stubTicket = (game, seq) => {
  const A = T[game.a]
  const H = T[game.h]
  const ink = H.p
  const sealed = game.state === 'sealed'
  return `
    <article style="position:relative;background:#FBFAF6;border:1.5px solid ${ink};display:grid;grid-template-columns:62px minmax(0,1fr);overflow:hidden">
      <div style="position:absolute;left:62px;top:-7px;width:14px;height:14px;border-radius:50%;background:#E4E5E0;border:1.5px solid ${ink};transform:translateX(-50%)"></div>
      <div style="position:absolute;left:62px;bottom:-7px;width:14px;height:14px;border-radius:50%;background:#E4E5E0;border:1.5px solid ${ink};transform:translateX(-50%)"></div>
      <div style="border-right:1.5px dashed ${ink};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:11px 0 13px">
        <span style="${mono(15, { wt: 700, ls: '0.02em', color: ink })}">${seq}</span>
        <span style="${mono(10, { wt: 700, ls: '0.24em', color: ink })};writing-mode:vertical-rl;transform:rotate(180deg)">${game.t} PM</span>
      </div>
      <div style="position:relative;padding:13px 15px 12px;color:${ink};overflow:hidden">
        <div class="halftone"></div>
        ${game.pin ? `<span style="position:absolute;right:13px;top:12px;z-index:2">${starGlyph(RISO_PINK, 15)}</span>` : ''}
        <div style="position:relative">
          <div style="position:relative;display:inline-block">
            <span style="position:absolute;left:2px;top:2px;${disp(27, { w: 64 })};color:${RISO_PINK};mix-blend-mode:multiply;white-space:nowrap">${A.city} ${A.nick}</span>
            <span style="position:relative;${disp(27, { w: 64 })};color:${ink};display:block;white-space:nowrap">${A.city} ${A.nick}</span>
          </div>
          <div style="display:flex;align-items:center;gap:7px;margin:5px 0 4px">
            <span style="height:1.5px;width:22px;background:${ink}"></span>
            <span style="${mono(8, { wt: 700, ls: '0.28em', color: ink })}">AT</span>
            <span style="flex:1;height:1.5px;background:${ink};opacity:.35"></span>
          </div>
          <div style="position:relative;display:inline-block">
            <span style="position:absolute;left:2px;top:2px;${disp(27, { w: 64 })};color:${RISO_PINK};mix-blend-mode:multiply;white-space:nowrap">${H.city} ${H.nick}</span>
            <span style="position:relative;${disp(27, { w: 64 })};color:${ink};display:block;white-space:nowrap">${H.city} ${H.nick}</span>
          </div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:12px;min-width:0">
            <span style="${mono(7.5, { ls: '0.16em', color: ink })};opacity:.72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${game.park}</span>
            ${
              sealed
                ? `<span style="flex:none;display:flex;align-items:center;gap:5px;background:${ink};color:#FBFAF6;padding:4px 7px 3px">${sealGlyph('#FBFAF6', 9)}<span style="${mono(8, { wt: 700, ls: '0.2em' })}">SEALED</span></span>`
                : game.state === 'live'
                  ? `<span style="flex:none;transform:rotate(-6deg);border:2px solid ${RISO_PINK};color:${RISO_PINK};padding:3px 8px 2px;mix-blend-mode:multiply;${mono(10, { wt: 700, ls: '0.22em' })}">LIVE</span>`
                  : `<span style="flex:none;${mono(8, { wt: 700, ls: '0.2em', color: ink })};border:1.5px solid ${ink};padding:3px 7px 2px">FIRST PITCH</span>`
            }
          </div>
        </div>
      </div>
    </article>`
}

const stub = head(
  `    .grain { position:absolute; inset:0; pointer-events:none; opacity:.5; mix-blend-mode:multiply;
      background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.42'/></svg>"); }
    .halftone { position:absolute; inset:0; pointer-events:none; opacity:.16; mix-blend-mode:multiply;
      background-image: radial-gradient(currentColor 0.9px, transparent 1px);
      background-size: 5px 5px; }
`) + `
<div style="position:relative;width:390px;min-height:844px;background:#E4E5E0;overflow:hidden">
  <div class="grain"></div>
  <div style="position:relative;padding:20px 16px 22px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2.5px solid #14161A;padding-bottom:10px">
      <span style="${disp(29, { w: 66, ls: '0.005em' })};color:#14161A">TAL<span style="color:${RISO_PINK}">1</span>Y</span>
      <span style="${mono(8.5, { wt: 700, ls: '0.2em', color: '#14161A' })};padding-bottom:4px">SAT 22 AUG &#183; 15 GAMES</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0 15px">
      <span style="${mono(8, { ls: '0.22em', color: '#14161A' })};opacity:.6">ADMIT ONE &#183; SCORER</span>
      <span style="display:flex;align-items:center;gap:5px">${sealGlyph('#14161A', 10)}<span style="${mono(8, { wt: 700, ls: '0.2em', color: '#14161A' })}">NO SCORES PRINTED</span></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:13px">
${[g('TB', 'BAL'), g('LAA', 'TEX'), g('CIN', 'ARI'), g('ATL', 'MIL')].map((x, i) => stubTicket(x, String(i + 1).padStart(2, '0'))).join('')}
${stubTicket(g('TOR', 'NYY'), '05')}
      <div style="height:52px;overflow:hidden">
${stubTicket(g('WSH', 'MIA'), '06')}
      </div>
    </div>
  </div>
</div>
` + tail

/* -- D. SPLIT ------------------------------------------------------------ */
const splitGame = g('TB', 'BAL')
const SA = T[splitGame.a]
const SH = T[splitGame.h]
const split = head() + `
<div style="position:relative;width:390px;height:844px;background:${SH.p};overflow:hidden">
  ${ghost(splitGame.h, 'right:-118px;bottom:-64px;height:420px;opacity:.17')}
  <div style="position:absolute;inset:0;background:#FFFFFF;clip-path:polygon(0 0, 100% 0, 100% 27.6%, 0 69.8%)"></div>
  <div style="position:absolute;inset:0;background:${SA.p};clip-path:polygon(0 0, 100% 0, 100% 26.7%, 0 68.9%)"></div>
  ${ghost(splitGame.a, 'left:-92px;top:-52px;height:400px;opacity:.17')}

  <div style="position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0">
    <span style="${disp(20, { w: 66, ls: '0.005em' })};color:#fff">TAL<span style="color:${SIGNAL}">1</span>Y</span>
    <span style="display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.45);padding:4px 8px 3px">
      ${liveDot(SIGNAL, 6)}<span style="${mono(8.5, { wt: 700, ls: '0.2em', color: '#fff' })}">LIVE NOW</span>
    </span>
  </div>

  <div style="position:absolute;left:22px;top:112px">
    <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">VISITOR</div>
    <div style="${disp(30, { w: 68, wt: 800 })};color:rgba(255,255,255,.82)">${SA.city}</div>
    <div style="${disp(74)};color:#fff;margin-top:1px">${SA.nick}</div>
  </div>

  <div style="position:absolute;left:0;right:0;top:344px;display:flex;justify-content:center;pointer-events:none">
    <span style="${disp(118, { w: 84, ls: '0' })};color:transparent;-webkit-text-stroke:2.5px rgba(255,255,255,.55)">@</span>
  </div>

  <div style="position:absolute;right:22px;top:486px;text-align:right">
    <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">HOME</div>
    <div style="${disp(30, { w: 68, wt: 800 })};color:rgba(255,255,255,.82)">${SH.city}</div>
    <div style="${disp(74)};color:#fff;margin-top:1px">${SH.nick}</div>
  </div>

  <div style="position:absolute;right:14px;top:274px;display:flex;flex-direction:column;align-items:center;gap:10px">
    <span style="${mono(9, { wt: 700, ls: '0.16em', color: '#fff' })};writing-mode:vertical-rl">01 / 15</span>
    <span style="width:3px;height:64px;background:rgba(255,255,255,.34);position:relative;display:block">
      <span style="position:absolute;left:0;top:0;width:3px;height:17px;background:${SIGNAL}"></span>
    </span>
  </div>

  <div style="position:absolute;left:0;right:0;bottom:26px;background:${INK};padding:13px 20px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px">
    <div style="min-width:0">
      <div style="${mono(11, { wt: 700, ls: '0.1em', color: '#fff' })}">6:05 PM CT</div>
      <div style="${mono(7.5, { ls: '0.16em', color: 'rgba(255,255,255,.66)' })};margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">CAMDEN YARDS &#183; BALTIMORE</div>
    </div>
    <span style="flex:none;display:flex;align-items:center;gap:6px;background:${SIGNAL};color:${INK};padding:7px 10px 6px">
      ${sealGlyph(INK, 10)}<span style="${mono(8.5, { wt: 700, ls: '0.16em' })}">OPEN SCORECARD</span>
    </span>
  </div>

  <div style="position:absolute;left:0;right:0;bottom:0;height:26px;display:flex;overflow:hidden">
    <div style="flex:1;background:${T.LAA.p};display:flex;align-items:center;padding-left:20px">
      <span style="${disp(15, { w: 70, wt: 800 })};color:rgba(255,255,255,.85)">LAA</span>
    </div>
    <div style="flex:1;background:${T.TEX.p};display:flex;align-items:center;justify-content:flex-end;padding-right:20px">
      <span style="${disp(15, { w: 70, wt: 800 })};color:rgba(255,255,255,.85)">TEX</span>
    </div>
  </div>
</div>
` + tail

/* The chosen flow (flow.mjs) is handed the same helpers these sketches use, so
   the feed, the poster and the three screens behind it cannot drift apart. */
const KIT = {
  T, GAMES, g, SIGNAL, INK, head, tail, disp, mono, ghost, liveDot, sealGlyph,
  starGlyph, masthead, dayrail, logoStrip, wireDock, marqueeBand, nickSize, liveChip,
  contrast, chestMark, colourMark, baseTileSrc, tvMark, THEMES, FEED_ORDER,
}
const flow = flowArtboards(KIT)
const extra = extraArtboards({ ...KIT, doorRow: flow.doorRow, gameHeader: flow.gameHeader,
  revealRail: flow.revealRail, shot: flow.shot, playDiamond: flow.playDiamond, sectionLabel: flow.sectionLabel })
const milb = milbArtboards(KIT)

/* ------------------------------------------------------------------ write */
const files = {
  // The flow, in the order you walk it.
  'Main.dc.html': main,
  'FeedLight.dc.html': feedLight,
  'Opening.dc.html': flow.opening,
  'Poster.dc.html': flow.poster,
  'Lineups.dc.html': flow.lineups,
  'HoverCard.dc.html': flow.hoverCard,
  'Innings.dc.html': flow.innings,
  'InningsOpen.dc.html': extra.inningsOpen,
  'BoxScore.dc.html': flow.boxscore,
  'BoxOpen.dc.html': extra.boxOpen,
  'Desktop.dc.html': desktop,
  'Edges.dc.html': extra.edges,
  'MiLB.dc.html': milb.milbFeed,
  'MiLBPoster.dc.html': milb.milbPoster,
  // The four directions, kept on their own page.
  'Marquee.dc.html': marquee,
  'Rundown.dc.html': rundown,
  'Stub.dc.html': stub,
  'Split.dc.html': split,
}
for (const [name, src] of Object.entries(files)) out(name, src)

const canvas = {
  pages: [
    { id: 'page-1', name: 'The flow' },
    { id: 'page-2', name: 'Edges & the minors' },
    { id: 'page-3', name: 'Directions' },
  ],
  artboards: [
    { file: 'Main.dc.html', title: '1 · The feed — dark', page: 'page-1', x: 0, y: 0, w: 390, h: 2080 },
    { file: 'FeedLight.dc.html', title: '1L · The feed — light', page: 'page-1', x: 500, y: 0, w: 390, h: 2135 },
    { file: 'Opening.dc.html', title: '2 · Opening a game — 440ms, on a loop', page: 'page-1', x: 1000, y: 0, w: 390, h: 844 },
    { file: 'Poster.dc.html', title: '3 · The game', page: 'page-1', x: 1500, y: 0, w: 390, h: 844 },
    { file: 'Lineups.dc.html', title: '4 · Lineups', page: 'page-1', x: 2000, y: 0, w: 390, h: 1360 },
    { file: 'HoverCard.dc.html', title: '4b · Hover card — desktop', page: 'page-1', x: 2500, y: 0, w: 350, h: 430 },
    { file: 'Innings.dc.html', title: '5 · Innings — sealed', page: 'page-1', x: 2500, y: 560, w: 390, h: 844 },
    { file: 'InningsOpen.dc.html', title: '5b · Innings — opened', page: 'page-1', x: 3000, y: 0, w: 390, h: 1310 },
    { file: 'BoxScore.dc.html', title: '6 · Box score — sealed', page: 'page-1', x: 3500, y: 0, w: 390, h: 844 },
    { file: 'BoxOpen.dc.html', title: '6b · Box score — opened', page: 'page-1', x: 4000, y: 0, w: 390, h: 1090 },
    { file: 'Desktop.dc.html', title: 'The feed at 1440', page: 'page-1', x: 1000, y: 1530, w: 1440, h: 1540 },
    { file: 'Edges.dc.html', title: 'Edge cases', page: 'page-2', x: 0, y: 0, w: 390, h: 880 },
    { file: 'MiLB.dc.html', title: 'Double-A — where the art is the point', page: 'page-2', x: 500, y: 0, w: 390, h: 790 },
    { file: 'MiLBPoster.dc.html', title: 'Binghamton at Hartford', page: 'page-2', x: 1000, y: 0, w: 390, h: 844 },
    { file: 'Marquee.dc.html', title: 'A · Marquee — chosen', page: 'page-3', x: 0, y: 0, w: 390, h: 920 },
    { file: 'Rundown.dc.html', title: 'B · Rundown', page: 'page-3', x: 500, y: 0, w: 390, h: 940 },
    { file: 'Stub.dc.html', title: 'C · Stub', page: 'page-3', x: 1000, y: 0, w: 390, h: 880 },
    { file: 'Split.dc.html', title: 'D · Split — chosen', page: 'page-3', x: 1500, y: 0, w: 390, h: 844 },
  ],
  annotations: [
    {
      id: 'flow-brief',
      page: 'page-1',
      x: -470, y: 0, w: 420,
      text: 'ONE LIST, BOTH MODES\nThe feed is flat: your club pinned, then first-pitch order. The old "on now / first pitch to come / earlier today" grouping was itself a spoiler — it told you which games were still going before you asked. Now every band is the same size, and state lives inside it: LIVE, a time, or SEALED.\n\nLight and dark both ship. The bands are club colour and identical in both; the chrome, seals and tables carry the theme.\n\nBack from the shipping page: the club strip (one tap to a team page, your club centred), the Wire dock resting at the fold, and the networks’ own PNG logos on the rail.',
    },
    {
      id: 'flow-band',
      page: 'page-1',
      x: 0, y: -300, w: 420,
      text: 'THE BAND\nAbbreviation over MASCOT — MIL over BREWERS, not over Milwaukee.\n\nTHE SHEEN: the shipping slate’s scroll-driven band of light, same soft-light blend and softened stops as 06a-gamecard-parkart.css. In the app it rides a view timeline and tracks the thumb; here it loops so you can see it. Off under reduced motion.\n\nTHE JERSEY: when tonight’s jersey is known (uniforms feed same-day, jerseys.json ahead), the band wears it — the field takes the jersey tile’s tint and the bag prints that jersey’s art. Boston is drawn in City Connect green as the demo.',
    },
    {
      id: 'flow-base',
      page: 'page-1',
      x: 500, y: -300, w: 420,
      text: 'THE BASE, PHOTO-REAL\nRedrawn from reference: an 18-inch Hollywood base is heavy-gauge rubber over a foam core — a white pillow with a rolled bevel and rounded corners. One SVG: pebbled rubber lit through a real lighting model (feTurbulence → feDiffuseLighting), beveled walls, slide scuffs broken by a displacement map, clay ground into the corners. The middle gets stepped clean, which is what lets the mark print. Scaled down it loses texture the way a photo does.\n\nThe feed prints the mark in pencil grayscale; opening the game inks it in.',
    },
    {
      id: 'flow-motion',
      page: 'page-1',
      x: 1000, y: -240, w: 390,
      text: 'THE OPENING\n440ms, three beats, clip-path and opacity only. The band’s wedge and the poster’s diagonal are ONE four-point path; opening is that path un-clipping, over the list, not through it.',
    },
    {
      id: 'flow-scope',
      page: 'page-1',
      x: 2000, y: -300, w: 420,
      text: 'SCREENS 4–6, WITH THEIR OWN FURNITURE\nRedrawn carrying what the shipping pages already have: the opposing starter’s headshot card, the batting order in its real anatomy (order · name · number · position), the defense diamond with surnames and scorer’s numbers, the play diamonds with their advance notations (1B¹, 2B³, F8), and the desktop hover card. Nothing the real pages hold is proposed dropped.',
    },
    {
      id: 'flow-seal',
      page: 'page-1',
      x: 3000, y: -240, w: 890,
      text: 'SEALED, THEN OPENED\nNothing loosens the spoiler rule. The revealed half lands in exactly the 212px the seal held, so opening one does not shove the page down. The box score opens whole and stays open — ADR-0049.',
    },
    {
      id: 'edge-note',
      page: 'page-2',
      x: -470, y: 0, w: 420,
      text: 'THE ROWS A REAL SLATE HANDS YOU\nA postponement, a doubleheader, a club with no usable colour, and the long-name fit rule (74/62/52/44 by length).\n\nDown a level, the mark carries the identity: 50 of 117 MiLB clubs have a primary under L 0.02 and 107 of 117 are flagged "confidence: medium" — the colour data is the untrustworthy half, the art is not.',
    },
    {
      id: 'dir-brief',
      page: 'page-3',
      x: -470, y: 0, w: 420,
      text: 'THE PROBLEM\nTally is the only sports feed with no numbers in it — the spoiler rule forbids scores, records and odds on the slate. What is left is what a college-football gameday poster is made of: two identities, a place, a time, and anticipation.\n\nThese four are the original sketches, kept as drawn.',
    },
    {
      id: 'note-a',
      page: 'page-3',
      x: 0, y: -240, w: 390,
      text: 'A · MARQUEE — colour blocking, edge to edge. No card, no gutter, no radius. Chosen, with D.',
    },
    {
      id: 'note-b',
      page: 'page-3',
      x: 500, y: -240, w: 390,
      text: 'B · RUNDOWN — the departure board. Not chosen for the phone; survives as the desktop rail.',
    },
    {
      id: 'note-c',
      page: 'page-3',
      x: 1000, y: -240, w: 390,
      text: 'C · STUB — a printed artifact. Not chosen here; the strongest candidate for the Game Log’s stamps and shelf.',
    },
    {
      id: 'note-d',
      page: 'page-3',
      x: 1500, y: -240, w: 390,
      text: 'D · SPLIT — one game, one poster. Chosen, with A — promoted out of the feed to the screen you land on.',
    },
  ],
  launch: { view: 'canvas', page: 'page-1' },
}
out('canvas.json', JSON.stringify(canvas, null, 2))
console.log('wrote', Object.keys(files).join(', '), '+ canvas.json')
