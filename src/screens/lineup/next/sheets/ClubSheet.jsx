import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { UniformFigure } from '../../../../components/logo/UniformFigure.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { sketchMarkVariants } from '../../../../lib/markSources.js'
import { treatmentTile } from '../../../../lib/teams.js'
import { SheetFrame } from './SheetFrame.jsx'

// The colours a club wears tonight: the bar, its accent and its ink on the bar, and the
// tile behind the crest. Identity only (ADR-0030). Entries with no colour are left out.
function swatches(theme, tile) {
  return [
    ['Bar', theme?.bar],
    ['Accent', theme?.accent],
    ['Bar ink', theme?.onBar],
    ['Tile', tile?.tint],
  ].filter(([, color]) => color)
}

// The crest's sheet: tonight's uniform, the club's colours, its marks, and Gameday's batter
// figure once both pieces are posted. A bottom sheet like the pitch-mix sheet. "Sketch this
// mark" hands off to the club's pencil-sketch modal. Spoiler-free: identity and art only.
export function ClubSheet({ name, teamId, treatment, theme, uniform, figureUrls, onSketch, onClose }) {
  const tile = treatmentTile(teamId, treatment)
  const colors = swatches(theme, tile)
  return (
    <SheetFrame title="Tonight’s uniform" label={`${name}, uniform and marks`} onClose={onClose}>
      <div className="lsheet__who">
        <strong className="lsheet__name">{name}</strong>
        <p className="lsheet__sub">{uniform || 'Uniform not posted yet'}</p>
      </div>
      {colors.length > 0 && (
        <>
          <h4 className="lsheet__head">Club colors</h4>
          <ul className="lsheet__colors">
            {colors.map(([label, color]) => (
              <li key={label} className="lsheet__color">
                <i className="lsheet__chip" style={{ background: color }} />
                <b>{label}</b>
                <small>{color}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      <h4 className="lsheet__head">Marks</h4>
      <ul className="lsheet__marks">
        {sketchMarkVariants(teamId).map((v) => (
          <li key={v.key} className="lsheet__mark">
            <TeamLogo teamId={teamId} name={name} size={56} variant={v.key} />
            <small>{v.label}</small>
          </li>
        ))}
      </ul>
      {figureUrls && uniform && (
        <>
          <h4 className="lsheet__head">Batter figure</h4>
          <UniformFigure urls={figureUrls} label={uniform} onError={() => {}} />
        </>
      )}
      <Door onClick={onSketch}>Sketch this mark</Door>
    </SheetFrame>
  )
}
