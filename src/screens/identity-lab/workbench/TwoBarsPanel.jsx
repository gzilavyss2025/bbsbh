import { CopyIconButton } from '../../../components/ui/CopyBox.jsx'
import { HeaderBarMock, HeaderFields, UmpireCall } from '../editors/HeaderPreview.jsx'
import { MarkImage } from './MarkImage.jsx'

// A club has two header bars, not one per jersey — Main's, which every
// alternate also wears, and City Connect's (a MiLB level has Home's and
// Away's). That fact used to be inferable only from the absence of an editor on
// four of five tiles. Here it's the club's most prominent structure: both bars
// side by side at the top of the workbench, each with the jerseys that wear it
// hanging off its bottom edge on short strings.
//
// This is the ONLY place a header is editable. Hovering a unit lights the rack
// chips that wear it (`onHover`), and each of those chips carries this bar's
// color as a tick — the same relationship said three ways, editable in one.
export function TwoBarsPanel({ units, onHover, onSelectWearer }) {
  if (!units.length) return null
  return (
    <section className="idlab__bars" aria-label="Header bars">
      <p className="idlab__barslead">Header bars — every jersey wears one of these.</p>
      <div className="idlab__barsrow">
        {units.map((unit) => (
          <BarUnit key={unit.slot} unit={unit} onHover={onHover} onSelectWearer={onSelectWearer} />
        ))}
      </div>
    </section>
  )
}

function BarUnit({ unit, onHover, onSelectWearer }) {
  const { header } = unit
  return (
    <div
      className="idlab__barunit"
      id={unit.anchorId}
      tabIndex={-1}
      onMouseEnter={() => onHover(unit.slot)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(unit.slot)}
      onBlur={() => onHover(null)}
    >
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">{unit.label}</span>
        <span
          className={`colorlab__headercoverage${header.landed ? ' colorlab__headercoverage--on' : ''}`}
          title={
            header.landed
              ? 'This club wears these colors on its lineup page in this jersey.'
              : 'No landed entry — the lineup page falls back to default navy chrome for this jersey.'
          }
        >
          {header.landed ? 'Themed' : 'Default chrome'}
        </span>
        {header.hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={header.onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={header.copyText} label={`Copy ${unit.name} ${unit.label} header-color context`} />
      </div>

      <HeaderBarMock teamId={unit.teamId} name={unit.name} colors={header.colors} unset={header.unset} />

      <div className="idlab__wearers">
        {unit.wearers.map((wearer) => (
          <button
            key={wearer.key}
            type="button"
            className="idlab__wearer"
            onClick={() => onSelectWearer(wearer.key)}
            title={`Work on ${wearer.label}`}
          >
            <span className="idlab__wearerstring" aria-hidden="true" />
            <span className="idlab__wearermark">
              <span className={wearer.visual.className} style={wearer.visual.style}>
                <MarkImage url={wearer.visual.url} alt="" />
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="idlab__wearercaption">{unit.wearerCaption}</p>

      <HeaderFields rawColors={header.rawColors} onField={header.onField} />
      <UmpireCall contrast={header.contrast} />
    </div>
  )
}
