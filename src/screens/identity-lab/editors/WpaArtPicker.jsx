import { useState } from 'react'
import { clubMarkSources } from '../../../lib/markSources.js'
import { fillWpaArt } from '../saveStores.js'

// Every mark this club has, as swatches, for filling its WPA slot in one click.
//
// The WPA band tiles a mark of its own, separate from the jersey tile's, and
// until now the only way to put one there was to procure and upload a PNG. But
// the material is almost always already on hand — the CDN's wordmark or cap
// (a wordmark tiles particularly well), another treatment's procured art, or
// anything recolored in the Logo art editor next door. So the picker shows all
// of it rather than asking for a file.
//
// Clicking copies that art into the slot server-side (scripts/lib/dev-logo-upload.mjs's
// fillWpaArt) — a copy rather than a pointer, because the WPA slot IS the
// override and has no original underneath to protect. That also keeps
// `wpaArtUrl` a plain path in the live app, with no second resolution layer.
//
// Sits beside the existing drop zone, not instead of it: a mark that exists
// nowhere in this club's art still has to be uploaded.
export function WpaArtPicker({ teamId, treatment, onFilled }) {
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)
  const sources = clubMarkSources(teamId)
  if (!sources.length) return null

  async function use(source) {
    setBusy(source.key)
    setMessage(null)
    try {
      const result = await fillWpaArt({ teamId, treatment, source: source.key })
      if (result.error) {
        setMessage({ kind: 'error', text: result.error })
        return
      }
      onFilled?.()
      setMessage({
        kind: 'ok',
        // Naming the file it replaced matters: the two extensions can't coexist
        // in one slot, so a swap silently deletes the other one.
        text: result.replaced
          ? `WPA art is now ${source.label} — replaced ${result.replaced}`
          : `WPA art is now ${source.label}`,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="idlab__wpaart">
      <p className="idlab__wpaarthint">Or use a mark this club already has:</p>
      <div className="idlab__wpaartrow">
        {sources.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`idlab__wpaartitem${busy === s.key ? ' idlab__wpaartitem--busy' : ''}`}
            onClick={() => use(s)}
            disabled={busy !== null}
            title={`Tile the WPA band with this club's ${s.label} mark${s.vector ? '' : ' (raster — check it at tile size)'}`}
          >
            <span className="idlab__wpaartthumb">
              <img src={s.url} alt="" />
            </span>
            <span className="idlab__wpaartlabel">{s.label}</span>
          </button>
        ))}
      </div>
      {message && (
        <p className={`colorlab__logodropmsg colorlab__logodropmsg--${message.kind}`}>{message.text}</p>
      )}
    </div>
  )
}
