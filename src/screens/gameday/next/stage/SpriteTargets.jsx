import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'

// Real semantic player links over the painted figures. Their positions follow the canvas
// without React updates per frame; PlayerLink owns the shared hover/focus and tap behavior.
export function SpriteTargets({ targets, elements }) {
  return targets.map((p) => (
    <div key={p.key} hidden className="gdstage__target" ref={(el) => { if (el) elements.current.set(p.key, el); else elements.current.delete(p.key) }}>
      <PlayerLink id={p.id} name={p.name} ariaLabel={p.role + ': ' + p.name} className="gdstage__player">
        <span className="sr-only">{p.name}</span>
      </PlayerLink>
    </div>
  ))
}
