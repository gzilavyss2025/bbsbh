// Net traffic of the push-driven design against a fixed full-feed poll, from events.jsonl.
//   node analyze.mjs <runDir> [<runDir> ...]      (several dirs add a TOTAL row)
//
// The model, and what it leaves out:
//  - fetches: diff requests that were actually sent (patch, empty, fallback, apply-error, http-error,
//    network-error, not-json, odd-shape, stale-drop). An "up-to-date" skip sent nothing and is not counted.
//  - cost of the design: gzip bytes of every diff response, plus every full feed fetched during play:
//    the one after each reconnect and the one after each fallback or error. A run's first full feed is
//    left out, because any design pays it.
//  - baseline: one full feed per tick, at 15 s and at 60 s, costed at the IN-PLAY full-feed size (the
//    median of the sizes recorded on patch events and after fallbacks), not the pre-game feed.
//  - live time: seconds with the socket open, counted from the run's first in-play patch. Time the
//    socket was down is not live time.
//  - not counted: verification fetches (they are measurement, not the design; a design that verified
//    would cost more), and the time a reconnect takes.
//  - mismatches: verification results that differed from the snapshot. "independent" counts a
//    divergence once; a repeat is a later mismatch while the first is still unrepaired (logs made before
//    capture.mjs repaired after a mismatch show these).
// Sizes are gzip of the re-serialized body. Prints counts, bytes and ratios only. No values.
import { existsSync, readFileSync } from 'node:fs'

const median = (a) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}
const REQUESTS = ['patch', 'empty', 'fallback', 'apply-error', 'http-error', 'network-error', 'not-json', 'odd-shape', 'stale-drop']
const round1 = (x) => Math.round(x * 10) / 10

const rows = []
const tot = { secs: 0, fetches: 0, patch: 0, empty: 0, fallback: 0, applyErr: 0, httpErr: 0, bytes: 0, poll15: 0, poll60: 0, reqs: 0, mismatches: 0, independent: 0 }

for (const dir of process.argv.slice(2)) {
  const run = dir.split('/').pop()
  const file = `${dir}/events.jsonl`
  const text = existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
  if (!text) {
    rows.push({ run, note: 'no events' })
    continue
  }
  const ev = text.split('\n').map((l) => JSON.parse(l))
  const first = ev.find((e) => e.type === 'diff' && e.outcome === 'patch' && e.ageSec < 300)
  if (!first) {
    rows.push({ run, note: 'no in-play patch' })
    continue
  }
  const from = first.t
  const summaryFile = `${dir}/summary.json`
  const endT = existsSync(summaryFile) ? JSON.parse(readFileSync(summaryFile, 'utf8')).durationMin * 60_000 : ev.at(-1).t

  // seconds with the socket open, inside the live stretch
  let up = null
  let secs = 0
  for (const e of ev) {
    if (e.type === 'open') up = e.t
    else if (e.type === 'close' && up !== null) {
      const lo = Math.max(up, from)
      if (e.t > lo) secs += (e.t - lo) / 1000
      up = null
    }
  }
  if (up !== null && endT > Math.max(up, from)) secs += (endT - Math.max(up, from)) / 1000

  const live = ev.filter((e) => e.t >= from)
  const diffs = live.filter((e) => e.type === 'diff' && REQUESTS.includes(e.outcome))
  const n = (o) => diffs.filter((e) => e.outcome === o).length
  const fulls = ev.filter((e) => e.type === 'full')
  const paid = fulls.slice(1).filter((e) => e.t >= from) // every full feed after the run's first
  const sizes = [...live.filter((e) => e.outcome === 'patch' && e.fullGz).map((e) => e.fullGz), ...paid.filter((e) => e.why !== 'open').map((e) => e.gz)]
  const fullSize = median(sizes.length ? sizes : fulls.map((e) => e.gz))

  const bytes = diffs.reduce((a, e) => a + (e.gz || 0), 0) + paid.reduce((a, e) => a + e.gz, 0)
  const poll15 = Math.floor(secs / 15) * fullSize
  const poll60 = Math.floor(secs / 60) * fullSize
  const reqs = diffs.length + paid.length

  let divergent = false
  let fresh = 0
  let repeat = 0
  for (const e of ev) {
    if (e.type === 'verify') {
      if (divergent) repeat++
      else fresh++
      divergent = true
    } else if (e.type === 'full' || e.type === 'repair') divergent = false
  }

  const fetches = diffs.length
  const bad = n('apply-error') + n('http-error') + n('network-error')
  rows.push({
    run,
    liveMin: round1(secs / 60),
    fetches,
    patch: n('patch'),
    empty: n('empty'),
    fallback: n('fallback'),
    applyErr: n('apply-error'),
    httpErr: n('http-error') + n('network-error'),
    fallbackPct: fetches ? round1((n('fallback') / fetches) * 100) : null,
    errorPct: fetches ? round1((bad / fetches) * 100) : null,
    pushKB: round1(bytes / 1000),
    poll15KB: round1(poll15 / 1000),
    poll60KB: round1(poll60 / 1000),
    vs15s: bytes ? round1(poll15 / bytes) : null,
    vs60s: bytes ? round1(poll60 / bytes) : null,
    reqPerMin: secs ? round1(reqs / (secs / 60)) : null,
    mismatches: fresh + repeat,
    independent: fresh,
  })
  Object.assign(tot, {
    secs: tot.secs + secs,
    fetches: tot.fetches + fetches,
    patch: tot.patch + n('patch'),
    empty: tot.empty + n('empty'),
    fallback: tot.fallback + n('fallback'),
    applyErr: tot.applyErr + n('apply-error'),
    httpErr: tot.httpErr + n('http-error') + n('network-error'),
    bytes: tot.bytes + bytes,
    poll15: tot.poll15 + poll15,
    poll60: tot.poll60 + poll60,
    reqs: tot.reqs + reqs,
    mismatches: tot.mismatches + fresh + repeat,
    independent: tot.independent + fresh,
  })
}

if (rows.filter((r) => r.fetches !== undefined).length > 1) {
  rows.push({
    run: 'TOTAL',
    liveMin: round1(tot.secs / 60),
    fetches: tot.fetches,
    patch: tot.patch,
    empty: tot.empty,
    fallback: tot.fallback,
    applyErr: tot.applyErr,
    httpErr: tot.httpErr,
    fallbackPct: tot.fetches ? round1((tot.fallback / tot.fetches) * 100) : null,
    errorPct: tot.fetches ? round1(((tot.applyErr + tot.httpErr) / tot.fetches) * 100) : null,
    pushKB: round1(tot.bytes / 1000),
    poll15KB: round1(tot.poll15 / 1000),
    poll60KB: round1(tot.poll60 / 1000),
    vs15s: tot.bytes ? round1(tot.poll15 / tot.bytes) : null,
    vs60s: tot.bytes ? round1(tot.poll60 / tot.bytes) : null,
    reqPerMin: tot.secs ? round1(tot.reqs / (tot.secs / 60)) : null,
    mismatches: tot.mismatches,
    independent: tot.independent,
  })
}
console.table(rows)
