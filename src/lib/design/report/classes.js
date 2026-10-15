// THE REPORT PARTS' CLASS LISTS AND MODELS (ADR-0112) — the pure half of the stat
// band and strip, the leader row, the meter, the key and the chip rows. Shared by
// the components in components/ui/frame/ and components/ui/control/ and by
// test/report-parts.test.js, so node can pin it: a .jsx file cannot be imported
// there. Like cardClass.js and pillClass.js, an unknown value is a caller's typo
// and it throws; a silent fallback would ship the wrong look.

export const STAT_LOOKS = ['default', 'band']

// A stat tile's class list. `lead` is the band's lead tile (the negative-accent
// head and the marker stroke), so it makes no sense on the default look.
export function statTileClassName({ look = 'default', lead = false, className = '' } = {}) {
  if (!STAT_LOOKS.includes(look)) throw new Error(`StatTile: unknown look "${look}" (${STAT_LOOKS.join(', ')})`)
  if (lead && look !== 'band') throw new Error('StatTile: lead is for look="band"')
  const parts = ['stattile']
  if (look === 'band') parts.push('stattile--band')
  if (lead) parts.push('stattile--lead')
  if (className) parts.push(className)
  return parts.join(' ')
}

export const LEADER_STATES = ['lead', 'mine']

export function leaderRowClassName({ state, className = '' } = {}) {
  if (state != null && !LEADER_STATES.includes(state)) {
    throw new Error(`LeaderRow: unknown state "${state}" (${LEADER_STATES.join(', ')})`)
  }
  const parts = ['leaderrow']
  if (state) parts.push(`leaderrow--${state}`)
  if (className) parts.push(className)
  return parts.join(' ')
}

export function leaderListClassName({ zebra = false } = {}) {
  return zebra ? 'leaders leaders--zebra' : 'leaders'
}

// THE METER. Each part is { code, share, tone, ring }. `share` is a weight, not a
// percent: the segments split the bar in that ratio, so counts (5, 2, 1) and
// percents (52, 28, 20) both work. The figure shown is the caller's text
// (`figure`), defaulting to the share. A part with no weight would draw nothing
// and a zero total has no bar, so both throw.
export const METER_TONES = ['good', 'caution', 'bad', 'neutral']

export function meterModel(parts) {
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('Meter: parts is a list of at least one part')
  const out = parts.map((p, i) => {
    const { code, share, tone = 'neutral', ring = false, figure } = p ?? {}
    if (!code) throw new Error(`Meter: part ${i} has no code`)
    if (!(share > 0)) throw new Error(`Meter: part "${code}" needs a share above zero`)
    if (!METER_TONES.includes(tone)) throw new Error(`Meter: unknown tone "${tone}" (${METER_TONES.join(', ')})`)
    return { code, share, tone, ring, figure: figure ?? String(share) }
  })
  const label = out.map((p) => `${p.code} ${p.figure}`).join(', ')
  return { parts: out, label }
}

// THE KEY: [{ label, tone }] for a swatch key, or [{ label, mark }] where the
// mark is a node the caller draws (a Pill mark). One kind per key.
export function keyModel(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Key: items is a list of at least one item')
  const kinds = new Set(
    items.map((it, i) => {
      if (!it?.label) throw new Error(`Key: item ${i} has no label`)
      if (it.tone != null && !METER_TONES.includes(it.tone)) {
        throw new Error(`Key: unknown tone "${it.tone}" (${METER_TONES.join(', ')})`)
      }
      if ((it.tone == null) === (it.mark == null)) throw new Error(`Key: item "${it.label}" takes a tone or a mark`)
      return it.tone != null ? 'swatch' : 'mark'
    }),
  )
  if (kinds.size > 1) throw new Error('Key: one kind per key, swatches or marks')
  return { look: [...kinds][0], items }
}

// THE CHIP ROW. `rail` is one row that scrolls sideways; `wrap` falls onto more
// lines. A pick-one row that fills the width is Segmented, not a chip layout.
export const CHIP_LAYOUTS = ['rail', 'wrap']

export function chipsClassName({ layout = 'rail', className = '' } = {}) {
  if (!CHIP_LAYOUTS.includes(layout)) {
    throw new Error(`Chips: unknown layout "${layout}" (${CHIP_LAYOUTS.join(', ')}); a full-width row is Segmented`)
  }
  return className ? `chips chips--${layout} ${className}` : `chips chips--${layout}`
}

// What a tap on a chip does to the picked value(s). One pick (the default)
// replaces the value; `multiple` toggles it in a list.
export function nextChipValue({ value, picked, multiple = false }) {
  if (!multiple) return value
  const list = Array.isArray(picked) ? picked : []
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function isChipPicked({ value, picked, multiple = false }) {
  return multiple ? Array.isArray(picked) && picked.includes(value) : picked === value
}
