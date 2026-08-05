import { useRef } from 'react'
import { TeamTreatmentMark } from './identity/TeamTreatmentMark.jsx'
import { treatmentTile, isMlbTeamId } from '../lib/teams.js'
import { milbTreatmentTile } from '../lib/milbColors.js'
import { readableTextColor } from '../lib/contrast.js'

// The two ink choices a card picks between — --text-heading and --paper-2,
// literally, since readableTextColor needs real hex to run WCAG math against
// (a CSS var reference isn't a color the contrast formula can read).
const INK_DARK = '#16222F'
const INK_LIGHT = '#FBF6E9'

// A jersey's own tile color IS the card now (ADR-pending design pass) — no
// small logo-sized swatch, no knockout recolor. `tint`/`pinstripeColor` are
// the exact values TeamTreatmentMark resolves for its own (now transparent)
// inner box, recomputed here because the component doesn't expose them; the
// only new work is the ink pick, since a card whose own tint is the club's
// navy needs light text same as one whose tint is paper needs dark.
function cardTile(teamId, isMlb, treatment, side) {
  const tile = isMlb ? treatmentTile(teamId, treatment) : side ? milbTreatmentTile(teamId, side) : {}
  const ink = tile.pinstripeColor ? INK_DARK : tile.tint ? readableTextColor(tile.tint, INK_LIGHT, INK_DARK) : INK_DARK
  return { tint: tile.tint, pinstripeColor: tile.pinstripeColor, pinstripeBg: tile.pinstripeBg, ink }
}

// A horizontal, touch-draggable swipe deck of one club's logo/jersey
// combinations — every jersey in its uniform catalog, each card's own
// background tinted to that jersey's actual tile color (the same tint
// TeamTreatmentMark resolves for the slate card and Team Color Lab), with the
// real logo art sitting directly on top — unaltered, even where the mark's
// own navy sinks into a same-colored card. Name and the club's record in the
// games it actually wore that jersey sit below. A jersey maps to exactly one
// logo, but several jerseys can share one (Home White and Road Grey are both
// the Main mark), so a logo repeats down the deck once per jersey assigned to
// it — see buildJerseyCombos (src/api/uniforms.js).
//
// TWO MODES, because the two leagues genuinely carry different data:
//
//   variant="record" (default, MLB) — the strip above, one card per catalog
//     jersey with its per-jersey-worn W-L (buildJerseyCombos' game-by-game
//     join, since an MLB club can wear several different jerseys at the same
//     home/away game).
//   variant="static" (MiLB) — a two-card Home/Away strip. There is no MiLB
//     uniform feed at all (docs/uniforms-and-logos.md), so there is no
//     per-game jersey assignment to join a win to the way MLB's does — but a
//     MiLB affiliate wears exactly one jersey at home and one on the road
//     (src/lib/CLAUDE.md), so its home/away W-L (the standings split, not an
//     invented per-jersey tally) IS the record in each jersey. Each combo
//     simply carries wins/losses straight from the caller (MilbUniformStrip).
//
// Touch drag is native (overflow-x + momentum scrolling); useDragScroll adds
// click-and-drag panning for a mouse so the strip works the same on desktop.
// Spoiler-free: uniform choices plus a record the standings already show.

// A W-L record as "45–30" (en dash), or an em dash when the club hasn't been
// seen in a posted jersey yet (no attributable game) so an unworn/newly-added
// jersey reads as "no games" rather than a misleading 0–0.
function recordLabel({ wins, losses }) {
  return wins + losses === 0 ? '—' : `${wins}–${losses}`
}

// Click-and-drag horizontal panning for a pointer (mouse/trackpad). Touch and
// trackpad-swipe already scroll the overflow container natively, so this only
// arms on a real drag: it grabs the scroller on pointerdown, pans by the
// pointer delta, and suppresses the click that would otherwise fire on a card
// if the pointer actually moved (a plain click still selects text/links).
function useDragScroll() {
  const ref = useRef(null)
  const state = useRef({ down: false, moved: false, startX: 0, startLeft: 0 })

  const onPointerDown = (e) => {
    // Left button / touch only; let the browser own everything else.
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (e.pointerType !== 'mouse') return // native touch scrolling handles this
    const el = ref.current
    if (!el) return
    state.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft }
  }
  const onPointerMove = (e) => {
    const s = state.current
    const el = ref.current
    if (!s.down || !el) return
    const dx = e.clientX - s.startX
    if (Math.abs(dx) > 3) s.moved = true
    if (s.moved) {
      el.scrollLeft = s.startLeft - dx
      el.setPointerCapture?.(e.pointerId)
    }
  }
  const endDrag = () => {
    state.current.down = false
  }
  const onClickCapture = (e) => {
    // Swallow the click that ends a genuine drag so a card underneath the
    // cursor doesn't also register a tap.
    if (state.current.moved) {
      e.stopPropagation()
      e.preventDefault()
      state.current.moved = false
    }
  }

  return {
    ref,
    dragging: state,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onClickCapture,
    },
  }
}

// The two cards a MiLB affiliate's strip shows. `side` (not `treatment`) is
// what TeamTreatmentMark needs to reach milbTreatmentTile — the MLB treatment
// path would answer with the club's plain paper tile instead. `homeRecord` /
// `awayRecord` are the club's own standings splits ({ wins, losses } —
// data/shared.js's splitRecord), degrading to a games-not-yet-played dash via
// recordLabel same as an MLB club's unworn jersey.
export function MilbUniformStrip({ teamId, teamName, homeRecord, awayRecord }) {
  const combos = [
    { side: 'home', name: 'Home', ...(homeRecord ?? { wins: 0, losses: 0 }) },
    { side: 'away', name: 'Away', ...(awayRecord ?? { wins: 0, losses: 0 }) },
  ]
  return <JerseyCombos combos={combos} teamId={teamId} teamName={teamName} variant="static" />
}

export function JerseyCombos({ combos, teamId, teamName, variant = 'record' }) {
  const { ref, handlers } = useDragScroll()
  if (!combos?.length) return null
  const isMlb = isMlbTeamId(teamId)
  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Logos & jerseys</span>
        <em>{variant === 'static' ? 'home and away' : 'record by jersey'}</em>
      </div>
      <div className="thub-card__body" style={{ padding: 0 }}>
        <div className="jerseydeck" ref={ref} {...handlers}>
          {combos.map((c) => {
            const tile = cardTile(teamId, isMlb, c.treatment, c.side)
            const style = {
              '--tint': tile.tint || undefined,
              '--pinstripe-color': tile.pinstripeColor || undefined,
              '--pinstripe-bg': tile.pinstripeBg || undefined,
              '--ink': tile.ink,
            }
            return (
              <div
                key={c.code ?? c.side ?? c.name}
                className={`jerseydeck__card${tile.pinstripeColor ? ' jerseydeck__card--pinstripe' : ''}`}
                style={style}
              >
                <TeamTreatmentMark
                  teamId={teamId}
                  name={teamName}
                  treatment={c.treatment}
                  side={c.side}
                  size={88}
                  block="jerseydeck__logobox"
                />
                <span className="jerseydeck__name">{c.name}</span>
                <span className="jerseydeck__rec mono">{recordLabel(c)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
