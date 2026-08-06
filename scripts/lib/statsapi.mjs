// Shared statsapi.mlb.com fetch wrapper for the gen-*.mjs generators.
//
// getJson(path) is the plain, no-retry call used verbatim (before this
// extraction, copy-pasted) by ~19 generators: GET https://statsapi.mlb.com +
// path, throw on a non-2xx response, return the parsed JSON body.
//
// A few generators (gen-manager-history.mjs, gen-milb-history.mjs,
// gen-workload.mjs) wrap this in their own retry/backoff loop with counts and
// delays that differ from each other — that behavior stays local to those
// scripts rather than being folded in here, since unifying retry counts would
// be an unreviewed behavior change against a live, occasionally-flaky API.

export const STATSAPI_BASE = 'https://statsapi.mlb.com'

export async function getJson(path) {
  const res = await fetch(STATSAPI_BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}
