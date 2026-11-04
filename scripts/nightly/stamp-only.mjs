// Is a data file's change only a run stamp? The pure half of
// scripts/nightly/drop-stamp-only.mjs, which the nightly commit step runs so a quiet
// night commits no public/ data and starts no Vercel deploy.
//
// A stamp is a key in STAMP_KEYS (when the run, or its upstream source, ran;
// none of them is read by src/), or an `asOf` holding a full timestamp, as
// gen-spray.mjs writes. An `asOf` that is a plain date is data: readers show it
// and pick snapshots by it. Anything else that differs, a key that appears or
// disappears included, is a real change. A file that does not parse as JSON
// (an .sql dump) is never stamp-only.

export const STAMP_KEYS = new Set(['generatedAt', 'sourceGeneratedAt', 'prospectsGeneratedAt', 'confirmedAt', 'fetchedAt', 'updatedAt'])

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/
const isStamp = (key, a, b) =>
  STAMP_KEYS.has(key) || (key === 'asOf' && TIMESTAMP.test(String(a)) && TIMESTAMP.test(String(b)))

function sameButStamps(a, b) {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((k) => k in b && (isStamp(k, a[k], b[k]) ? typeof a[k] === typeof b[k] : sameButStamps(a[k], b[k])))
}

export function isStampOnlyChange(beforeText, afterText) {
  try {
    return sameButStamps(JSON.parse(beforeText), JSON.parse(afterText))
  } catch {
    return false
  }
}
