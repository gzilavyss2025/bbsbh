import { useMemo } from 'react'
import { useAsync } from '../../../../hooks/useAsync.js'
import { monoLogoFingerprint, monoLogoParts, monoLogoPickerSvg, monoLogoSvg } from '../../../../lib/logoMono.js'
import { sanitizeSvgMarkup } from '../../../../lib/svgSanitize.js'
import { LOGO_VARIANTS, logoCdnUrl } from '../../../../lib/logoCdn.js'
import { ShapeInkPicker, flipVerdict } from '../../../identity-lab/editors/ShapeInkPicker.jsx'
// The shape picker's own markup carries the identity-lab's `idlab__monoink*`
// classes (ShapeInkPicker.jsx is deliberately shared rather than
// reimplemented — a shape must mean the same thing everywhere it's offered).
// Its rules live in the lab's own stylesheet, which the lab's screen entry
// imports; this drawer needs the same rules and pulls them in directly,
// since 62-identity-admin.css is a separate lazy chunk.
import '../../../../styles/17-identity-lab-workbench.css'

// The drawer's Knockout mark group: which shapes of this club's mark are ink
// vs. the paper it's drawn against, reusing /identity-lab's own picker so a
// shape can't come to mean something different in the two places that offer
// it (ADR-0054, issue #767).
//
// THE ONE FIELD IN THIS DRAWER WHERE SAVE ISN'T INSTANT. Every sibling field
// is a runtime override a resolver reads on the very next render; this one
// only reaches a visitor once scripts/gen-mono-logos.mjs next runs and
// fetches it (weekly, .github/workflows/update-teams.yml) — the SVG a
// masthead actually draws is a precomputed file, not something this store
// renders live. Said explicitly below rather than left to be discovered.
//
// `fields` is this club's three mono field descriptors (parts/source/art)
// from identityFields.js; `values`/`onChange` are the drawer's draft map and
// setter, the same two props every other field in this drawer takes.
const SOURCE_OPTIONS = [{ key: 'base', label: 'Base' }, ...LOGO_VARIANTS.map((v) => ({ key: v.key, label: v.label }))]
const CHROME_BAR = '#12233F'

function monoDataUrl(mono) {
  return `data:image/svg+xml,${encodeURIComponent(mono)}`
}

function parsePins(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function IdentityMonoField({ teamId, fields, values, onChange }) {
  const partsField = fields.find((f) => f.name === 'parts')
  const sourceField = fields.find((f) => f.name === 'source')
  const artField = fields.find((f) => f.name === 'art')

  const landedSource = sourceField.landed || 'base'
  const draftSource = values[sourceField.id]
  const sourceVariant = draftSource || landedSource

  const art = useAsync(async () => {
    const res = await fetch(logoCdnUrl(teamId, sourceVariant))
    if (!res.ok) throw new Error(`no ${sourceVariant} art on the CDN for team ${teamId} (HTTP ${res.status})`)
    const raw = await res.text()
    const safe = sanitizeSvgMarkup(raw)
    if (!safe) throw new Error("this club's art didn't parse as SVG")
    return { raw, safe }
  }, [teamId, sourceVariant])

  const source = art.data?.raw ?? null
  const safe = art.data?.safe ?? null
  const fingerprint = useMemo(() => (source ? monoLogoFingerprint(source) : null), [source])
  const parts = useMemo(() => (source ? monoLogoParts(source) : []), [source])
  const picker = useMemo(() => (safe ? monoLogoPickerSvg(safe) : null), [safe])

  // Landed (file, plus any already-saved override — monoInkFor is
  // overlay-aware) pins only apply when they were picked against THIS art —
  // the same staleness rule src/lib/monoInk.js and the generator both apply.
  const landedStale = Boolean(artField.landed && fingerprint && artField.landed !== fingerprint)
  const landedPins = useMemo(
    () => (landedStale ? {} : parsePins(partsField.landed)),
    [partsField.landed, landedStale],
  )

  const draftPartsRaw = values[partsField.id]
  const pins = draftPartsRaw === undefined ? landedPins : parsePins(draftPartsRaw)

  const mono = useMemo(
    () => (source ? monoLogoSvg(source, { maskId: `iddrawer-ink-${teamId}`, pins }) : null),
    [source, teamId, pins],
  )

  const hasDraft = draftSource !== undefined || draftPartsRaw !== undefined || values[artField.id] !== undefined

  function cycle(index) {
    const next = { ...pins, [String(index)]: flipVerdict(parts, pins, index) }
    onChange(partsField.id, JSON.stringify(next))
    // A pin only means something against the art it was picked from — carry
    // the fingerprint with it so a rebrand before the next generator run
    // drops it back to automatic there too, instead of re-inking wrong shapes.
    if (fingerprint) onChange(artField.id, fingerprint)
  }

  function clearDraft() {
    onChange(sourceField.id, '')
    onChange(partsField.id, '')
    onChange(artField.id, '')
  }

  function changeSource(key) {
    onChange(sourceField.id, key === 'base' ? '' : key)
    // Pins picked against the old source's shapes don't mean anything
    // against different art — same guard the lab's own source switch keeps.
    onChange(partsField.id, '')
    onChange(artField.id, '')
  }

  const pinnedCount = Object.keys(pins).length

  return (
    <div className="iddrawer__mono">
      <p className="iddrawer__warn">
        This mark is precomputed, not rendered live — what visitors see updates the next time the
        weekly team-data refresh runs, not the instant you save here.
      </p>

      <div className="idlab__monoinksource" role="group" aria-label="Source art">
        <span className="idlab__monoinksourcelabel">Source</span>
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`idlab__monoinksourcebtn${sourceVariant === opt.key ? ' idlab__monoinksourcebtn--active' : ''}`}
            aria-pressed={sourceVariant === opt.key}
            onClick={() => changeSource(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {art.loading && <p className="idlab__monoinkhint">Loading the club mark…</p>}
      {art.error && <p className="idlab__monoinkhint">{art.error.message}</p>}

      {!art.loading && !art.error && !picker && (
        <p className="idlab__monoinkhint">
          This art has no shapes to pick from — the app falls back to the full-color mark.
        </p>
      )}

      {!art.loading && !art.error && picker && (
        <>
          <div className="colorlab__wpapreviewhead">
            <span className="idlab__monoinkhint">
              {pinnedCount ? `${pinnedCount} pinned` : 'all automatic'}
            </span>
            {hasDraft && (
              <button type="button" className="colorlab__wparesetbtn" onClick={clearDraft}>
                Clear my changes
              </button>
            )}
          </div>

          {landedStale && (
            <p className="idlab__monoinkwarn">
              The landed pins for this club were picked against different art — the logo changed, so
              they are being ignored here (and by the next generator run) until pinned again.
            </p>
          )}

          <ShapeInkPicker picker={picker} parts={parts} pins={pins} onToggle={cycle}>
            <div className="idlab__monoinkbar" style={{ background: CHROME_BAR }} aria-label="Default navy chrome">
              {mono ? (
                <img className="idlab__monoinkmark" src={monoDataUrl(mono)} alt="" />
              ) : (
                <span className="idlab__monoinkempty">Nothing left to draw</span>
              )}
            </div>
          </ShapeInkPicker>
        </>
      )}
    </div>
  )
}
