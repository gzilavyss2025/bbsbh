// Dynamic Open Graph / Twitter card image (1200×630 PNG), rendered per
// deep-link route so a shared link previews with its own art:
//   • player  → headshot + name + team/position
//   • game    → both clubs' logos + "AWAY @ HOME" + date
//   • team    → club logo + name + league/division
//   • generic → a labeled brand card for the non-entity screens
//
// Part of the crawler-only link-preview layer (see api/_lib/cards.js and
// docs/adr/0012-dynamic-link-previews.md). The palette is lifted verbatim from
// src/tokens/colors.css — the paper-scorebook look (manila paper, navy ink,
// kraft-tape amber seal) the rest of the app wears.
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
  clay: '#B4453A',
  seal: '#B5824A',
  sealHatch: '#A9743C',
  sealInk: '#1E1405',
  rule: '#CBC1A7',
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

// --- shared frame: paper page + keyline + kraft-tape seal -------------------
function frame(children) {
  return el(
    'div',
    {
      position: 'relative',
      display: 'flex',
      width: '1200px',
      height: '630px',
      backgroundColor: C.paper,
      color: C.navy,
      fontFamily: 'sans-serif',
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
      // kraft-tape strip stamped across the top-right corner
      el(
        'div',
        {
          position: 'absolute',
          top: '52px',
          right: '-64px',
          transform: 'rotate(9deg)',
          display: 'flex',
          backgroundColor: C.seal,
          color: C.sealInk,
          fontSize: '26px',
          fontWeight: 800,
          letterSpacing: '0.14em',
          padding: '14px 90px',
        },
        'SPOILER-SAFE',
      ),
      ...children,
    ],
  )
}

function kicker(text) {
  return el(
    'div',
    {
      display: 'flex',
      fontSize: '28px',
      fontWeight: 700,
      letterSpacing: '0.22em',
      color: C.clay,
    },
    text,
  )
}

function brandFoot() {
  return el(
    'div',
    { display: 'flex', fontSize: '26px', fontWeight: 700, letterSpacing: '0.04em', color: C.graphite },
    'SCOREBOOK HELPER',
  )
}

// --- per-type layouts -------------------------------------------------------

async function playerCard(p) {
  const shot = await fetchImage(headshotSrc(p.id), 'image/png')
  const photoBox = el(
    'div',
    {
      display: 'flex',
      width: '300px',
      height: '360px',
      borderRadius: '20px',
      border: `6px solid ${C.navy}`,
      backgroundColor: C.paperCard,
      alignItems: shot ? 'stretch' : 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    shot
      ? { type: 'img', props: { src: shot, style: { width: '300px', height: '360px', objectFit: 'cover', objectPosition: 'top center' } } }
      : el('div', { display: 'flex', fontSize: '150px', fontWeight: 800, color: C.navy }, initials(p.name)),
  )
  const right = el(
    'div',
    { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '18px' },
    [
      kicker(p.num ? `PLAYER  ${p.num}` : 'PLAYER'),
      el('div', { display: 'flex', fontSize: p.name.length > 18 ? '72px' : '88px', fontWeight: 800, lineHeight: 1.02, color: C.navy }, p.name),
      p.sub ? el('div', { display: 'flex', fontSize: '38px', color: C.ink2 }, p.sub) : null,
      el('div', { display: 'flex', marginTop: '10px' }, brandFoot()),
    ].filter(Boolean),
  )
  return frame([
    el(
      'div',
      { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '56px', width: '100%', height: '100%', padding: '0 96px' },
      [photoBox, right],
    ),
  ])
}

async function logoMark(id, size, fallbackText) {
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
    el('div', { display: 'flex', fontSize: `${Math.round(size * 0.3)}px`, fontWeight: 800, color: C.navy }, fallbackText || '?'),
  )
}

async function gameCard(g) {
  const [awayAbbr, homeAbbr] = (g.label || ' @ ').split('@').map((s) => s.trim())
  const [away, home] = await Promise.all([
    logoMark(g.away, 240, awayAbbr),
    logoMark(g.home, 240, homeAbbr),
  ])
  return frame([
    el(
      'div',
      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '0 80px', gap: '10px' },
      [
        kicker('MATCHUP'),
        el(
          'div',
          { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '48px', marginTop: '8px' },
          [
            away,
            el('div', { display: 'flex', fontSize: '80px', fontWeight: 800, color: C.graphite }, '@'),
            home,
          ],
        ),
        el('div', { display: 'flex', fontSize: '76px', fontWeight: 800, color: C.navy, marginTop: '14px' }, g.label || ''),
        g.date ? el('div', { display: 'flex', fontSize: '36px', color: C.ink2 }, g.date) : null,
      ].filter(Boolean),
    ),
  ])
}

async function teamCard(t) {
  const mark = await logoMark(t.id, 320, initials(t.name))
  const right = el(
    'div',
    { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '18px' },
    [
      kicker(t.kicker || 'TEAM'),
      el('div', { display: 'flex', fontSize: t.name.length > 20 ? '68px' : '82px', fontWeight: 800, lineHeight: 1.03, color: C.navy }, t.name),
      t.sub ? el('div', { display: 'flex', fontSize: '38px', color: C.ink2 }, t.sub) : null,
      el('div', { display: 'flex', marginTop: '10px' }, brandFoot()),
    ].filter(Boolean),
  )
  return frame([
    el(
      'div',
      { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '56px', width: '100%', height: '100%', padding: '0 96px' },
      [mark, right],
    ),
  ])
}

function genericCard(gc) {
  return frame([
    el(
      'div',
      { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', width: '100%', height: '100%', padding: '0 104px', gap: '20px' },
      [
        kicker(gc.kicker || 'SCOREBOOK HELPER'),
        el('div', { display: 'flex', fontSize: '92px', fontWeight: 800, lineHeight: 1.0, color: C.navy }, gc.title || 'Scorebook Helper'),
        gc.sub ? el('div', { display: 'flex', fontSize: '38px', color: C.ink2, maxWidth: '900px' }, gc.sub) : null,
        el('div', { display: 'flex', marginTop: '12px' }, brandFoot()),
      ].filter(Boolean),
    ),
  ])
}

export async function buildTree(p) {
  switch (p.get('type')) {
    case 'player':
      return playerCard({ id: p.get('id'), name: p.get('name') || 'Player', sub: p.get('sub') || '', num: p.get('num') || '' })
    case 'game':
      return gameCard({ away: p.get('away'), home: p.get('home'), label: p.get('label') || '', date: p.get('date') || '' })
    case 'team':
      return teamCard({ id: p.get('id'), name: p.get('name') || 'Team', sub: p.get('sub') || '', kicker: p.get('kicker') || 'TEAM' })
    default:
      return genericCard({ kicker: p.get('kicker'), title: p.get('title'), sub: p.get('sub') })
  }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const tree = await buildTree(searchParams)
  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    headers: {
      // crawlers refetch rarely; let Vercel's edge cache hold the render
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
