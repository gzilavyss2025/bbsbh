import { useMemo, useState } from 'react'
import { customMarkAssignment, customMarksFor } from '../../../lib/customMarks.js'
import { monoLogoParts, monoLogoPickerSvg, monoLogoSvg } from '../../../lib/logoMono.js'
import { sanitizeSvgMarkup } from '../../../lib/svgSanitize.js'
import { CITY_CONNECT_MASTHEAD_KEY, cityConnectMastheadUrl } from '../../../lib/teams.js'
import { HexField } from '../HexField.jsx'
import { HeaderBarMock } from './HeaderPreview.jsx'
import { ShapeInkPicker, flipVerdict } from './ShapeInkPicker.jsx'
import { assignCustomMark, saveCustomMark } from '../saveStores.js'

// Paste a finished mark in as SVG source, name it, and let the City Connect
// bar wear it — the one bar a club may take off the automatic knockout mark
// (ADR-0031's second amendment).
//
// Why paste rather than upload: the knockout mark next door is a CONVERSION of
// the CDN's art, and a club's City Connect identity is sometimes its own thing
// entirely — a wordmark, an alternate crest — that no amount of ink/knockout
// pinning reproduces, because the source art isn't that design. The amendment
// already allowed a dropped-in PNG for exactly this; SVG source is the same
// escape hatch for art that arrives as markup rather than as a file, and it
// stays crisp at the bar's full bleed where a 512px PNG does not.
//
// Nothing here is new machinery. A paste rides the SAME two dev endpoints the
// Logo art editor's recolors ride (scripts/lib/dev-custom-marks.mjs): SAVE
// writes public/team-logos/custom/{teamId}-{slug}.svg and adds it to the club's
// library, ASSIGN points one key at one library mark. The key is the synthetic
// 'city-connect-masthead' — never a real treatment, so no jersey's Replace-art
// select can see it and no tuning store has an entry for it.
//
// The two rules the library already had, and this inherits:
//   • Saving never overwrites. A name already taken is refused with a 409.
//   • Wearing one is a POINTER. Clearing it hands back whatever the bar had —
//     an uploaded PNG, or the club-wide knockout mark.
//
// TWO WAYS TO SAVE A PASTE, and the second is why this panel carries a shape
// picker of its own:
//
//   AS PASTED   the markup, verbatim. Finished art in the club's own colors.
//   KNOCKOUT    logoMono.js's conversion of it, with the same ink/knockout
//               pinning the editor above offers — for art that arrives in full
//               color but wants to read as one-color on this bar.
//
// The knockout route BAKES ITS INK IN rather than leaving the conversion's own
// white. logoMono.js emits `fill="#fff"` because the club-wide mono mark is
// re-inked at render time by CSS; this slot's whole contract is the opposite
// (`.metricbar__logo--custom` turns that filter back off, ADR-0031's second
// amendment), so a white silhouette saved here would simply vanish on a light
// bar. Picking the color at save time keeps that contract intact — what lands
// on disk is finished art either way, and this panel never becomes a second
// thing the renderer has to know about.
//
// Dev-only, like the rest of the lab (ADR-0029).

const PASTE_PLACEHOLDER = '<svg viewBox="0 0 512 512" …>'

// The ink swatches offered beside the hex field: this bar's own text color
// first, since a mark that reads like the bar's lettering is the usual answer,
// then its accent, then the two ends of the scale for a bar either of them
// suits. A club whose bar is unset falls back to the same navy chrome the app
// does, so the quick picks are never empty.
function inkChoices(colors) {
  return [
    { label: 'On bar', hex: colors?.onBar ?? '#FFFFFF' },
    { label: 'Accent', hex: colors?.accent ?? '#C8963E' },
    { label: 'White', hex: '#FFFFFF' },
    { label: 'Black', hex: '#111111' },
  ]
}

// logoMono.js closes its markup with `<rect … fill="#fff" mask="url(#id)"/>` —
// the one place the drawn color appears (the mask's own `<g fill="#fff">` is
// mask space and must stay white). Swapping that one attribute is how the
// conversion gets an ink color without logoMono.js growing an option the
// generator would then have to carry too.
//
// Returns null when the swap finds nothing, rather than a white mark quietly
// saved as if it were inked: that means logoMono.js's output shape moved, and
// the panel says so instead of writing art nobody asked for.
// Whether a quick-pick swatch is the ink currently in the field. Two hex
// strings, compared case-blind because the field is typed by hand and the
// swatches are literals here.
function sameHex(a, b) {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase() // caps-js-exempt — hex values, not rendered text
}

function inkConversion(converted, maskId, ink) {
  const target = `fill="#fff" mask="url(#${maskId})"`
  if (!converted?.includes(target)) return null
  return converted.replace(target, `fill="${ink}" mask="url(#${maskId})"`)
}

export function MastheadMarkEditor({ teamId, name, cityConnect }) {
  const [markup, setMarkup] = useState('')
  const [markName, setMarkName] = useState('')
  const [state, setState] = useState(null)

  // The committed store is what these two read, and the dev endpoint has just
  // rewritten it on disk — but the JSON module in this page's graph is whatever
  // Vite last handed over. Both keep a session-local override so a save and an
  // assignment show up immediately instead of waiting on an HMR round trip.
  const [savedHere, setSavedHere] = useState([])
  const [wornOverride, setWornOverride] = useState(null)

  const landedLibrary = customMarksFor(teamId)
  const library = useMemo(
    () => [...landedLibrary, ...savedHere.filter((m) => !landedLibrary.some((l) => l.slug === m.slug))],
    [landedLibrary, savedHere],
  )
  const worn = wornOverride ?? customMarkAssignment(teamId, CITY_CONNECT_MASTHEAD_KEY)

  // The draft is sanitized by a real parser before anything looks at it
  // (src/lib/svgSanitize.js), so what previews here is what posts — and markup
  // that doesn't parse as SVG says so before a request is made rather than
  // coming back as a server rejection.
  const draft = useMemo(() => (markup.trim() ? sanitizeSvgMarkup(markup) : null), [markup])
  const draftBroken = Boolean(markup.trim()) && !draft

  // The knockout half. Pins start empty on every fresh paste — they are indices
  // into THIS art's shapes, so they can't outlive it (the same reason
  // MonoInkEditor drops its draft pins when the source picker changes).
  const [knockout, setKnockout] = useState(false)
  const [pins, setPins] = useState({})
  const [ink, setInk] = useState(null)
  const inkHex = ink ?? inkChoices(cityConnect?.colors).at(0).hex

  // Same modules, same shape numbering, as the editor above (logoMono.js) — so
  // shape 3 here is shape 3 there. `parts` and the clickable art come off the
  // SANITIZED draft, which is also what gets converted, so the numbering can't
  // drift between what is clicked and what is saved.
  const parts = useMemo(() => (draft ? monoLogoParts(draft) : []), [draft])
  const picker = useMemo(() => (draft ? monoLogoPickerSvg(draft) : null), [draft])
  const maskId = `idlab-ccmark-${teamId}`
  const converted = useMemo(
    () => (draft ? monoLogoSvg(draft, { maskId, pins }) : null),
    [draft, maskId, pins],
  )
  const inked = converted ? inkConversion(converted, maskId, inkHex) : null
  // Art with no shapes to classify — an embedded raster, or no viewBox to
  // convert against (logoMono.js's own bail). Offering the toggle for it would
  // promise a conversion that can't happen, so the mode is withdrawn instead.
  const convertible = Boolean(draft) && parts.length > 0 && Boolean(converted)

  // What actually gets written, and what the bar previews — one value, so the
  // preview can never show something other than what Save posts.
  //
  // Knockout mode with no usable conversion answers NULL rather than falling
  // back to the pasted art. `convertible` can go false while the mode is on —
  // pin away the last ink shape and logoMono.js rightly bails on a mark with
  // nothing left to draw — and quietly saving the full-color paste at that
  // moment would hand back the one thing the mode was turned on to avoid.
  const outgoing = knockout ? (convertible ? inked : null) : draft

  // The bar draws the paste in progress if there is one, else whatever this
  // club's bar actually wears today. `worn` is consulted before the resolver for
  // the same session-lag reason as above.
  const wornUrl = library.find((m) => m.slug === worn)?.url ?? null
  const previewUrl = outgoing
    ? `data:image/svg+xml,${encodeURIComponent(outgoing)}`
    : (wornUrl ?? cityConnectMastheadUrl(teamId))

  function toggleShape(index) {
    setPins((prev) => ({ ...prev, [String(index)]: flipVerdict(parts, prev, index) }))
    setState(null)
  }

  async function save() {
    if (!outgoing || !markName.trim()) return
    setState({ kind: 'note', text: 'Saving' })
    const result = await saveCustomMark({ teamId, name: markName.trim(), svg: outgoing })
    if (result.error) {
      setState({ kind: 'error', text: result.error })
      return
    }
    setSavedHere((prev) => [...prev, { slug: result.slug, name: result.name, url: result.url }])
    // The pins go with the art they were picked against — a fresh paste starts
    // from automatic, never from answers pointing at a previous mark's shapes.
    setMarkup('')
    setMarkName('')
    setPins({})
    setState({ kind: 'ok', text: `saved as “${result.name}” — pick it below to put it on the bar` })
  }

  async function wear(slug) {
    setState({ kind: 'note', text: slug ? 'Putting it on the bar' : 'Taking it off the bar' })
    const result = await assignCustomMark({ teamId, treatment: CITY_CONNECT_MASTHEAD_KEY, slug })
    if (result.error) {
      setState({ kind: 'error', text: result.error })
      return
    }
    setWornOverride(slug)
    setState({
      kind: 'ok',
      text: slug
        ? 'this bar wears it now — every other bar keeps the knockout mark'
        : 'back to the automatic knockout mark',
    })
  }

  // A club with no City Connect bar has nothing for this panel to dress — a
  // MiLB affiliate (whose vocabulary has no City Connect at all), or one of the
  // two MLB clubs teams.js's hasCityConnect excludes. The resolver answers null
  // for them, so an editor here could only write an assignment nothing reads.
  // After the hooks, deliberately: this component is mounted per club by key.
  if (!cityConnect) return null

  return (
    <section className="idlab__mastheadmark" aria-label="City Connect bar mark">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">City Connect bar mark</span>
        <span className="idlab__monoinkhint">
          {worn ? 'Wearing a pasted mark' : 'Automatic knockout mark'}
        </span>
      </div>

      <p className="idlab__monoinkhint">
        Paste a mark for this one bar. Every other bar — Main and each alternate — keeps the
        club-wide knockout mark beside this panel, untouched. Keep the pasted colors, or convert it
        to a one-color knockout below and pick the ink; either way what lands is finished art, so
        nothing recolors it on the page.
      </p>

      <HeaderBarMock
        teamId={teamId}
        name={name}
        colors={cityConnect.colors}
        unset={cityConnect.unset}
        overrideUrl={previewUrl}
      />

      <textarea
        className="idlab__mastheadsource"
        value={markup}
        onChange={(e) => {
          setMarkup(e.target.value)
          setState(null)
        }}
        placeholder={PASTE_PLACEHOLDER}
        aria-label="SVG source for this club's City Connect bar mark"
        spellCheck="false"
        rows={4}
      />

      {draftBroken && <p className="idlab__monoinkwarn">That doesn’t parse as SVG — paste the whole file, opening tag and all.</p>}

      {draft && (
        <div className="idlab__mastheadmode" role="group" aria-label="How to save this mark">
          <button
            type="button"
            className={`idlab__monoinksourcebtn${knockout ? '' : ' idlab__monoinksourcebtn--active'}`}
            aria-pressed={!knockout}
            onClick={() => setKnockout(false)}
          >
            As pasted
          </button>
          <button
            type="button"
            className={`idlab__monoinksourcebtn${knockout ? ' idlab__monoinksourcebtn--active' : ''}`}
            aria-pressed={knockout}
            onClick={() => setKnockout(true)}
            disabled={!convertible}
            title={convertible ? 'Re-ink this art as a one-color knockout' : 'This art has no shapes to classify'}
          >
            Knockout
          </button>
          {knockout && convertible && (
            <>
              {inkChoices(cityConnect.colors).map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  // caps-js-exempt — comparing two hex strings, not casing rendered text
                  className={`idlab__mastheadink${sameHex(choice.hex, inkHex) ? ' idlab__mastheadink--on' : ''}`}
                  style={{ background: choice.hex }}
                  onClick={() => setInk(choice.hex)}
                  title={`Ink this mark in ${choice.label} (${choice.hex})`}
                  aria-label={`Ink ${choice.label}`}
                />
              ))}
              <HexField value={inkHex} onChange={(v) => setInk(v)} placeholder="ink" />
            </>
          )}
        </div>
      )}

      {/* The same shape-by-shape verdicts the Knockout mark editor above takes,
          on this paste instead of on the club's CDN art — one shape means one
          thing in both (logoMono.js numbers them once). Only shown in knockout
          mode: as-pasted art keeps every fill it arrived with, so there is
          nothing to classify. */}
      {knockout && convertible && (
        <ShapeInkPicker picker={picker} parts={parts} pins={pins} onToggle={toggleShape} />
      )}

      {knockout && convertible && Object.keys(pins).length > 0 && (
        <button type="button" className="colorlab__wparesetbtn" onClick={() => setPins({})}>
          Reset to automatic
        </button>
      )}

      {knockout && draft && !convertible && (
        <p className="idlab__monoinkwarn">
          {parts.length === 0
            ? 'This art has no shapes to classify — an embedded image, or no viewBox to convert against. Save it as pasted instead.'
            : 'Nothing left to draw — every shape reads as knockout. Put one back to ink, or save it as pasted.'}
        </p>
      )}

      {knockout && converted && !inked && (
        <p className="idlab__monoinkwarn">
          Couldn’t ink this conversion — logoMono.js’s output shape has moved, so inkConversion found
          nothing to swap. Fix that before saving; a white mark would vanish on a light bar.
        </p>
      )}

      <div className="idlab__recolorsave">
        <input
          className="idlab__recolorname"
          type="text"
          placeholder="Name this mark"
          aria-label="Name this mark"
          value={markName}
          onChange={(e) => setMarkName(e.target.value)}
        />
        <button
          type="button"
          className="colorlab__wparesetbtn"
          onClick={save}
          disabled={!outgoing || !markName.trim()}
          title={
            outgoing
              ? `Save this mark into ${name}'s library`
              : knockout && draft
                ? 'This paste has no knockout to save — see the note above'
                : 'Paste some SVG first'
          }
        >
          {knockout ? 'Save knockout as new mark' : 'Save as new mark'}
        </button>
      </div>

      {/* The same library the Logo art editor saves into, so a recolor built
          there can dress this bar without being pasted again. Assigning takes
          effect on change, like LogoDropZone's Replace-art select. */}
      <label className="idlab__mastheadwear">
        <span>This bar wears</span>
        <select value={worn} onChange={(e) => wear(e.target.value)}>
          <option value="">Automatic knockout mark</option>
          {library.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {state && <p className={`colorlab__logodropmsg colorlab__logodropmsg--${state.kind}`}>{state.text}</p>}
    </section>
  )
}
