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
const GAMES = [
  { a: 'TB',  h: 'BAL', t: '6:05', park: 'Oriole Park at Camden Yards',  state: 'live' },
  { a: 'LAA', h: 'TEX', t: '6:05', park: 'Globe Life Field',             state: 'live' },
  { a: 'ATH', h: 'HOU', t: '6:10', park: 'Daikin Park',                  state: 'live' },
  { a: 'NYM', h: 'CWS', t: '6:10', park: 'Rate Field',                   state: 'live' },
  { a: 'DET', h: 'KC',  t: '6:15', park: 'Kauffman Stadium',             state: 'live' },
  { a: 'PIT', h: 'LAD', t: '6:15', park: 'Dodger Stadium',    tv: 'FOX', state: 'live' },
  { a: 'CHC', h: 'SEA', t: '6:15', park: 'T-Mobile Park',     tv: 'FOX', state: 'live' },
  { a: 'SF',  h: 'BOS', t: '6:15', park: 'Fenway Park',       tv: 'FOX', state: 'live' },
  { a: 'CIN', h: 'ARI', t: '7:10', park: 'Chase Field',       in: 'IN 55M',    state: 'pre' },
  { a: 'CLE', h: 'COL', t: '7:10', park: 'Coors Field',       in: 'IN 55M',    state: 'pre' },
  { a: 'MIN', h: 'SD',  t: '7:40', park: 'Petco Park',        in: 'IN 1H 25M', state: 'pre' },
  { a: 'ATL', h: 'MIL', t: '1:10', park: 'American Family Field', pin: true, state: 'sealed' },
  { a: 'TOR', h: 'NYY', t: '12:35', park: 'Yankee Stadium',              state: 'sealed' },
  { a: 'WSH', h: 'MIA', t: '3:10', park: 'loanDepot park',    tv: 'FS1', state: 'sealed' },
  { a: 'STL', h: 'PHI', t: '5:05', park: 'Citizens Bank Park',           state: 'sealed' },
]

const g = (a, h) => GAMES.find((x) => x.a === a && x.h === h)

/* --------------------------------------------------------------- helpers */
// WCAG relative luminance, so the seam and the LIVE chip are decided by
// measurement rather than by looking at the six clubs a mock happens to show.
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
// Which ink a club's own field can carry. White type was hardcoded, which is
// right for the 25 clubs with a dark primary and wrong for the rest: white on
// Montgomery's #febe28 is 1.7:1, on Miami's #00A3E0 2.5:1, on the Giants'
// #FD5A1E 2.8:1. Same measurement that picks the seam picks the ink.
const onField = (c) => (contrast('#FFFFFF', c) >= 3.4 ? '#FFFFFF' : '#0A0B0D')
const dimOn = (c) => (contrast('#FFFFFF', c) >= 3.4 ? 'rgba(255,255,255,.8)' : 'rgba(10,11,13,.72)')

const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const SIGNAL = '#E9DA00'      // scoreboard-bulb yellow: the one non-club colour
const INK = '#0A0B0D'         // near-black ground for the dark concepts

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
  // A compressed face at a negative track closes its own word space; this
  // opens it back up without loosening the letter fit the face was cut for.
  `word-spacing:0.09em;text-transform:uppercase`

const mono = (size, { wt = 500, ls = '0.16em', color = null } = {}) =>
  // 10px floor, enforced here rather than at 40-odd call sites. The four
  // sizes this set used to carry between 7.5 and 9.5 were not a scale, they
  // were noise inside 2px.
  `font-family:'JetBrains Mono',ui-monospace,monospace;font-size:${Math.max(size, 10)}px;` +
  `font-weight:${wt};letter-spacing:${ls};text-transform:uppercase` +
  (color ? `;color:${color}` : '')

// A club mark knocked out to a flat white silhouette — the jersey-chest
// treatment. Colour marks would fight the colour block they sit on.
// DIAMONDBACKS set at 74px in this face is 434px wide in a 368px slot, and
// RUMBLE PONIES is 429. The mock had been dodging it by writing "D-backs" in
// the data. Step the size by length instead — the poster keeps one line, and
// the longest name in the affiliated game still fits.
const nickSize = (nick) =>
  nick.length <= 7 ? 74 : nick.length <= 9 ? 62 : nick.length <= 11 ? 52 : 44

// GHOST is the field texture — big, cropped, barely there.
const ghost = (team, css) =>
  T[team].logo
    ? `<img src="${T[team].logo}" alt="" style="position:absolute;${css};` +
      `filter:brightness(0) invert(1);pointer-events:none" />`
    : ''

// A base, with a mark printed on it. The container the club's art sits on is
// the bag it is played on — worn canvas, clay in the corners, cleat marks —
// which is a better object than a neutral swatch for the same reason the seal
// is tape rather than a grey box: it is a thing from the game, not a UI shape.
// Takes a filename rather than a team key so the minor-league boards, which
// carry their own club table, print on the same bag.
const baseTileSrc = (src, size, { colour = false } = {}) => {
  const pad = Math.round(size * (colour ? 0.15 : 0.16))
  // One nub per ~13px of bag, floored so the grid never closes up into a flat
  // tint at feed size.
  // ~24 nubs across, which is roughly a real bag's density. The first pass ran
  // seven across and came out as polka dots; the texture has to be small and
  // dense enough to read as a SURFACE rather than as a motif. Floored at 2.6px
  // so it never aliases into moiré, and the layer fades as the bag shrinks —
  // a base seen small loses its texture, it does not gain a coarser one.
  const nub = Math.min(6, Math.max(2.6, Math.round((size / 24) * 10) / 10))
  const nubop = size >= 90 ? 0.85 : size >= 60 ? 0.6 : 0.45
  // Only the big bag carries a cast shadow; at 48px in a feed it reads as a
  // blur rather than as a bag sitting in dirt.
  const lift = colour ? 'box-shadow:0 3px 0 rgba(10,11,13,.42);' : ''
  return `<span class="base" style="--nub:${nub}px;--nubop:${nubop};display:grid;place-items:center;` +
    `width:${size}px;height:${size}px;padding:${pad}px;${lift}flex:none">` +
    `<span class="base-nubs"></span><span class="base-dirt"></span><span class="base-grain"></span>` +
    (src
      ? `<img src="${src}" alt="" style="position:relative;width:100%;height:100%;object-fit:contain` +
        `${colour ? '' : ';filter:grayscale(1) contrast(1.08)'}" />`
      : '') +
    `</span>`
}

// A club with no mark on file still gets the bag — empty. Which is the honest
// drawing for it: the game is there, the art is not (see `docs` on MiLB feeds
// degrading gracefully), and a blank bag says that where a grey rectangle just
// looks broken.
const baseTile = (team, size, opts = {}) => baseTileSrc(T[team].logo || null, size, opts)

// CHEST MARK — the feed's treatment. The first cut ran every logo at 14–17%
// opacity, about 1.15:1 against its own field: not a watermark, a deleted
// asset, and it deleted the best logo art in American sport along with it. A
// straight knockout is no better — `brightness(0) invert(1)` turns every opaque
// pixel white, so Milwaukee's ball-in-glove, the Orioles bird and the Astros
// star all collapse into one white disc. Grayscale keeps every internal shape,
// and it is the most Tally-specific choice available: this app exists to be
// sketched in pencil and /logos is already a printable grayscale sheet.
const chestMark = (team, size, css = '') => baseTile(team, size)

// COLOUR MARK — the payoff, and what the opening is FOR. Same bag, same
// position, filter off: the mark you meet in the feed is the pencil version,
// and opening the game is where it inks in.
const colourMark = (team, size, css = '') => baseTile(team, size, { colour: true })

const liveDot = (color = SIGNAL, size = 6) =>
  `<span class="pulse" style="width:${size}px;height:${size}px;border-radius:50%;` +
  `background:${color};display:inline-block;flex:none"></span>`

// The LIVE marker is ONE object at ONE contrast, everywhere. Loose on the band
// it inherited whatever the home club was wearing: #E9DA00 on Miami's #00A3E0
// is 1.98:1, on the Giants' #FD5A1E 2.18:1 — under 4.5:1 for a 10px label. It
// also read as a club's own gold on the five clubs that own yellow (the A's
// #EFB21E sat 20px away at 1.31:1). Sunk into an ink chip it is 10.5:1 against
// whatever it lands on, and it can no longer be mistaken for identity.
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
    /* THE BASE. The logo does not sit on a swatch, it sits on a bag.
       A competition base is moulded rubber over a foam core, and its top is a
       traction surface: a regular grid of small raised nubs with narrow
       channels between them. That grid is the thing you actually recognise in
       a close-up photo, so it is the thing this draws — four layers, no image
       files.

       1. .base            the fill, the rolled bevel, the stitched seam
       2. .base-nubs       the moulded grid: a lit edge on each nub, a shadowed
                           channel around it
       3. .base-dirt       clay, laid OVER the grid on multiply so it darkens
                           the channels rather than covering them — which is
                           where dirt actually goes and why the grid reads
                           strongest at the corners
       4. .base-grain      rubber tooth

       No cleat marks. A rake across the top read as damage rather than as
       texture, and it fought whatever mark was printed over it. */
    .base {
      position: relative;
      border-radius: 2px;
      background-image:
        radial-gradient(ellipse 78% 64% at 34% 28%, rgba(255, 255, 255, .95) 0, transparent 68%),
        linear-gradient(158deg, #FCFAF4 0%, #F7F3EA 58%, #EDE7D9 100%);
      box-shadow:
        inset 0 0 0 1.5px rgba(255, 255, 255, .7),
        inset 0 0 0 3px rgba(146, 114, 74, .3),
        inset 0 -3px 5px rgba(126, 88, 48, .1);
    }
    /* The stitched seam, set in from the rolled edge the way a real bag's is. */
    .base::after {
      content: '';
      position: absolute;
      inset: 10%;
      border: 1px solid rgba(126, 88, 48, .18);
      border-radius: 1px;
      pointer-events: none;
    }
    /* The traction surface: DISCRETE nubs, not a grid of lines.
       Crossed repeating lines drew plaid — continuous rules read as a weave,
       and at feed size the channels were a quarter of each cell wide, so the
       bag came out tartan. Moulded rubber is a field of separate bumps, so
       each nub is drawn as one: a lit cap, and a shadow offset half a pixel
       down-right, on a square tile.

       --nub is the pitch, set per tile so a nub stays the same PHYSICAL size
       whether the bag is 104px on a poster or 44px in a feed; --nubop fades
       the whole layer as the bag shrinks, because a real base seen small
       does not grow coarser texture, it loses it. */
    .base-nubs {
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: 2px;
      opacity: var(--nubop, .7);
      background-image:
        radial-gradient(circle at 60% 64%, rgba(118, 90, 56, .24) 0 26%, transparent 31%),
        radial-gradient(circle at 43% 41%, rgba(255, 255, 255, .68) 0 26%, transparent 32%);
      background-size: var(--nub) var(--nub), var(--nub) var(--nub);
    }
    /* Clay, over the grid. The middle of a bag gets stepped clean and stays
       white, which is also what lets a mark print over it. */
    .base-dirt {
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: 2px;
      mix-blend-mode: multiply;
      background-image:
        radial-gradient(circle at 2% 3%, rgba(150, 110, 66, .5) 0, transparent 30%),
        radial-gradient(circle at 98% 96%, rgba(150, 110, 66, .46) 0, transparent 28%),
        radial-gradient(circle at 97% 3%, rgba(168, 132, 86, .34) 0, transparent 24%),
        radial-gradient(circle at 3% 97%, rgba(168, 132, 86, .38) 0, transparent 26%),
        radial-gradient(ellipse 130% 34% at 50% 108%, rgba(150, 110, 66, .38) 0, transparent 60%);
    }
    .base-grain {
      position: absolute;
      inset: 0;
      pointer-events: none;
      mix-blend-mode: multiply;
      opacity: .16;
      border-radius: 2px;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='3'/></filter><rect width='90' height='90' filter='url(%23b)' opacity='0.5'/></svg>");
    }

    /* The seal's own surface: the one signal colour, raked. It is the kraft
       tape of this palette — same job, drawn in the ink the screen is in. */
    .hatch { position: absolute; inset: 0; pointer-events: none; opacity: .13;
      background-image: repeating-linear-gradient(-38deg, #E9DA00 0 2px, transparent 2px 11px); }
${extraStyle}  </style>
</helmet>
`

const tail = `</x-dc>
</body>
</html>
`

/* ------------------------------------------------- shared dark-concept bits */
// The masthead. TAL1Y keeps the app's own wordmark joke (the 1 for an L).
// Search, Game Log and the menu were on the shipping masthead and fell off this
// one. They are drawn at 44x44 because they are controls, not decoration.
const iconBtn = (kind) => {
  const path = {
    search: '<circle cx="7.5" cy="7.5" r="5.2" stroke="rgba(255,255,255,.82)" stroke-width="1.6"/><path d="M11.4 11.4 15 15" stroke="rgba(255,255,255,.82)" stroke-width="1.6" stroke-linecap="square"/>',
    log: '<rect x="2" y="2.5" width="12" height="13" rx="1" stroke="rgba(255,255,255,.82)" stroke-width="1.6"/><path d="M5.2 2.5v13" stroke="rgba(255,255,255,.82)" stroke-width="1.6"/>',
    menu: '<path d="M2 4h14M2 9h14M2 14h14" stroke="rgba(255,255,255,.82)" stroke-width="1.6" stroke-linecap="square"/>',
  }[kind]
  return `<span style="display:grid;place-items:center;width:44px;height:44px;margin:0 -8px">` +
    `<svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">${path}</svg></span>`
}

const masthead = (level = 'MLB') => `
  <header style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px 10px;border-bottom:1px solid rgba(255,255,255,.12)">
    <div style="display:flex;align-items:center;gap:9px">
      <span style="${disp(23, { w: 66, ls: '0.005em' })};color:#fff">TAL<span style="color:${SIGNAL}">1</span>Y</span>
      <span style="${mono(8, { ls: '0.3em', color: 'rgba(255,255,255,.62)' })};padding-top:3px">BASEBALL</span>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      ${iconBtn('search')}
      ${iconBtn('log')}
      ${iconBtn('menu')}
    </div>
  </header>
  <!-- Every one of these was a 21x13 label. WCAG 2.2 AA (2.5.8) wants 24x24;
       Apple wants 44pt. They are controls, so they get 44. -->
  <nav style="display:flex;align-items:center;gap:2px;padding:0 14px;border-bottom:1px solid rgba(255,255,255,.12)">
    ${['MLB', 'AAA', 'AA', 'A+', 'A'].map((lv) => `
    <span style="display:grid;place-items:center;min-width:46px;height:44px;${lv === level ? `background:${SIGNAL};` : ''}">
      <span style="${mono(10, { wt: 700, ls: '0.14em', color: lv === level ? INK : 'rgba(255,255,255,.6)' })}">${lv}</span>
    </span>`).join('')}
  </nav>`

// Date rail + the sealed-state chip. On a spoiler-safe app the seal IS the
// status bar: it says, up front, that no number on this screen can spoil you.
const dayrail = () => `
  <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 14px;border-bottom:1px solid rgba(255,255,255,.12)">
    <div style="display:flex;align-items:center;gap:4px">
      <span style="display:grid;place-items:center;width:44px;height:44px;${mono(15, { wt: 400, ls: '0', color: 'rgba(255,255,255,.66)' })}">&#8249;</span>
      <span style="${disp(19, { w: 78, wt: 800, ls: '0.01em' })};color:#fff">SAT 22 AUG</span>
      <span style="display:grid;place-items:center;width:44px;height:44px;${mono(15, { wt: 400, ls: '0', color: 'rgba(255,255,255,.66)' })}">&#8250;</span>
    </div>
    <!-- This is the ADR-0026 Scores Unlocked switch, not a status label. Drawn
         as a label it removed the control and kept only the nagging half — the
         one consented, reversible way out of the seal, turned into a scold. -->
    <span style="display:flex;align-items:center;gap:7px;min-height:44px;border:1px solid rgba(255,255,255,.28);padding:0 11px">
      ${sealGlyph('rgba(255,255,255,.8)', 12)}
      <span style="${mono(10, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.8)' })}">SEALED</span>
      <span style="width:26px;height:15px;border:1px solid rgba(255,255,255,.4);position:relative;display:block">
        <span style="position:absolute;left:1px;top:1px;width:11px;height:11px;background:rgba(255,255,255,.6)"></span>
      </span>
    </span>
  </div>`

const sectionRule = (label, count, right = '') => `
  <div style="display:flex;align-items:center;gap:10px;padding:9px 20px 8px;background:rgba(255,255,255,.035)">
    <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">${label}</span>
    ${count ? `<span style="${mono(8.5, { wt: 400, ls: '0.1em', color: 'rgba(255,255,255,.6)' })}">${count}</span>` : ''}
    <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    ${right}
  </div>`

/* ------------------------------------------------------------ MARQUEE band
   A full-bleed colour block, no gutter and no card. The away club enters as a
   hard wedge from the left with its own secondary showing as a 5px piping
   along the seam — a jersey sash, not a divider. */
// A LIVE game, a game two hours out and a game finished four hours ago were
// drawn at identical height and identical saturation, so a fifteen-game
// Saturday shouted fifteen times and there was nothing to skim. Height and
// saturation now carry state, which is a better answer than a density toggle
// because it gives the feed a SHAPE — and it drops a full slate from 1770px to
// about 1450px as a side effect.
const BAND_H = { live: 118, pre: 88, sealed: 68 }
const bandScrim = { live: null, pre: 'rgba(10,11,13,.16)', sealed: 'rgba(10,11,13,.46)' }

function marqueeBand(game, h = BAND_H[game.state] ?? 118) {
  const A = T[game.a]
  const H = T[game.h]
  const big = h >= 108
  const mid = h >= 88
  const abbrA = big ? 44 : mid ? 34 : 27
  const abbrH = big ? 39 : mid ? 30 : 24
  const rail = big ? 32 : 30
  const markSize = big ? 48 : mid ? 36 : 28
  const wedge = 'polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)'
  // THE SEAM IS ACHROMATIC, ALWAYS. It used to be the away club's secondary,
  // which is just another club colour: 173 of the league's 435 matchups put two
  // primaries within 1.35:1 of each other (two pairs are byte-identical —
  // Tigers/Yankees, Pirates/White Sox), and 250 of 870 secondary-on-primary
  // orderings fall under 1.6:1. Braves at Brewers drew a #13274F line on
  // #12284B: 1.00:1, an invisible divider on a band whose whole job is to show
  // two clubs meeting. A fixed white rule separates all 435 pairs. White clears
  // WCAG's 3:1 non-text threshold against every primary except Miami's #00A3E0
  // (2.87:1), which takes the ink rule instead. The away secondary stays, as a
  // 2px accent INSIDE the seam — a piping detail, no longer the separator.
  const seam = contrast('#FFFFFF', A.p) < 3 || contrast('#FFFFFF', H.p) < 3 ? '#0A0B0D' : '#FFFFFF'
  const status =
    game.state === 'live'
      ? liveChip()
      : game.state === 'sealed'
        ? `<span style="display:flex;align-items:center;gap:5px">${sealGlyph('rgba(255,255,255,.78)', 10)}<span style="${mono(9, { wt: 700, ls: '0.2em', color: 'rgba(255,255,255,.78)' })}">SEALED</span></span>`
        : `<span style="${mono(9, { wt: 700, ls: '0.2em', color: 'rgba(255,255,255,.82)' })}">${game.t} PM</span>`
  return `
    <article style="position:relative;height:${h}px;overflow:hidden;background:${H.p};border-bottom:1px solid rgba(255,255,255,.16)${game.pin ? ';box-shadow:inset 0 0 0 2px #FFFFFF' : ''}">
      <div style="position:absolute;inset:0;width:calc(45% + 6px);background:${seam};clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:calc(45% + 2px);background:${A.s};clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:45%;background:${A.p};clip-path:${wedge}"></div>
      ${ghost(game.a, `left:-30px;top:-18px;height:${h + 48}px;opacity:.09`)}
      ${ghost(game.h, `right:-26px;top:-22px;height:${h + 54}px;opacity:.09`)}
      ${bandScrim[game.state] ? `<span style="position:absolute;inset:0;background:${bandScrim[game.state]};pointer-events:none"></span>` : ''}
      <div style="position:absolute;left:0;right:0;top:0;height:${h - rail}px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;max-width:calc(45% - 24px)">
          ${chestMark(game.a, markSize)}
          <div style="min-width:0">
            <div style="${disp(abbrA)};color:${onField(A.p)}">${game.a}</div>
            ${mid ? `<div style="${mono(8, { ls: '0.2em' })};color:${dimOn(A.p)};margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${A.city}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="text-align:right;min-width:0">
            <div style="${disp(abbrH)};color:${onField(H.p)}">${game.h}</div>
            ${mid ? `<div style="${mono(8, { ls: '0.2em' })};color:${dimOn(H.p)};margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${H.city}</div>` : ''}
          </div>
          ${chestMark(game.h, markSize)}
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:${rail}px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px;background:${INK}">
        <span style="display:flex;align-items:center;gap:5px;${mono(8, { ls: '0.17em', color: 'rgba(255,255,255,.74)' })};overflow:hidden;white-space:nowrap">${game.pin ? starGlyph('#FFFFFF', 10) : ''}<span style="overflow:hidden;text-overflow:ellipsis">${game.park}</span></span>
        <span style="display:flex;align-items:center;gap:9px;flex:none">
          ${game.tv ? `<span style="${mono(8, { wt: 700, ls: '0.12em', color: 'rgba(255,255,255,.88)' })};border:1px solid rgba(255,255,255,.5);padding:2px 4px 1px">${game.tv}</span>` : ''}
          ${status}
        </span>
      </div>
    </article>`
}

/* ----------------------------------------------------------- RUNDOWN row
   Departure board. The dotted leader between the two clubs is the whole
   character of it — a rule that stretches to fill, the way a timetable sets
   a destination against its platform. */
function rundownRow(game, h = 56) {
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
          ${game.tv ? `<span style="${mono(7.5, { wt: 700, ls: '0.1em', color: 'rgba(255,255,255,.74)' })};border:1px solid rgba(255,255,255,.3);padding:1px 3px;flex:none">${game.tv}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">${right}</div>
    </div>`
}

/* ============================================================== ARTBOARDS */

/* -- A. MARQUEE ---------------------------------------------------------- */
const marquee = head() + `
<div style="width:390px;min-height:844px;background:${INK};overflow:hidden">
${masthead()}
${dayrail()}
${GAMES.slice(0, 6).map((x) => marqueeBand(x)).join('')}
  <article style="position:relative;height:30px;overflow:hidden;background:${T.SEA.p}">
    <div style="position:absolute;inset:0;width:57%;background:${T.CHC.p};clip-path:polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)"></div>
    <div style="position:absolute;left:20px;top:5px;${disp(22)};color:rgba(255,255,255,.9)">CHC</div>
    <div style="position:absolute;right:20px;top:5px;${disp(22)};color:rgba(255,255,255,.9)">SEA</div>
  </article>
</div>
` + tail

/* -- B. RUNDOWN ---------------------------------------------------------- */
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

/* -- DESKTOP: the same system at 1440 ------------------------------------ */
const flat = (s) => s.replace('padding:9px 20px 8px', 'padding:0 0 10px')
const flush = (s) => s.replace('padding:0 20px', 'padding:0')
const desktop = head() + `
<div style="width:1440px;min-height:760px;background:${INK};overflow:hidden">
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
    <section style="min-width:0">
${flat(sectionRule('ON NOW', '08'))}
      <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:2px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.16)">
${GAMES.slice(0, 4).map((x) => marqueeBand(x, 172)).join('')}
      </div>
      <div style="height:30px"></div>
${flat(sectionRule('FIRST PITCH TO COME', '03'))}
      <div style="border-top:1px solid rgba(255,255,255,.12)">
${GAMES.slice(8, 11).map((x) => flush(rundownRow(x, 64))).join('')}
      </div>
    </section>
    <aside style="border-left:1px solid rgba(255,255,255,.12);padding-left:30px;min-width:0">
${flat(sectionRule('ALSO ON NOW', '04'))}
${GAMES.slice(4, 8).map((x) => flush(rundownRow(x, 64))).join('')}
      <div style="height:30px"></div>
${flat(sectionRule('EARLIER TODAY &#183; TAP TO UNSEAL', '04'))}
${GAMES.slice(11, 15).map((x) => flush(rundownRow(x, 64))).join('')}
    </aside>
  </div>
</div>
` + tail

/* The chosen flow (flow.mjs) is handed the same helpers these sketches use, so
   the feed, the poster and the three screens behind it cannot drift apart. */
const KIT = {
  T, GAMES, g, SIGNAL, INK, head, tail, disp, mono, ghost, liveDot, sealGlyph,
  starGlyph, masthead, dayrail, sectionRule, marqueeBand, nickSize, liveChip, contrast,
  chestMark, colourMark, baseTileSrc,
}
const flow = flowArtboards(KIT)
const extra = extraArtboards({ ...KIT, doorRow: flow.doorRow, gameHeader: flow.gameHeader, revealRail: flow.revealRail })
const milb = milbArtboards(KIT)

/* ------------------------------------------------------------------ write */
const files = {
  // The flow, in the order you walk it.
  'Main.dc.html': flow.main,
  'Opening.dc.html': flow.opening,
  'Poster.dc.html': flow.poster,
  'Lineups.dc.html': flow.lineups,
  'Innings.dc.html': flow.innings,
  'BoxScore.dc.html': flow.boxscore,
  'FeedLight.dc.html': extra.feedLight,
  'InningsOpen.dc.html': extra.inningsOpen,
  'BoxOpen.dc.html': extra.boxOpen,
  'Edges.dc.html': extra.edges,
  'MiLB.dc.html': milb.milbFeed,
  'MiLBPoster.dc.html': milb.milbPoster,
  'Desktop.dc.html': desktop,
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
    { id: 'page-2', name: 'Review fixes' },
    { id: 'page-3', name: 'Directions' },
  ],
  artboards: [
    { file: 'Main.dc.html', title: '1 · The feed — all 15 games', page: 'page-1', x: 0, y: 0, w: 390, h: 1838 },
    { file: 'Opening.dc.html', title: '2 · Opening a game — 440ms, on a loop', page: 'page-1', x: 500, y: 0, w: 390, h: 844 },
    { file: 'Poster.dc.html', title: '3 · The game', page: 'page-1', x: 1000, y: 0, w: 390, h: 844 },
    { file: 'Lineups.dc.html', title: '4 · Lineups', page: 'page-1', x: 1500, y: 0, w: 390, h: 844 },
    { file: 'Innings.dc.html', title: '5 · Innings — sealed', page: 'page-1', x: 2000, y: 0, w: 390, h: 844 },
    { file: 'InningsOpen.dc.html', title: '5b · Innings — opened', page: 'page-1', x: 2500, y: 0, w: 390, h: 844 },
    { file: 'BoxScore.dc.html', title: '6 · Box score — sealed', page: 'page-1', x: 3000, y: 0, w: 390, h: 844 },
    { file: 'BoxOpen.dc.html', title: '6b · Box score — opened', page: 'page-1', x: 3500, y: 0, w: 390, h: 844 },
    { file: 'Desktop.dc.html', title: 'The feed at 1440', page: 'page-1', x: 500, y: 1080, w: 1440, h: 760 },
    { file: 'FeedLight.dc.html', title: 'Light ground — the same feed, same bands', page: 'page-2', x: 0, y: 0, w: 390, h: 1882 },
    { file: 'Edges.dc.html', title: 'Edge cases the mock was dodging', page: 'page-2', x: 500, y: 0, w: 390, h: 880 },
    { file: 'MiLB.dc.html', title: 'Double-A — where the art is the point', page: 'page-2', x: 1000, y: 0, w: 390, h: 744 },
    { file: 'MiLBPoster.dc.html', title: 'Binghamton at Hartford', page: 'page-2', x: 1500, y: 0, w: 390, h: 844 },
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
      text: 'A INTO D\nThe band and the poster are the same composition at two scales, which is what lets one become the other: the band\u2019s wedge and the poster\u2019s diagonal are ONE four-point clip-path. The opening is that path un-clipping.\n\nThe poster is the door, not a destination \u2014 the five ways out of a game sit across its foot, and 4\u20136 are what they open. Each screen now has BOTH states: sealed, and opened. Drawing five locked doors and never opening one was the biggest gap in the first cut.\n\nThe feed shows all fifteen games with the fold marked, so density is something you can look at rather than a claim.',
    },
    {
      id: 'flow-motion',
      page: 'page-1',
      x: 500, y: -300, w: 390,
      text: 'THE OPENING \u2014 REWRITTEN AFTER REVIEW\nThe first cut ran nine beats across 3.19 SECONDS (iOS push is 350ms) and animated `top`/`height` on a full-bleed element carrying two 74px strings and two 400px images \u2014 layout and paint every frame, while the note beside it claimed transform-only. Both were wrong and both are fixed.\n\nNow: 440ms, three beats, clip-path and opacity only. The hero is always full height in poster layout; the feed state is a clip, and opening is one interpolated inset(). Band type and poster type overlap so there is never a frame with neither \u2014 the old timing left a 600px empty hole for about a second.\n\nAnd the band expands OVER the list rather than clearing it. Tapping game 12 of 15 would have split the slate and thrown eleven bands upward.',
    },
    {
      id: 'flow-seal',
      page: 'page-1',
      x: 2000, y: -240, w: 890,
      text: 'SEALED, THEN OPENED\nNothing loosens the spoiler rule; the kraft tape is redrawn as the ground itself, raked in the one signal colour. It still says what it says today: this half only, nothing else moves, the innings after it stay shut.\n\n5b and 6b are the states that were missing. The revealed half lands in exactly the 212px the seal held, so opening one does not shove the page down. 6b proves the table styling the system had never been asked for: tabular mono on a hairline grid, the club colour as the row header, totals in the signal colour \u2014 and the linescore, which is the one place a run total belongs.',
    },
    {
      id: 'flow-scope',
      page: 'page-1',
      x: 1500, y: -240, w: 390,
      text: 'SCOPE OF 4\u20136\nThese carry the LANGUAGE, not the whole screen. The real lineup page also holds weather, attendance, the season series, umpire tendencies, the defensive alignment and former teammates; the real innings page holds play-by-play and the pitch chart. Nothing here proposes dropping any of it.',
    },
    {
      id: 'fix-ground',
      page: 'page-2',
      x: -470, y: 0, w: 420,
      text: 'THE ONE OPEN QUESTION \u2014 which ground?\n\nOn #0A0B0D, 17 of 30 club primaries sit under 1.4:1 against the page. Tigers and Yankees are 1.25:1; Pirates and White Sox 1.29; Padres 1.30; Brewers 1.34. More than half the league does not read as a colour block at all \u2014 which is the generic dark sports app this was written to escape. 17 of 30 primaries are also blue or navy, so \u201ca rack of jerseys\u201d is, on a real slate, a rack of navy.\n\nOn this ground (#E7E6E1, a cool grey-white \u2014 NOT the app\u2019s #F6EFDC manila) only Miami (2.50) and the Giants (2.75) fall under 3:1, and the median is 10.59:1. Two things come free: the separator becomes a 4px GAP of page instead of a drawn line, which is what a rack of jerseys actually looks like; and a finished game reads as finished by desaturating, with no extra device.\n\nThe break that mattered \u2014 full-bleed club colour replacing cards \u2014 survives either way. This is the call I would not make for you.',
    },
    {
      id: 'fix-list',
      page: 'page-2',
      x: 500, y: -400, w: 390,
      text: 'ALSO FIXED AFTER REVIEW\n\nSEAM. Was the away club\u2019s secondary \u2014 another club colour. 173 of 435 matchups put two primaries within 1.35:1 (Tigers/Yankees and Pirates/White Sox are byte-identical), and Braves-at-Brewers drew a #13274F line on #12284B: 1.00:1. Now a fixed white rule, ink for Miami, which separates all 435. The secondary stays as a 2px accent inside it.\n\nLIVE. #E9DA00 loose on club colour was 1.98:1 on Miami, 2.18 on the Giants, and 1.31 against the A\u2019s own gold sitting 20px away. It is now always an ink chip: one object, 10.5:1, on every club.\n\nTYPE. 26 of 53 home-screen nodes were under 9px against the app\u2019s own 11px floor, in four sizes inside 2px. Floored at 10px, dim text lifted.\n\nTARGETS. Level tabs were 21\u00d713, day chevrons 8\u00d717. All 44\u00d744.\n\nTHE SEAL CHIP became a label and stopped being the ADR-0026 Scores Unlocked switch \u2014 it kept the nagging half and dropped the control. It is a switch again.\n\nHIERARCHY. Live, upcoming and finished were drawn at one height and one saturation, so fifteen games shouted fifteen times. Height and saturation now carry state: 118 / 88 / 68.\n\nAlso: the pin ring stopped borrowing the LIVE colour; the caption rail is ink, so the home park is no longer captioned inside the visitor\u2019s block; the wedge is 45% so the HOME club actually has the field, as the note always claimed; search, Game Log and the menu are back on mobile.',
    },
    {
      id: 'fix-edges',
      page: 'page-2',
      x: 500, y: 920, w: 390,
      text: 'The three-state mock (live / pre / sealed) had no drawing for a postponement, a doubleheader, or a row with no usable colour. The nickname strip proves the fit rule: DIAMONDBACKS at 74px was 434px wide in a 368px slot, and the data had been quietly writing "D-backs" to dodge it.',
    },
    {
      id: 'fix-marks',
      page: 'page-2',
      x: 1000, y: -420, w: 390,
      text: 'THE LOGOS ARE BACK \u2014 and they are now a two-part idea, not a texture.\n\nWhat was wrong: every mark ran at 14\u201317% opacity, about 1.15:1 against its own field. That is not a watermark, it is a deleted asset \u2014 and it deleted the best logo art in American sport along with it.\n\nWhat is wrong with the obvious fix: a straight knockout at full opacity deletes the ARTWORK instead. `brightness(0) invert(1)` turns every opaque pixel white, so Milwaukee\u2019s ball-in-glove, the Orioles bird and the Astros star all collapse into a white disc.\n\nSo: the FEED shows the mark in grayscale, which keeps every internal shape \u2014 and is the most Tally-specific choice available, since the whole app exists to be sketched in pencil and /logos is already a printable grayscale sheet. The POSTER shows it in full colour at 104px.\n\nAND IT PRINTS ON A BASE. A competition base is moulded rubber over a foam core, and its top is a traction surface \u2014 a dense field of small raised nubs. That is the thing you actually recognise in a close-up, so it is the thing this draws: each nub is a lit cap with its own shadow offset down-right, about 24 across, on a domed top with a rolled bevel and the stitched seam set in from it. Clay goes on OVER the nubs on multiply, so it darkens the gaps between them rather than covering them \u2014 which is where dirt really collects, and why the texture reads strongest at the corners while the middle stays stepped-clean and white enough to print a mark on.\n\nTwo passes were wrong before this one. Crossed lines drew plaid \u2014 continuous rules read as a weave, and at feed size the channels were a quarter of each cell wide. Discrete nubs at seven across read as polka dots. Texture has to be small and dense enough to be a SURFACE rather than a motif. It also fades as the bag shrinks, because a base seen small loses its texture rather than gaining a coarser one.\n\nNo cleat marks: a rake across the top read as damage instead of texture, and it fought whatever was printed over it. All CSS, no image files. A club with no art on file still gets the bag, empty \u2014 the honest drawing for \u201cthe game is there, the logo is not\u201d.\n\nWhich gives the opening something to be FOR: the mark you meet in the feed is the pencil version, and opening the game is where it inks in.',
    },
    {
      id: 'fix-milb',
      page: 'page-2',
      x: 1500, y: -420, w: 390,
      text: 'AND THIS IS WHY IT MATTERS MOST DOWN HERE.\n\nRumble Ponies, Yard Goats, Trash Pandas, Biscuits, Sod Poodles, Flying Squirrels \u2014 this is the best logo work in the sport, and a design premised on club COLOUR was throwing all of it away.\n\nIt matters more at Double-A than in MLB for a reason the repo already knows: 50 of the 117 MiLB clubs in `milb-colors.json` have a primary under L 0.02 (four are literally #000000), and 107 of 117 are flagged "confidence: medium", sourced from Wikipedia. The COLOUR data is the untrustworthy half. The art is not.\n\nSo down here the mark is not decoration on top of a colour system \u2014 it is the part of the identity you can actually rely on.',
    },
    {
      id: 'dir-brief',
      page: 'page-3',
      x: -470, y: 0, w: 420,
      text: 'THE PROBLEM\nTally is the only sports feed with no numbers in it. The spoiler rule forbids scores, records and odds on the slate \u2014 so the feed cannot lean on the thing every other scores app leads with.\n\nThat is the opening, not the handicap. What is left is exactly what a college-football gameday poster is made of: two identities, a place, a time, and anticipation.\n\nThese four are the original sketches, kept as drawn. Everything they got wrong is fixed on pages 1 and 2, not here.',
    },
    {
      id: 'note-a',
      page: 'page-3',
      x: 0, y: -240, w: 390,
      text: 'A \u00b7 MARQUEE \u2014 colour blocking, edge to edge\nNo card, no gutter, no radius, no shadow. Each game is a full-bleed band. Chosen, with D.\n\nWhat review caught here: the seam was a club colour and died on 8 of the 15 games in this very artboard, and every band was the same height whatever the game was doing. Both fixed on page 1.',
    },
    {
      id: 'note-b',
      page: 'page-3',
      x: 500, y: -240, w: 390,
      text: 'B \u00b7 RUNDOWN \u2014 the departure board\nMonospaced, dense, near-monochrome; the dotted leader is the character of it. Not chosen for the phone, but it survives twice: as the feed\u2019s compact density, and as the right-hand rail of the desktop layout.',
    },
    {
      id: 'note-c',
      page: 'page-3',
      x: 1000, y: -240, w: 390,
      text: 'C \u00b7 STUB \u2014 a printed artifact\nTwo-ink screenprint, fluorescent pink a hair out of register, halftone and grain, perforated stub, rotated stamp.\n\nNot chosen \u2014 and the review\u2019s fair hit is that this is the only one of the four a machine would not have produced, so cutting it is where the set got timid. It remains the strongest candidate for the Game Log\u2019s stamps and shelf, where a printed artifact is what the thing actually is.',
    },
    {
      id: 'note-d',
      page: 'page-3',
      x: 1500, y: -240, w: 390,
      text: 'D \u00b7 SPLIT \u2014 one game, one poster\nHard diagonal seam, marks bleeding off the corners, the app\u2019s own @ cut through the middle.\n\nChosen, with A \u2014 but promoted out of the feed. As fifteen snap-scrolled screens it was beautiful and unusable; as the ONE screen you land on after tapping a band, the cost disappears. See page 1.',
    },
  ],
  launch: { view: 'canvas', page: 'page-1' },
}
out('canvas.json', JSON.stringify(canvas, null, 2))
console.log('wrote', Object.keys(files).join(', '), '+ canvas.json')
