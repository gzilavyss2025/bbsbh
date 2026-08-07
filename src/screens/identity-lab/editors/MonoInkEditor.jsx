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
import { LOGO_VARIANTS, teamLogoUrl } from '../../../lib/teams.js'
import { regenerateMonoLogo, saveStores } from '../saveStores.js'

// Pick, by eye, which SHAPES of a club's logo are the mark and which are the
// paper it's drawn against — the hand correction to logoMono.js's automatic
// classifier, which is a heuristic over art nobody controls and is therefore
// sometimes wrong about a specific shape (ADR-0031).
//
// The loop this closes: the club's real art is loaded here, clicking a shape
// pins it to ink or knockout, the preview beside it is the ACTUAL converted
// mark on the navy chrome most of the app's unthemed mastheads actually use,
// and Save writes the pins plus asks the dev server to regenerate
// public/data/logos/mono/{teamId}.svg with them. Same converter in both
// places, so nothing shown here is a mock-up of what the real file would be.
// Deliberately just the one background — a club's own header-bar colors are
// LogoRecolorEditor's job (full-color jersey art), not this one's.
//
// Dev-only, like the rest of the lab (ADR-0029): the save endpoint only exists
// under `vite dev`, and the screen itself is DEV-gated in App.jsx.

// Clicking a shape flips it straight between the two verdicts — whichever way
// it currently reads (automatic or already pinned) is the one thing the click
// isn't, so there is no third "back to automatic" stop to click past on the
// way to the one you want. "Reset to automatic" (below) is the bulk undo.
const VERDICT_LABEL = {
  auto: 'Automatic',
  ink: 'Ink — part of the mark',
  knockout: 'Knockout — the paper behind it',
}

// Which CDN mark feeds the conversion — 'base' is every club's plain
// `{id}.svg`, and the other three are the same alternates the sketcher offers
// (teams.js's LOGO_VARIANTS). Exists because a handful of MiLB clubs' base
// mark is worse art than an alternate on the same CDN (lower-res, a busier
// crest that converts to knockout worse than the cleaner mark) — picking a
// different source here is scripts/lib/mono-logo-art.mjs's sourceVariantFor
// escape hatch, picked by eye the same way ink/knockout pins are.
const SOURCE_OPTIONS = [{ key: 'base', label: 'Base' }, ...LOGO_VARIANTS.map((v) => ({ key: v.key, label: v.label }))]

// Navy is what an unthemed club's masthead actually is, and most of the app's
// mastheads are unthemed (header coverage is partial by design), so the mark
// gets judged there as well as on this club's own bar.
const DEFAULT_CHROME_BAR = '#12233F'

// Rendered whether the current source's art is still loading, failed, or
// loaded — switching sources is the point of this row, so it can't disappear
// the moment a click starts a refetch, or comparing Base against Primary
// means waiting out a loading flash between every pair of clicks.
function SourcePicker({ sourceVariant, onChange }) {
  return (
    <div className="idlab__monoinksource" role="group" aria-label="Source art">
      <span className="idlab__monoinksourcelabel">Source</span>
      {SOURCE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`idlab__monoinksourcebtn${sourceVariant === opt.key ? ' idlab__monoinksourcebtn--active' : ''}`}
          aria-pressed={sourceVariant === opt.key}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function MonoInkEditor({ teamId, name }) {
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
  //
  // Which source feeds all of this: `sourceOverride` stays null until the
  // picker below is actually clicked, same "null means untouched" shape as
  // `edited` below it — the saved choice (or 'base') is the baseline rather
  // than a copy of it seeded into state.
  const landed = monoInkFor(teamId)
  const landedSource = landed?.source ?? 'base'
  const [sourceOverride, setSourceOverride] = useState(null)
  const sourceVariant = sourceOverride ?? landedSource

  const art = useAsync(async () => {
    const res = await fetch(teamLogoUrl(teamId, sourceVariant))
    if (!res.ok) throw new Error(`no ${sourceVariant} art on the CDN for team ${teamId} (HTTP ${res.status})`)
    const raw = await res.text()
    const safe = sanitizeSvgMarkup(raw)
    if (!safe) throw new Error(`this club's art didn't parse as SVG`)
    return { raw, safe }
  }, [teamId, sourceVariant])

  const source = art.data?.raw ?? null
  const safe = art.data?.safe ?? null
  const fingerprint = useMemo(() => (source ? monoLogoFingerprint(source) : null), [source])
  const parts = useMemo(() => (source ? monoLogoParts(source) : []), [source])
  const picker = useMemo(() => (safe ? monoLogoPickerSvg(safe) : null), [safe])

  // Saved pins are only adopted when they were picked against THIS art — the
  // same fingerprint rule the generator applies (src/lib/monoInk.js). A club
  // whose art moved (a rebrand, or just switching the source picker above)
  // starts from automatic here rather than from answers that now point at
  // different shapes.
  //
  // `edited` stays null until something is actually clicked, so the landed set
  // is the baseline rather than a copy of it made in an effect: the art arrives
  // asynchronously, and seeding state from it would mean rendering an empty
  // picker first and then correcting it. ClubWorkbench remounts this per club
  // (`key`), which is what makes "null means untouched" safe across teams.
  const [edited, setEdited] = useState(null)
  const [saveState, setSaveState] = useState(null)
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

  const pinsDirty = useMemo(() => {
    const keys = new Set([...Object.keys(savedPins), ...Object.keys(pins)])
    return [...keys].some((k) => savedPins[k] !== pins[k])
  }, [savedPins, pins])
  const dirty = pinsDirty || sourceVariant !== landedSource

  // A click always flips straight to the OTHER verdict from whatever this
  // shape currently reads as — its own pin if it has one, else the automatic
  // classifier's call — never routing back through a third "unpinned" stop.
  // "Reset to automatic" (below) is the only way back to unpinned, in bulk.
  function cycle(index) {
    setEdited((prev) => {
      const base = prev ?? savedPins
      const current = base[index] ?? parts.find((p) => p.index === index)?.auto ?? 'ink'
      return { ...base, [String(index)]: current === 'ink' ? 'knockout' : 'ink' }
    })
    setSaveState(null)
  }

  // Switching the source picker points the whole editor at different art —
  // shape indices from the old source don't mean anything against it, so any
  // in-progress (unsaved) pins are dropped rather than silently misapplied to
  // whatever shape happens to share that index in the new art. Landed pins
  // aren't touched here: they're keyed to their own fingerprint and the
  // `landedStale` check above already stops them from applying to the wrong
  // shapes — this only clears the draft this session made.
  function changeSource(key) {
    setSourceOverride(key)
    setEdited(null)
    setSaveState(null)
  }

  async function save() {
    setSaveState({ kind: 'busy', text: 'Saving' })
    const store = structuredClone(monoInkStore())
    const key = String(teamId)
    const noPins = Object.keys(pins).length === 0
    const noSourceOverride = sourceVariant === 'base'
    if (noPins && noSourceOverride) delete store[key]
    else {
      store[key] = {
        name,
        art: fingerprint,
        parts: pins,
        ...(noSourceOverride ? {} : { source: sourceVariant }),
        ...(store[key]?.note ? { note: store[key].note } : {}),
      }
    }

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

  if (art.loading) {
    return (
      <Panel sourceVariant={sourceVariant} onChangeSource={changeSource}>
        Loading the club mark…
      </Panel>
    )
  }
  if (art.error || !picker) {
    return (
      <Panel sourceVariant={sourceVariant} onChangeSource={changeSource}>
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

      <SourcePicker sourceVariant={sourceVariant} onChange={changeSource} />

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

        <div className="idlab__monoinkbar" style={{ background: DEFAULT_CHROME_BAR }} aria-label="Default navy chrome">
          {mono ? (
            <img className="idlab__monoinkmark" src={monoDataUrl(mono)} alt="" />
          ) : (
            <span className="idlab__monoinkempty">Nothing left to draw</span>
          )}
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
                <span className="idlab__monoinkpartverdict">{effective === 'ink' ? 'Ink' : 'Knockout'}</span>
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

function Panel({ sourceVariant, onChangeSource, children }) {
  return (
    <section className="idlab__monoink" aria-label="Knockout mark">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Knockout mark</span>
      </div>
      <SourcePicker sourceVariant={sourceVariant} onChange={onChangeSource} />
      <p className="idlab__monoinkhint">{children}</p>
    </section>
  )
}
