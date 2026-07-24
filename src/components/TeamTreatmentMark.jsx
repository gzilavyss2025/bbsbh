import { TeamLogo } from './TeamLogo.jsx'
import { treatmentTile, isMlbTeamId } from '../lib/teams.js'
import { milbTreatmentTile } from '../lib/milbColors.js'

// A club's mark on the tinted tile of whatever uniform treatment it's wearing
// — the "square" the slate card and the in-game masthead both show. The look
// (which mark, what fill, how far to overscale it) comes from one resolver,
// lib/teams.js's treatmentTile; this component is just the markup, so a
// surface adopting the tile only has to bring its own class and size.
//
// `block` is the tile's own block class (.gamecard__logobox,
// .masthead__logobox, …) and owns the box's size/shape/border; a pinstriped
// club gets `{block}--pinstripe` on top, so each surface styles its own
// pinstripe the way it styles its own fill. `className` appends anything
// else the caller needs (side modifiers, layout classes). The only shared
// CSS contract is the three custom properties below, which every tile
// stylesheet reads the same way.
//
// EDGE_BLEED overscales the mark past its own box so a tile reads as a
// cropped, printed-on-the-uniform patch rather than a logo floating in a
// frame; the box's own `overflow: hidden` does the cropping. A club whose
// mark is dense enough to need it scales back down via its curated
// per-treatment `scale` (teams.js), which multiplies in here.
//
// Never score-revealing: a jersey choice, not a game state.
const EDGE_BLEED = 1.32

const NO_TILE = { logoVariant: 'base', tint: null, offsetX: 0, offsetY: 0, pinstripeColor: null, pinstripeBg: null, scale: 1 }

export function TeamTreatmentMark({ teamId, name, treatment, side, size, block, className = '' }) {
  // A MiLB affiliate reads its tile from milbColors.js's Home/Away tables
  // instead — the MLB per-treatment system above has no coverage for it (see
  // milbColors.js's module doc for why the two stay separate). That table is
  // keyed by game side, so a caller with no game context (Team Hub's club
  // page, JerseyCombos' lab preview) gets the old plain-paper tile rather
  // than an arbitrary guessed side.
  const { logoVariant, tint, offsetX, offsetY, pinstripeColor, pinstripeBg, scale } = isMlbTeamId(teamId)
    ? { offsetX: 0, offsetY: 0, ...treatmentTile(teamId, treatment) }
    : side
      ? milbTreatmentTile(teamId, side)
      : NO_TILE
  const style = {
    '--tint': tint || undefined,
    '--scale': EDGE_BLEED * scale,
    '--offset-x': offsetX ? `${offsetX}%` : undefined,
    '--offset-y': offsetY ? `${offsetY}%` : undefined,
    '--pinstripe-color': pinstripeColor || undefined,
    '--pinstripe-bg': pinstripeBg || undefined,
  }
  const cls = [block, pinstripeColor ? `${block}--pinstripe` : '', className].filter(Boolean).join(' ')
  return (
    <div className={cls} style={style}>
      <TeamLogo teamId={teamId} name={name} size={size} variant={logoVariant} />
    </div>
  )
}
