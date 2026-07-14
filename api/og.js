// Dynamic Open Graph / Twitter card image (1200×630 PNG), rendered per
// deep-link route so a shared link previews with its own art:
//   • player  → headshot (on his club's brand color) + name + team/position
//   • game    → both clubs' logos + "AWAY @ HOME" (full nicknames) + date
//   • team    → club logo + name + "LEVEL | LEAGUE"
//   • generic → a labeled brand card for the non-entity screens
//
// Part of the crawler-only link-preview layer (see api/_lib/cards.js and
// docs/adr/0012-dynamic-link-previews.md). The palette is lifted verbatim from
// src/tokens/colors.css and the type from src/tokens/typography.css (IBM Plex,
// loaded per-request from Google Fonts and subset to the card's own glyphs) —
// the paper-scorebook look (manila paper, navy ink, kraft-amber seal) the rest
// of the app wears.
//
// Built as plain Satori element objects (no JSX) so the function needs no React
// dependency or JSX build pragma. Every remote image is fetched here and inlined
// as a data URI so a slow/failed CDN fetch degrades to a monogram/abbreviation
// instead of a broken card.

import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

const C = {
  paper: '#F6EFDC',
  paperCard: '#FFFDF6',
  navy: '#1B2A3A',
  ink2: '#3C4A5A',
  graphite: '#6B6558',
  seal: '#E7B84D', // post-it kraft-amber (a touch brighter than the tape seal so it reads as a note)
  sealInk: '#1E1405',
  rule: '#CBC1A7',
}

// The one solid brand color per MLB club, mirrored from src/lib/teams.js
// (TEAM_COLORS) — the same color the app paints behind a player's silo-cutout
// headshot (components/Headshot.jsx), so the card reads like a baseball card.
// MLB-only: a MiLB id (or unknown) has no entry and the photo box degrades to
// the plain paper frame. Keep in sync with teams.js.
const TEAM_COLORS = {
  108: '#BA0021', 109: '#A71930', 110: '#DF4601', 111: '#BD3039', 112: '#0E3386',
  113: '#C6011F', 114: '#E31937', 115: '#333366', 116: '#0C2340', 117: '#EB6E1F',
  118: '#BD9B60', 119: '#005A9C', 120: '#AB0003', 121: '#002D72', 133: '#EFB21E',
  134: '#FDB827', 135: '#2F241D', 136: '#005C5C', 137: '#FD5A1E', 138: '#C41E3A',
  139: '#F5D130', 140: '#C0111F', 141: '#E8291C', 142: '#D31145', 143: '#E81828',
  144: '#CE1141', 145: '#27251F', 146: '#00A3E0', 147: '#003087', 158: '#FFC52F',
}

// --- fonts: IBM Plex, fetched from Google Fonts and subset to the card ------
// Satori needs real TTF/OTF buffers (it can't read CSS @imports), so we ask the
// css2 endpoint for exactly the glyphs this card uses. `head` is the app's
// display face (Plex Sans Condensed — the athletic all-caps header voice from
// typography.css); `body` is Plex Sans for the sub line. If Google is
// unreachable, everything falls back to Satori's bundled font (fonts: []).
const FONT_FALLBACK = 'sans-serif'
const BASE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 @·—|#.,&'\"()/:+-"

async function loadGoogleFont(spec, text) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec)}&text=${encodeURIComponent(text)}`
  const css = await (await fetch(url)).text()
  const m = css.match(/src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/)
  if (!m) throw new Error(`no ttf src for ${spec}`)
  const res = await fetch(m[1])
  if (!res.ok) throw new Error(`font ${res.status} for ${spec}`)
  return res.arrayBuffer()
}

async function loadFonts(cardText) {
  const text = BASE_GLYPHS + (cardText || '').toUpperCase() + (cardText || '')
  try {
    const [cond6, cond7, sans5] = await Promise.all([
      loadGoogleFont('IBM Plex Sans Condensed:wght@600', text),
      loadGoogleFont('IBM Plex Sans Condensed:wght@700', text),
      loadGoogleFont('IBM Plex Sans:wght@500', text),
    ])
    return {
      head: 'IBM Plex Sans Condensed',
      body: 'IBM Plex Sans',
      fonts: [
        { name: 'IBM Plex Sans Condensed', data: cond6, weight: 600, style: 'normal' },
        { name: 'IBM Plex Sans Condensed', data: cond7, weight: 700, style: 'normal' },
        { name: 'IBM Plex Sans', data: sans5, weight: 500, style: 'normal' },
      ],
    }
  } catch {
    return { head: FONT_FALLBACK, body: FONT_FALLBACK, fonts: [] }
  }
}

// --- tiny hyperscript for Satori (element = { type, props }) ---------------
// Satori rejects any <div> that wraps element children (or is otherwise
// non-trivial) unless it declares `display`, so default every div to flex —
// harmless on leaf text nodes, and it removes a whole class of "explicit
// display" render errors.
function el(type, style, children) {
  const kids = children == null ? [] : Array.isArray(children) ? children : [children]
  const s = type === 'div' && style && style.display == null ? { display: 'flex', ...style } : style
  return { type, props: { style: s, children: kids } }
}

// --- remote image → data URI (edge-safe base64, no Buffer) ------------------
function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function fetchImage(url, mime) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return `data:${mime};base64,${toBase64(await res.arrayBuffer())}`
  } catch {
    return null
  }
}

const headshotSrc = (id) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/w_426,q_auto:best/v1/people/${id}/headshot/silo/current`
const logoSrc = (id) => `https://www.mlbstatic.com/team-logos/${id}.svg`

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

// --- shared chrome: paper page + keyline + "SPOILER SAFE" post-it note ------

// A square kraft-amber sticky note pinned to the top-right corner (may sit over
// the home logo on the game card — that's fine, it reads as a stamp). Replaces
// the old rotated kraft-tape strip.
function postItNote(F) {
  const line = (text, mt) =>
    el(
      'div',
      {
        display: 'flex',
        fontFamily: F.head,
        fontWeight: 700,
        fontSize: '40px',
        letterSpacing: '0.04em',
        lineHeight: 1.0,
        color: C.sealInk,
        marginTop: mt || '0px',
      },
      text,
    )
  return el(
    'div',
    {
      position: 'absolute',
      top: '40px',
      right: '46px',
      width: '186px',
      height: '186px',
      transform: 'rotate(4deg)',
      backgroundColor: C.seal,
      boxShadow: '0 16px 34px rgba(30,20,5,0.32)',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    [line('SPOILER'), line('SAFE', '6px')],
  )
}

function frame(children, F) {
  return el(
    'div',
    {
      position: 'relative',
      display: 'flex',
      width: '1200px',
      height: '630px',
      backgroundColor: C.paper,
      color: C.navy,
      fontFamily: F.head,
      // The whole app renders uppercase (the ALL-CAPS INVARIANT — see
      // src/index.css / scripts/check-caps.mjs); the card matches it.
      textTransform: 'uppercase',
      overflow: 'hidden',
    },
    [
      // inner keyline, like a scorebook page border
      el('div', {
        position: 'absolute',
        top: '26px',
        left: '26px',
        right: '26px',
        bottom: '26px',
        border: `4px solid rgba(27,42,58,0.14)`,
        borderRadius: '22px',
      }),
      postItNote(F),
      ...children,
    ],
  )
}

// A small dark (never-red) label above a title — used only where it carries
// real information (team-leaders, the generic screens). The old red "MATCHUP /
// PLAYER / TEAM" kickers are gone.
function eyebrow(text, F) {
  return el(
    'div',
    { display: 'flex', fontFamily: F.head, fontSize: '30px', fontWeight: 600, letterSpacing: '0.16em', color: C.ink2 },
    text,
  )
}

// --- per-type layouts -------------------------------------------------------

async function playerCard(p, F) {
  const shot = await fetchImage(headshotSrc(p.id), 'image/png')
  const bg = TEAM_COLORS[p.team] || null // his club's solid brand color, MLB only
  const photoBox = el(
    'div',
    {
      display: 'flex',
      width: '320px',
      height: '400px',
      borderRadius: '20px',
      backgroundColor: bg || C.paperCard,
      border: bg ? 'none' : `6px solid ${C.navy}`,
      alignItems: shot ? 'flex-end' : 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    shot
      ? { type: 'img', props: { src: shot, style: { width: '320px', height: '400px', objectFit: 'cover', objectPosition: 'top center' } } }
      : el('div', { display: 'flex', fontFamily: F.head, fontSize: '150px', fontWeight: 700, color: bg ? C.paper : C.navy }, initials(p.name)),
  )
  const right = el(
    'div',
    { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '20px' },
    [
      el('div', { display: 'flex', fontFamily: F.head, fontSize: p.name.length > 18 ? '74px' : '90px', fontWeight: 700, lineHeight: 1.0, color: C.navy }, p.name),
      p.sub ? el('div', { display: 'flex', fontFamily: F.body, fontSize: '40px', fontWeight: 500, color: C.ink2 }, p.sub) : null,
    ].filter(Boolean),
  )
  return frame(
    [
      el(
        'div',
        { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '58px', width: '100%', height: '100%', padding: '0 96px' },
        [photoBox, right],
      ),
    ],
    F,
  )
}

async function logoMark(id, size, fallbackText, F) {
  const svg = await fetchImage(logoSrc(id), 'image/svg+xml')
  if (svg) {
    return el('div', { display: 'flex', width: `${size}px`, height: `${size}px` }, {
      type: 'img',
      props: { src: svg, width: size, height: size, style: { objectFit: 'contain' } },
    })
  }
  return el(
    'div',
    {
      display: 'flex',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '9999px',
      border: `6px solid ${C.navy}`,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.paperCard,
    },
    el('div', { display: 'flex', fontFamily: F.head, fontSize: `${Math.round(size * 0.3)}px`, fontWeight: 700, color: C.navy }, fallbackText || '?'),
  )
}

async function gameCard(g, F) {
  const [away, home] = await Promise.all([
    logoMark(g.away, 250, g.awayAbbr, F),
    logoMark(g.home, 250, g.homeAbbr, F),
  ])
  // Full nicknames, no "@" glyph between the logos — the @ lives only in the
  // text line, which shrinks to fit two long names inside the frame.
  const line = `${g.awayName} @ ${g.homeName}`
  const fs = Math.max(40, Math.min(88, Math.floor(1900 / Math.max(1, line.length))))
  return frame(
    [
      el(
        'div',
        { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '0 80px', gap: '30px' },
        [
          el(
            'div',
            { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '72px' },
            [away, home],
          ),
          el('div', { display: 'flex', fontFamily: F.head, fontSize: `${fs}px`, fontWeight: 700, color: C.navy, lineHeight: 1.0 }, line),
          g.date ? el('div', { display: 'flex', fontFamily: F.body, fontSize: '38px', fontWeight: 500, color: C.ink2 }, g.date) : null,
        ].filter(Boolean),
      ),
    ],
    F,
  )
}

async function teamCard(t, F) {
  const mark = await logoMark(t.id, 340, initials(t.name), F)
  const right = el(
    'div',
    { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '18px' },
    [
      t.eyebrow ? eyebrow(t.eyebrow, F) : null,
      el('div', { display: 'flex', fontFamily: F.head, fontSize: t.name.length > 20 ? '70px' : '86px', fontWeight: 700, lineHeight: 1.02, color: C.navy }, t.name),
      t.sub ? el('div', { display: 'flex', fontFamily: F.body, fontSize: '40px', fontWeight: 500, color: C.ink2 }, t.sub) : null,
    ].filter(Boolean),
  )
  return frame(
    [
      el(
        'div',
        { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '58px', width: '100%', height: '100%', padding: '0 96px' },
        [mark, right],
      ),
    ],
    F,
  )
}

function genericCard(gc, F) {
  return frame(
    [
      el(
        'div',
        { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', width: '100%', height: '100%', padding: '0 104px', gap: '22px' },
        [
          gc.eyebrow ? eyebrow(gc.eyebrow, F) : null,
          el('div', { display: 'flex', fontFamily: F.head, fontSize: '92px', fontWeight: 700, lineHeight: 1.0, color: C.navy }, gc.title || 'Tally Baseball'),
          gc.sub ? el('div', { display: 'flex', fontFamily: F.body, fontSize: '40px', fontWeight: 500, color: C.ink2, maxWidth: '880px' }, gc.sub) : null,
        ].filter(Boolean),
      ),
    ],
    F,
  )
}

export async function buildTree(p, F) {
  switch (p.get('type')) {
    case 'player':
      return playerCard({ id: p.get('id'), name: p.get('name') || 'Player', sub: p.get('sub') || '', team: p.get('team') || '' }, F)
    case 'game':
      return gameCard(
        {
          away: p.get('away'),
          home: p.get('home'),
          awayName: p.get('awayName') || 'Away',
          homeName: p.get('homeName') || 'Home',
          awayAbbr: p.get('awayAbbr') || '',
          homeAbbr: p.get('homeAbbr') || '',
          date: p.get('date') || '',
        },
        F,
      )
    case 'team':
      return teamCard({ id: p.get('id'), name: p.get('name') || 'Team', sub: p.get('sub') || '', eyebrow: p.get('eyebrow') || '' }, F)
    default:
      return genericCard({ eyebrow: p.get('eyebrow'), title: p.get('title'), sub: p.get('sub') }, F)
  }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const F = await loadFonts([...searchParams.values()].join(' '))
  const tree = await buildTree(searchParams, F)
  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    fonts: F.fonts,
    headers: {
      // crawlers refetch rarely; let Vercel's edge cache hold the render
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
