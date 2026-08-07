import { useState } from 'react'
import { CopyIconButton } from '../../../components/ui/CopyBox.jsx'
import { mastheadMarkUrl } from '../../../lib/teams.js'
import { HeaderBarMock, HeaderFields, UmpireCall } from '../editors/HeaderPreview.jsx'
import { MastheadMarkEditor } from '../editors/MastheadMarkEditor.jsx'
import { LogoDropZone } from '../LogoDropZone.jsx'
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
        {/* Keyed by club as well as slot: a unit now holds per-club state of its
            own (a fresh upload's cache-buster, the mark panel's pending
            preview), and re-using one instance across a club switch would carry
            the previous club's answers into the new one's bar. */}
        {units.map((unit) => (
          <BarUnit
            key={`${unit.teamId}-${unit.slot}`}
            unit={unit}
            onHover={onHover}
            onSelectWearer={onSelectWearer}
          />
        ))}
      </div>
    </section>
  )
}

// EVERY bar carries its own mark panel (MastheadMarkEditor, at the foot of the
// unit): paste SVG source and this bar's mastheads draw it instead of the
// club-wide knockout mark every other bar still shares (teams.js's
// mastheadMarkUrl, ADR-0031's addendum). Editable here because it is judged
// here — against this exact bar, in this club's own colours.
//
// The City Connect bar has a SECOND way in, and only it: a dropped PNG on the
// mock itself (the earlier amendment, which gave that one bar an upload
// directory). Hence the drop zone below is still City-Connect-only while the
// panel is not.
//
// `mastheadVersion` bumps on every successful UPLOAD so the mock re-fetches the
// just-written bytes instead of a stale browser cache of the same URL — the same
// `?v=` trick JerseyBench's own art uploads use. A paste never needs it: a saved
// mark lands at a URL nothing has requested before.
//
// The panel reports what IT is responsible for — a paste in progress, or the
// library mark this bar now wears — and this unit draws that ahead of its own
// resolution. Each owns one rung, so a fresh upload's `?v=` can't be lost behind
// a panel that answers for the same URL without one.
function BarUnit({ unit, onHover, onSelectWearer }) {
  const { header } = unit
  const isCityConnect = unit.slot === 'city-connect'
  const [mastheadVersion, setMastheadVersion] = useState(0)
  const [panelOverride, setPanelOverride] = useState(null)
  const rawMastheadUrl = unit.mastheadBar ? mastheadMarkUrl(unit.teamId, unit.mastheadBar) : null
  const mastheadUrl =
    rawMastheadUrl && mastheadVersion > 0 ? `${rawMastheadUrl}?v=${mastheadVersion}` : rawMastheadUrl

  const mock = (
    <HeaderBarMock
      teamId={unit.teamId}
      name={unit.name}
      colors={header.colors}
      unset={header.unset}
      overrideUrl={panelOverride ?? mastheadUrl}
    />
  )

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

      {isCityConnect ? (
        <>
          <LogoDropZone
            teamId={unit.teamId}
            treatment="city-connect-masthead"
            label={`${unit.name} City Connect masthead mark`}
            onUploaded={() => setMastheadVersion((v) => v + 1)}
          >
            {mock}
          </LogoDropZone>
          <p className="idlab__barmastheadhint">
            {mastheadUrl
              ? 'Custom mark — this bar draws it instead of the automatic knockout mark.'
              : 'Automatic knockout mark.'}{' '}
            Drop a 512×512 PNG, transparent background, under 400 KB — colors print as-is (not
            auto-recolored), so paint it in whatever reads against this exact bar. Art that arrives
            as SVG source goes in this bar&rsquo;s own mark panel below instead.
          </p>
        </>
      ) : (
        mock
      )}

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

      {/* Last in the unit, not between the bar and its strings: those strings
          hang off the bar's bottom edge and that connection is the panel's own
          idea. The mark it edits still previews on the bar at the top of this
          card, which is the whole reason it lives in here. */}
      {unit.mastheadBar && (
        <MastheadMarkEditor
          key={`barmark-${unit.teamId}-${unit.mastheadBar}`}
          teamId={unit.teamId}
          name={unit.name}
          bar={unit.mastheadBar}
          barLabel={unit.label}
          colors={header.colors}
          onPreview={setPanelOverride}
        />
      )}
    </div>
  )
}
