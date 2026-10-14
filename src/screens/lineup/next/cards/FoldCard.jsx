import { useId, useState } from 'react'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { headerThemeClass, headerThemeStyle } from '../../../../lib/headerTheme.js'

// A stamped card folded shut until its head is tapped (Former teammates, Bullpen). The head
// is the button; the body mounts only when open, so nothing inside it loads or draws first.
// With `band` ({ teamId, teamName, masthead, season, theme }) the head wears that club's band and
// mono mark (the Bullpen is the OTHER club's); without it the head is plain paper with the
// count in a small box.
export function FoldCard({ title, count, band = null, className = '', children }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const themed = band ? { className: headerThemeClass(band.theme), style: headerThemeStyle(band.theme, band.masthead.scale) } : {}
  return (
    <Card as="div" frame="stamped" body="flush" className={`lfold ${themed.className ?? ''} ${className}`.trim()} style={themed.style}>
      <h3 className="lfold__title">
        <button
          type="button"
          className={`lfold__head${band ? ' lfold__head--band sectionhead--band' : ''}`}
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="lfold__name">{title}</span>
          {count != null && <span className="lfold__count">{count}</span>}
          {band && (
            <TeamLogo
              teamId={band.teamId}
              name={band.teamName}
              size={22}
              variant="mono"
              crop="bar"
              overrideUrl={band.masthead.url}
              season={band.season}
              className={`sectionhead__mark${band.masthead.url ? ' sectionhead__mark--custom' : ''}`}
            />
          )}
          <span className="lfold__chev" aria-hidden="true" />
        </button>
      </h3>
      {open && (
        <div className="lfold__body" id={bodyId}>
          {children}
        </div>
      )}
    </Card>
  )
}
