import { useMemo, useState } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import {
  monoLogoFingerprint,
  monoLogoParts,
  monoLogoPickerSvg,
  monoLogoSvg,
} from '../../../lib/logoMono.js'
import { monoInkFor, monoInkStore } from '../../../lib/monoInk.js'
import { sanitizeSvgMarkup } from '../../../lib/svgSanitize.js'
import { barMarkTone } from '../../../lib/headerTheme.js'
import { regenerateMonoLogo, saveStores } from '../saveStores.js'

// Pick, by eye, which SHAPES of a club's logo are the mark and which are the
// paper it's drawn against — the hand correction to logoMono.js's automatic
// classifier, which is a heuristic over art nobody controls and is therefore
// sometimes wrong about a specific shape (ADR-0031).
//
// The loop this closes: the club's real art is loaded here, clicking a shape
// pins it to ink or knockout, the preview beside it is the ACTUAL converted
// mark on that club's real header bar, and Save writes the pins plus asks the
// dev server to regenerate public/data/logos/mono/{teamId}.svg with them. Same
// converter in all three places, so nothing shown here is a mock-up of what the
// real file would be.
//
// Dev-only, like the rest of the lab (ADR-0029): the save endpoint only exists
// under `vite dev`, and the screen itself is DEV-gated in App.jsx.

const LOGO_CDN = 'https://www.mlbstatic.com/team-logos'

// Clicking cycles rather than opening a menu — with two verdicts and an
// "unpinned" state, a three-step cycle is one gesture per shape and reads
// straight off the preview.
const NEXT_VERDICT = { auto: 'ink', ink: 'knockout', knockout: 'auto' }

const VERDICT_LABEL = {
  auto: 'Automatic',
  ink: 'Ink — part of the mark',
  knockout: 'Knockout — the paper behind it',
}

// Navy is what an unthemed club's masthead actually is, and most of the app's
// mastheads are unthemed (header coverage is partial by design), so the mark
// gets judged there as well as on this club's own bar.
const DEFAULT_CHROME_BAR = '#12233F'

export function MonoInkEditor({ teamId, name, bars }) {
  // Both forms of the art, and the split between them matters.
  //
  // The RAW markup is what everything measured against the generator uses —
  // the fingerprint, the shape list, the converted preview — because
  // scripts/lib/mono-logo-art.mjs converts raw CDN bytes, and a fingerprint
  // taken from anything else could read as stale server-side and silently drop
  // this club's pins at generation time.
  //
  // The SANITIZED form is used for exactly one thing: the markup inlined into
  // the document so shapes can be clicked (src/lib/svgSanitize.js — a parser,
  // not a filter). Shape numbering survives the round trip because sanitizing
  // only ever removes script/foreignObject-class elements and `on*` attributes,
  // none of which are drawable, so the two forms enumerate the same shapes in
  // the same order.
  const art = useAsync(async () => {
    const res = await fetch(`${LOGO_CDN}/${teamId}.svg`)
    if (!res.ok) throw new Error(`no art on the CDN for team ${teamId} (HTTP ${res.status})`)
    const raw = await res.text()
    const safe = sanitizeSvgMarkup(raw)
    if (!safe) throw new Error(`this club's art didn't parse as SVG`)
    return { raw, safe }
  }, [teamId])

  const source = art.data?.raw ?? null
  const safe = art.data?.safe ?? null
  const fingerprint = useMemo(() => (source ? monoLogoFingerprint(source) : null), [source])
  const parts = useMemo(() => (source ? monoLogoParts(source) : []), [source])
  const picker = useMemo(() => (safe ? monoLogoPickerSvg(safe) : null), [safe])

  // Saved pins are only adopted when they were picked against THIS art — the
  // same fingerprint rule the generator applies (src/lib/monoInk.js). A club
  // whose art moved starts from automatic here rather than from answers that
  // now point at different shapes.
  //
  // `edited` stays null until something is actually clicked, so the landed set
  // is the baseline rather than a copy of it made in an effect: the art arrives
  // asynchronously, and seeding state from it would mean rendering an empty
  // picker first and then correcting it. ClubWorkbench remounts this per club
  // (`key`), which is what makes "null means untouched" safe across teams.
  const [edited, setEdited] = useState(null)
  const [saveState, setSaveState] = useState(null)
  const landed = monoInkFor(teamId)
  const landedStale = Boolean(landed?.art && fingerprint && landed.art !== fingerprint)
  const savedPins = useMemo(
    () => (landed && !landedStale ? landed.parts : {}),
    [landed, landedStale],
  )
  const pins = edited ?? savedPins

  const mono = useMemo(
    () => (source ? monoLogoSvg(source, { maskId: `idlab-ink-${teamId}`, pins }) : null),
    [source, teamId, pins],
  )

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(savedPins), ...Object.keys(pins)])
    return [...keys].some((k) => savedPins[k] !== pins[k])
  }, [savedPins, pins])

  function cycle(index) {
    setEdited((prev) => {
      const next = { ...(prev ?? savedPins) }
      const verdict = NEXT_VERDICT[next[index] ?? 'auto']
      if (verdict === 'auto') delete next[String(index)]
      else next[String(index)] = verdict
      return next
    })
    setSaveState(null)
  }

  async function save() {
    setSaveState({ kind: 'busy', text: 'Saving' })
    const store = structuredClone(monoInkStore())
    const key = String(teamId)
    if (Object.keys(pins).length === 0) delete store[key]
    else store[key] = { name, art: fingerprint, parts: pins, ...(store[key]?.note ? { note: store[key].note } : {}) }

    if (!(await saveStores([{ key: 'mono-ink', body: store }]))) {
      setSaveState({ kind: 'error', text: 'could not write mono-ink.json — is `npm run dev` running?' })
      return
    }
    // The store alone changes nothing anyone can see: the app renders the
    // GENERATED file, so the save isn't finished until that file is rebuilt.
    const result = await regenerateMonoLogo(teamId)
    if (result.error) {
      setSaveState({ kind: 'error', text: `pins saved, but the art didn't rebuild: ${result.error}` })
      return
    }
    setSaveState({ kind: 'ok', text: `saved — ${result.file} rebuilt` })
  }

  if (art.loading) return <Panel>Loading the club mark…</Panel>
  if (art.error || !picker) {
    return (
      <Panel>
        {art.error?.message ?? 'This art has no shapes to pick from — the app falls back to the full-color mark.'}
      </Panel>
    )
  }

  const pinnedCount = Object.keys(pins).length

  return (
    <section className="idlab__monoink" aria-label="Knockout mark">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Knockout mark</span>
        <span className="idlab__monoinkhint">
          Click a shape — {pinnedCount ? `${pinnedCount} pinned` : 'all automatic'}
        </span>
        {pinnedCount > 0 && (
          <button type="button" className="colorlab__wparesetbtn" onClick={() => setEdited({})}>
            Reset to automatic
          </button>
        )}
        <button type="button" className="colorlab__wparesetbtn" onClick={save} disabled={!dirty}>
          Save mark
        </button>
      </div>

      {landedStale && (
        <p className="idlab__monoinkwarn">
          The saved pins for this club were picked against different art — the logo changed, so they are being
          ignored here and by the generator. Pick again and save.
        </p>
      )}

      <div className="idlab__monoinkrow">
        {/* The art is a picture, not a control surface: every shape in it also
            has a real button in the list below, which is the keyboard and
            screen-reader path. Clicking the shape you are looking at is the
            convenience, not the only way in. */}
        <div
          className="idlab__monoinkart"
          onClick={(e) => {
            const index = e.target?.closest?.('[data-mono-part]')?.dataset?.monoPart
            if (index !== undefined) cycle(Number(index))
          }}
          dangerouslySetInnerHTML={{ __html: picker }}
        />

        <div className="idlab__monoinkpreviews">
          {[{ label: 'Default navy chrome', bar: DEFAULT_CHROME_BAR, onBar: '#FBF6E9' }, ...bars].map((bar) => (
            <div
              key={bar.label}
              className={`idlab__monoinkbar${barMarkTone(bar.onBar) === 'dark' ? ' idlab__monoinkbar--darkmark' : ''}`}
              style={{ background: bar.bar }}
              aria-label={bar.label}
            >
              {mono ? (
                <img className="idlab__monoinkmark" src={monoDataUrl(mono)} alt="" />
              ) : (
                <span className="idlab__monoinkempty">Nothing left to draw</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <ul className="idlab__monoinkparts">
        {parts.map((part) => {
          const verdict = pins[part.index] ?? 'auto'
          const effective = verdict === 'auto' ? part.auto : verdict
          return (
            <li key={part.index}>
              <button
                type="button"
                className={`idlab__monoinkpart idlab__monoinkpart--${effective}${verdict === 'auto' ? '' : ' idlab__monoinkpart--pinned'}`}
                onClick={() => cycle(part.index)}
                title={`Shape ${part.index + 1} (${part.tag}) — ${VERDICT_LABEL[verdict]}`}
              >
                <span
                  className="idlab__monoinkswatch"
                  style={{ background: part.fill ?? 'transparent' }}
                  aria-hidden="true"
                />
                <span className="idlab__monoinkpartnum">{part.index + 1}</span>
                <span className="idlab__monoinkpartverdict">
                  {effective === 'ink' ? 'Ink' : 'Knockout'}
                  {verdict === 'auto' ? ' (auto)' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {saveState && <p className={`colorlab__logodropmsg colorlab__logodropmsg--${saveState.kind === 'busy' ? 'note' : saveState.kind}`}>{saveState.text}</p>}
    </section>
  )
}

// The converted mark as an <img> source. A data: URI rather than a second
// inline SVG so the preview can't collide with the picker art's own ids — the
// mask id is document-scoped, and two inlined copies of the same mark would
// fight over it.
function monoDataUrl(mono) {
  return `data:image/svg+xml,${encodeURIComponent(mono)}`
}

function Panel({ children }) {
  return (
    <section className="idlab__monoink" aria-label="Knockout mark">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Knockout mark</span>
      </div>
      <p className="idlab__monoinkhint">{children}</p>
    </section>
  )
}
