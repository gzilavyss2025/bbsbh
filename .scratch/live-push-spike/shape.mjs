// Spoiler-safe printing for the #2578 push spike. Nothing in this folder may
// print a score, a play description or a result. Every value that reaches the
// console or a log file goes through here first.
//
// A message becomes its SHAPE: key names and value types, never the values.
// The one value allowed through is a timecode such as 20261024_001530.

export const TIMECODE = /^\d{8}_\d{6}$/

// 20261024_001530 -> milliseconds since the epoch (timecodes are UTC). NaN if it is not a timecode.
export function timecodeMs(tc) {
  const m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(tc || '')
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN
}

export function shape(v, depth = 4) {
  if (v === null) return '<null>'
  if (typeof v === 'string') return TIMECODE.test(v) ? v : `<str ${v.length}>`
  if (typeof v === 'number') return '<num>'
  if (typeof v === 'boolean') return '<bool>'
  if (Array.isArray(v)) {
    if (depth <= 0 || v.length === 0) return `<array ${v.length}>`
    return [`${v.length} x`, shape(v[0], depth - 1)]
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v)
    if (depth <= 0) return `<object ${keys.length} keys>`
    const out = {}
    for (const k of keys.slice(0, 40)) out[k] = shape(v[k], depth - 1)
    if (keys.length > 40) out['<more>'] = keys.length - 40
    return out
  }
  return `<${typeof v}>`
}

// "/liveData/linescore/teams/home/runs" -> "/liveData/linescore". Two levels
// say which part of the feed changed and never which value.
export function pathPrefix(path, depth = 2) {
  return '/' + String(path).split('/').slice(1, 1 + depth).join('/')
}

// A text frame that is not JSON and is short: an acknowledgement, not data.
export function classify(text) {
  try {
    return { json: JSON.parse(text) }
  } catch {
    return { json: undefined, ack: text.length < 32 }
  }
}
