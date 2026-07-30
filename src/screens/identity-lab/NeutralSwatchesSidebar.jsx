import { CopyIconButton } from '../../components/CopyBox.jsx'

// Quick-reuse neutrals for the hex fields — an affiliate's Away variation, an
// MLB treatment with no researched color, or an unresolved team's placeholder
// tile, often wants a plain neutral rather than either researched brand
// color, and typing one from memory invites a typo a click-to-copy value
// doesn't. Two steps each of cream/off-white/grey (a lighter and a darker),
// plus pure white/black, a common "road grey" jersey tone, and a navy that
// recurs as the primary or secondary for a large cluster of researched clubs
// — handy as a one-click starting point rather than hunting one of THOSE
// teams' own swatches down. Ordered light to top, dark to bottom (by plain
// RGB-average lightness) — a spectrum reads faster than an alphabetical list
// when the whole point is "grab the shade I want." Shared by both colour
// dimensions (MLB, MiLB) — see profiles/mlb.jsx and profiles/milb.jsx.
const NEUTRAL_SWATCHES = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Off-white (light)', hex: '#FFFDF6' },
  { label: 'Paper white', hex: '#F8F8F5' },
  { label: 'Ivory', hex: '#FBF6ED' },
  { label: 'Eggshell', hex: '#F5F3EE' },
  { label: 'Cream (light)', hex: '#F6EFDC' },
  { label: 'Off-white (dark)', hex: '#F3ECD8' },
  { label: 'Cream (dark)', hex: '#E8DCC0' },
  { label: 'Grey (light)', hex: '#D0D0D0' },
  { label: 'Road grey', hex: '#9EA2A2' },
  { label: 'Grey (dark)', hex: '#4A4A4A' },
  { label: 'Common navy', hex: '#0C2340' },
  { label: 'Off-black (warm)', hex: '#241F1B' },
  { label: 'Off-black', hex: '#1C1C1C' },
  { label: 'Off-black (cool)', hex: '#101820' },
  { label: 'Off-black (deep)', hex: '#141414' },
  { label: 'Black', hex: '#000000' },
]

export function NeutralSwatchesSidebar() {
  return (
    <aside className="milbneutrals" aria-label="Quick-reuse neutral colors">
      <span className="milbneutrals__title">Neutrals</span>
      {NEUTRAL_SWATCHES.map((s) => (
        <div className="milbneutrals__row" key={s.hex}>
          <span className="milbneutrals__text">
            <span className="milbneutrals__label">{s.label}</span>
            <span className="milbneutrals__hex">{s.hex}</span>
          </span>
          <CopyIconButton text={s.hex} label={`Copy ${s.label} (${s.hex})`} />
          <div className="milbneutrals__chip" style={{ background: s.hex }} />
        </div>
      ))}
    </aside>
  )
}
