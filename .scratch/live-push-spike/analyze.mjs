// Net traffic of the push-driven design against a fixed full-feed poll, from events.jsonl.
//   node analyze.mjs <runDir> [<runDir> ...]
// Sizes are gzip of the re-serialized body. A fallback costs the failed diff PLUS the full
// refetch that follows it. The poll baseline is one full feed per tick at 15 s and at 60 s,
// over the live stretch of the run (from the first in-play patch to the last event).
// Prints counts, bytes and ratios only. No values.
import { readFileSync } from 'node:fs'

const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0)
const rows = []
const tot = { secs: 0, fetches: 0, patch: 0, empty: 0, fallback: 0, applyErr: 0, httpErr: 0, pushBytes: 0, poll15: 0, poll60: 0, reqs: 0 }
for (const dir of process.argv.slice(2)) {
  const ev = readFileSync(`${dir}/events.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const diffs = ev.filter((e) => e.type === 'diff')
  const first = diffs.find((e) => e.outcome === 'patch' && e.ageSec < 300)
  const from = first ? first.t : 0
  const live = ev.filter((e) => e.t >= from)
  const liveDiffs = live.filter((e) => e.type === 'diff')
  const n = (o) => liveDiffs.filter((e) => e.outcome === o).length
  const fetches = liveDiffs.length
  const diffBytes = liveDiffs.reduce((a, e) => a + (e.gz || 0), 0)
  const resyncs = live.filter((e) => e.type === 'full' && e.why !== 'open')
  const fullBytes = resyncs.reduce((a, e) => a + e.gz, 0)
  const fullSize = median(ev.filter((e) => e.type === 'full').map((e) => e.gz))
  const secs = Math.max(1, ((ev.at(-1)?.t || 0) - from) / 1000)
  const pushBytes = diffBytes + fullBytes
  const pct = (x) => (fetches ? Math.round((x / fetches) * 1000) / 10 : null)
  Object.assign(tot, { secs: tot.secs + secs, fetches: tot.fetches + fetches, patch: tot.patch + n('patch'), empty: tot.empty + n('empty'), fallback: tot.fallback + n('fallback'), applyErr: tot.applyErr + n('apply-error'), httpErr: tot.httpErr + n('http-error') + n('network-error'), pushBytes: tot.pushBytes + pushBytes, poll15: tot.poll15 + Math.floor(secs / 15) * fullSize, poll60: tot.poll60 + Math.floor(secs / 60) * fullSize, reqs: tot.reqs + fetches + resyncs.length })
  rows.push({
    run: dir.split('/').pop(),
    liveMin: Math.round(secs / 6) / 10,
    fetches,
    patch: n('patch'), empty: n('empty'), fallback: n('fallback'), applyErr: n('apply-error'), httpErr: n('http-error') + n('network-error'),
    fallbackPct: pct(n('fallback')), errorPct: pct(n('apply-error') + n('http-error') + n('network-error')),
    pushKB: Math.round(pushBytes / 100) / 10,
    poll15KB: Math.round((Math.floor(secs / 15) * fullSize) / 100) / 10,
    poll60KB: Math.round((Math.floor(secs / 60) * fullSize) / 100) / 10,
    reductionVs15s: pushBytes ? Math.round(((Math.floor(secs / 15) * fullSize) / pushBytes) * 10) / 10 : null,
    reductionVs60s: pushBytes ? Math.round(((Math.floor(secs / 60) * fullSize) / pushBytes) * 10) / 10 : null,
    requestsPerMin: Math.round(((fetches + resyncs.length) / (secs / 60)) * 10) / 10,
  })
}
if (rows.length > 1) {
  const p = (x) => (tot.fetches ? Math.round((x / tot.fetches) * 1000) / 10 : null)
  rows.push({
    run: 'TOTAL', liveMin: Math.round(tot.secs / 6) / 10, fetches: tot.fetches, patch: tot.patch, empty: tot.empty, fallback: tot.fallback, applyErr: tot.applyErr, httpErr: tot.httpErr,
    fallbackPct: p(tot.fallback), errorPct: p(tot.applyErr + tot.httpErr), pushKB: Math.round(tot.pushBytes / 100) / 10,
    poll15KB: Math.round(tot.poll15 / 100) / 10, poll60KB: Math.round(tot.poll60 / 100) / 10,
    reductionVs15s: Math.round((tot.poll15 / tot.pushBytes) * 10) / 10, reductionVs60s: Math.round((tot.poll60 / tot.pushBytes) * 10) / 10,
    requestsPerMin: Math.round((tot.reqs / (tot.secs / 60)) * 10) / 10,
  })
}
console.table(rows)
