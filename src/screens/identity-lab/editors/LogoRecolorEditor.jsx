import { useMemo, useState } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import { monoLogoParts, monoLogoPickerSvg } from '../../../lib/logoMono.js'
import { TRANSPARENT_PAINT, isRecolorHex, isRecolorPaint, recolorSvg } from '../../../lib/logoRecolor.js'
import { customMarksFor } from '../../../lib/customMarks.js'
import { LOGO_VARIANTS, teamLogoUrl } from '../../../lib/teams.js'
import { HexField } from '../HexField.jsx'
import { saveCustomMark } from '../saveStores.js'

// Build a club's missing jersey art out of the art it already has: pick a
// source mark, repaint shapes one at a time, save the result under a name.
//
// The gap this fills: the mlbstatic CDN carries no alternate or City Connect
// marks (src/lib/CLAUDE.md), and the ones that exist are often the SAME shapes
// in different colors — a Main mark in the Alt jersey's palette. Procuring a
// PNG for that means finding art that may not be public anywhere; recoloring
// the mark we already have is a five-second job once the shapes are clickable.
//
// Sits beside the Knockout mark editor and shares its shape numbering
// (logoMono.js's `monoLogoParts`/`monoLogoPickerSvg`), so shape 3 is the same
// shape in both. What differs is the verdict: that one decides ink vs paper for
// a one-color mask, this one assigns a hex.
//
// Saving never overwrites: a name already in this club's library is refused
// (409), and the saved mark is only WORN by a treatment once it's assigned —
// which is a pointer teams.js reads first, leaving any procured art in place.
// Dev-only, like the rest of the lab (ADR-0029).

// Only SVG sources can be recolored — a PNG has no shapes to select. The four
// CDN variants are every vector mark a club has on the CDN; a club's saved
// library marks join them, so a recolor can start from a previous recolor.
function sourcesFor(teamId) {
  return [
    { key: 'base', label: 'Base', url: teamLogoUrl(teamId, 'base') },
    ...LOGO_VARIANTS.map((v) => ({ key: v.key, label: v.label, url: teamLogoUrl(teamId, v.key) })),
    ...customMarksFor(teamId).map((m) => ({ key: `saved:${m.slug}`, label: m.name, url: m.url, saved: true })),
  ].filter((s) => s.url)
}

export function LogoRecolorEditor({ teamId, name, bars }) {
  const sources = useMemo(() => sourcesFor(teamId), [teamId])
  const [sourceKey, setSourceKey] = useState(sources[0]?.key ?? null)
  const source = sources.find((s) => s.key === sourceKey) ?? sources[0] ?? null

  const art = useAsync(async () => {
    if (!source) return null
    const res = await fetch(source.url)
    if (!res.ok) throw new Error(`could not load ${source.label} (HTTP ${res.status})`)
    return res.text()
  }, [source?.url])

  // Keyed by source: switching marks starts a fresh repaint rather than
  // carrying shape 3's color onto a mark whose shape 3 is something else.
  const [fills, setFills] = useState({})
  const [selected, setSelected] = useState(null)
  const [hex, setHex] = useState('')
  const [markName, setMarkName] = useState('')
  const [saveState, setSaveState] = useState(null)
  const [loadedKey, setLoadedKey] = useState(sourceKey)
  if (loadedKey !== sourceKey) {
    // Reset computed during render, not in an effect — same pattern as
    // Headshot.jsx and TreatmentLogo.
    setLoadedKey(sourceKey)
    setFills({})
    setSelected(null)
    setSaveState(null)
  }

  const svg = art.data ?? null
  const picker = useMemo(() => (svg ? monoLogoPickerSvg(svg) : null), [svg])
  const parts = useMemo(() => (svg ? monoLogoParts(svg) : []), [svg])
  const recolored = useMemo(() => (svg ? recolorSvg(svg, fills) : null), [svg, fills])

  // The colors worth one click: what this mark is already painted with, plus
  // the club's own header colors. Anything else is a hex away.
  const palette = useMemo(() => {
    const seen = new Map()
    for (const part of parts) {
      if (part.fill && isRecolorHex(part.fill)) seen.set(part.fill.toLowerCase(), 'In this mark') // caps-js-exempt
    }
    for (const bar of bars ?? []) {
      for (const [role, value] of [['Bar', bar.bar], ['On bar', bar.onBar]]) {
        if (value && isRecolorHex(value) && !seen.has(value.toLowerCase())) { // caps-js-exempt
          seen.set(value.toLowerCase(), `${bar.label} · ${role}`) // caps-js-exempt
        }
      }
    }
    return [...seen].map(([value, label]) => ({ hex: value, label }))
  }, [parts, bars])

  function paint(color) {
    if (selected === null || !isRecolorPaint(color)) return
    setFills((prev) => ({ ...prev, [selected]: color }))
    setSaveState(null)
  }

  function clearShape(index) {
    setFills((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    setSaveState(null)
  }

  async function save() {
    if (!recolored || !markName.trim()) return
    setSaveState({ kind: 'note', text: 'Saving' })
    const result = await saveCustomMark({ teamId, name: markName.trim(), svg: recolored })
    if (result.error) {
      setSaveState({ kind: 'error', text: result.error })
      return
    }
    setMarkName('')
    setSaveState({ kind: 'ok', text: `saved as "${result.name}" — pick it under Replace art to put it on a jersey` })
  }

  if (!sources.length) return <Panel>This club has no vector art to recolor.</Panel>

  const repainted = Object.keys(fills).length

  return (
    <section className="idlab__recolor" aria-label="Logo art">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Logo art</span>
        <span className="idlab__monoinkhint">
          {selected === null ? 'Pick a shape, then a color' : `Shape ${selected + 1} selected`}
          {repainted ? ` — ${repainted} repainted` : ''}
        </span>
        {repainted > 0 && (
          <button type="button" className="colorlab__wparesetbtn" onClick={() => setFills({})}>
            Reset colors
          </button>
        )}
      </div>

      <div className="idlab__recolorsources">
        {sources.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`idlab__recolorsource${s.key === source?.key ? ' idlab__recolorsource--on' : ''}`}
            onClick={() => setSourceKey(s.key)}
            title={s.saved ? `Start from the saved mark "${s.label}"` : `Start from this club's ${s.label} mark`}
          >
            <img className="idlab__recolorsourceart" src={s.url} alt="" />
            <span className="idlab__recolorsourcelabel">{s.label}</span>
          </button>
        ))}
      </div>

      {art.loading && <p className="idlab__monoinkhint">Loading {source?.label}…</p>}
      {art.error && <p className="idlab__monoinkwarn">{art.error.message}</p>}

      {picker && (
        <>
          <div className="idlab__monoinkrow">
            {/* Selecting a shape here is the convenience; the numbered buttons
                below are the keyboard and screen-reader path, same split as the
                Knockout mark editor. */}
            <div
              className="idlab__monoinkart"
              onClick={(e) => {
                const index = e.target?.closest?.('[data-mono-part]')?.dataset?.monoPart
                if (index !== undefined) setSelected(Number(index))
              }}
              dangerouslySetInnerHTML={{ __html: picker }}
            />
            <div className="idlab__recolorout">
              <img className="idlab__recolorpreview" src={`data:image/svg+xml,${encodeURIComponent(recolored ?? '')}`} alt="" />
              <span className="idlab__monoinkbarlabel">Result</span>
            </div>
          </div>

          <div className="idlab__recolorpalette">
            {/* Erasing a shape, not undoing it: the shapes stacked above it stay
                put, which is how a mark's backing plate comes off so the art can
                sit on a colored tile. Drawn as the same paper checkerboard the
                shelf uses for transparent art. */}
            <button
              type="button"
              className="idlab__recolorswatch idlab__recolorswatch--none"
              onClick={() => paint(TRANSPARENT_PAINT)}
              disabled={selected === null}
              title="Transparent — draw nothing for this shape"
              aria-label="Make the selected shape transparent"
            />
            {palette.map((c) => (
              <button
                key={c.hex}
                type="button"
                className="idlab__recolorswatch"
                style={{ background: c.hex }}
                onClick={() => paint(c.hex)}
                disabled={selected === null}
                title={`${c.label} — ${c.hex}`}
                aria-label={`Paint the selected shape ${c.hex}`}
              />
            ))}
            <HexField
              placeholder="#hex"
              value={hex}
              onChange={(v) => {
                setHex(v)
                paint(v)
              }}
            />
          </div>

          <ul className="idlab__monoinkparts">
            {parts.map((part) => (
              <li key={part.index}>
                <button
                  type="button"
                  className={`idlab__monoinkpart${part.index === selected ? ' idlab__monoinkpart--pinned' : ''}`}
                  onClick={() => setSelected(part.index)}
                  onDoubleClick={() => clearShape(part.index)}
                  title={
                    fills[part.index] === TRANSPARENT_PAINT
                      ? `Shape ${part.index + 1} is transparent — double-click to put it back`
                      : fills[part.index]
                        ? `Shape ${part.index + 1} repainted ${fills[part.index]} — double-click to put it back`
                        : `Shape ${part.index + 1} (${part.tag})`
                  }
                >
                  {/* A shape painted transparent gets the checkerboard, not an
                      empty chip — "erased" and "this shape had no fill of its
                      own" have to look different or the row can't be read. */}
                  <span
                    className={`idlab__monoinkswatch${fills[part.index] === TRANSPARENT_PAINT ? ' idlab__recolorswatch--none' : ''}`}
                    style={
                      fills[part.index] === TRANSPARENT_PAINT
                        ? undefined
                        : { background: fills[part.index] ?? part.fill ?? 'transparent' }
                    }
                    aria-hidden="true"
                  />
                  <span className="idlab__monoinkpartnum">{part.index + 1}</span>
                </button>
              </li>
            ))}
          </ul>

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
              disabled={!markName.trim() || !repainted}
              title={
                repainted
                  ? `Save this recolor into ${name}'s library`
                  : 'Repaint at least one shape first'
              }
            >
              Save as new mark
            </button>
          </div>
        </>
      )}

      {saveState && (
        <p className={`colorlab__logodropmsg colorlab__logodropmsg--${saveState.kind}`}>{saveState.text}</p>
      )}
    </section>
  )
}

function Panel({ children }) {
  return (
    <section className="idlab__recolor" aria-label="Logo art">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Logo art</span>
      </div>
      <p className="idlab__monoinkhint">{children}</p>
    </section>
  )
}
