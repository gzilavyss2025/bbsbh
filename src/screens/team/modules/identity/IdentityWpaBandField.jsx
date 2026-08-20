const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function parseBand(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// The WPA group's one non-scalar field: a flat fill, or `{ pinstripe: true,
// color?, bg? }` for the scorebook pinstripe motif (WinProbChart.jsx's
// PinstripePattern) — the SAME discriminated shape wpa-tuning.json's own
// `band` key holds (wpaBandColors.js), so a value saved here is one the real
// chart already knows how to read. Its own component, like the mono group's
// shape picker, because the generic Field() renders one value per box and
// this field composes three (a hex, a checkbox, and a second hex) into one.
//
// `field` is the group's `band` descriptor from identityFields.js;
// `values`/`onChange` are the drawer's draft map and setter, the same two
// props every other field in this drawer takes. With no draft of its own,
// this shows the LANDED value as its starting, interactive state (not a
// placeholder) — a checkbox and a swatch have no blank state to leave a text
// box empty with, the same reasoning IdentityMonoField's shape picker gives
// for showing landed pins rather than an empty grid.
export function IdentityWpaBandField({ field, values, onChange }) {
  const draftRaw = values[field.id]
  const raw = draftRaw !== undefined ? draftRaw : field.landed
  const parsed = parseBand(raw)
  const pinstripe = Boolean(parsed && typeof parsed === 'object' && parsed.pinstripe)
  const color = pinstripe ? (parsed.color ?? '') : typeof parsed === 'string' ? parsed : ''
  const bg = pinstripe && parsed ? (parsed.bg ?? '') : ''

  function commit(next) {
    if (!next.pinstripe) {
      onChange(field.id, next.color ? JSON.stringify(next.color) : '')
      return
    }
    const obj = { pinstripe: true }
    if (next.color) obj.color = next.color
    if (next.bg) obj.bg = next.bg
    onChange(field.id, JSON.stringify(obj))
  }

  return (
    <div className="iddrawer__field iddrawer__band">
      <span className="iddrawer__label">{field.label}</span>
      <span className="iddrawer__hint">A flat fill, or a scorebook pinstripe with its own line color.</span>
      <span className="iddrawer__inputrow">
        <input
          className="iddrawer__input"
          type="text"
          value={color}
          placeholder="#hex"
          spellCheck="false"
          autoComplete="off"
          aria-label={pinstripe ? 'Stripe colour' : 'Band colour'}
          onChange={(e) => commit({ pinstripe, color: e.target.value, bg })}
        />
        <input
          className="iddrawer__swatch"
          type="color"
          aria-label={`${pinstripe ? 'Stripe' : 'Band'} colour picker`}
          value={HEX.test(color) ? color : '#000000'}
          onChange={(e) => commit({ pinstripe, color: e.target.value, bg })}
        />
      </span>
      <label className="iddrawer__checkbox">
        <input
          type="checkbox"
          checked={pinstripe}
          onChange={(e) => commit({ pinstripe: e.target.checked, color, bg })}
        />
        <span>Pinstripe</span>
      </label>
      {pinstripe && (
        <span className="iddrawer__inputrow">
          <input
            className="iddrawer__input"
            type="text"
            value={bg}
            placeholder="#hex (white)"
            spellCheck="false"
            autoComplete="off"
            aria-label="Pinstripe fill colour"
            onChange={(e) => commit({ pinstripe, color, bg: e.target.value })}
          />
          <input
            className="iddrawer__swatch"
            type="color"
            aria-label="Pinstripe fill colour picker"
            value={HEX.test(bg) ? bg : '#ffffff'}
            onChange={(e) => commit({ pinstripe, color, bg: e.target.value })}
          />
        </span>
      )}
    </div>
  )
}
