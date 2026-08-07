import { useMemo, useState } from 'react'
import { customMarkAssignment, customMarksFor } from '../../../lib/customMarks.js'
import { sanitizeSvgMarkup } from '../../../lib/svgSanitize.js'
import { CITY_CONNECT_MASTHEAD_KEY, cityConnectMastheadUrl } from '../../../lib/teams.js'
import { HeaderBarMock } from './HeaderPreview.jsx'
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
// Dev-only, like the rest of the lab (ADR-0029).

// Colors print as-is: this bar's mark is finished art, so nothing re-inks it at
// render time the way the mono mark's mask does (.metricbar__logo--custom, and
// its preview twin .idlab__barmock__logo--custom). Said on the panel too — it
// is the one thing that surprises people about this slot.
const PASTE_PLACEHOLDER = '<svg viewBox="0 0 512 512" …>'

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

  // What the bar draws in the preview: the paste in progress if there is one,
  // else whatever this club's bar actually wears today. `worn` is consulted
  // before the resolver for the same session-lag reason as above.
  const wornUrl = library.find((m) => m.slug === worn)?.url ?? null
  const previewUrl = draft
    ? `data:image/svg+xml,${encodeURIComponent(draft)}`
    : (wornUrl ?? cityConnectMastheadUrl(teamId))

  async function save() {
    if (!draft || !markName.trim()) return
    setState({ kind: 'note', text: 'Saving' })
    const result = await saveCustomMark({ teamId, name: markName.trim(), svg: draft })
    if (result.error) {
      setState({ kind: 'error', text: result.error })
      return
    }
    setSavedHere((prev) => [...prev, { slug: result.slug, name: result.name, url: result.url }])
    setMarkup('')
    setMarkName('')
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
        Paste a finished mark for this one bar. Every other bar — Main and each alternate — keeps the
        club-wide knockout mark beside this panel, untouched. Colors print as-is, so draw it in
        whatever reads against this exact bar.
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
          disabled={!draft || !markName.trim()}
          title={draft ? `Save this mark into ${name}'s library` : 'Paste some SVG first'}
        >
          Save as new mark
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
