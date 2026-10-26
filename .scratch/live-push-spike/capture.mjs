#!/usr/bin/env node
// #2578 spike: capture MLB's gameday websocket pushes, fetch a diffPatch after
// each push, and measure. Standalone. Never imported by the app, never run on
// a cron. Node 22 (global WebSocket and fetch).
//
//   node capture.mjs --gamePk=849805
//   options: --out=<dir>        output folder (default ./out/<gamePk>-<start>)
//            --maxMinutes=480   stop after this long, connected or not
//            --minGapMs=1500    fewest ms between two diff fetches; pushes inside it coalesce
//            --verifyEvery=10   compare every Nth merge with the snapshot served for its stamp
//            --endAtPush        ask diffPatch for an explicit end timecode, the newest push stamp
//            --diag             on a verification mismatch, write structure to diag.jsonl (never use on
//                               a game somebody is watching: a path can say which play changed)
//            --noDiff           socket only, no diff fetches
//
// SPOILER RULE. This script prints no score, no play and no result. It prints
// counts, bytes, timings, state words, and message SHAPES (key names and value
// types, see shape.mjs). Do not add a print of a raw value.
//
// Wire facts used here come from a community Go client, not from MLB docs
// (mlblive cmd/websocket.go): keepalive is the text "Gameday5" every 10 s,
// close code 4200 = game final, 4400 = game not available for subscription.
//
// What summary.json holds: counts and BYTES. The ratios against a fixed poll are computed by
// analyze.mjs from events.jsonl, because the cost of a fallback is the failed diff plus the full
// feed fetched after it, and that needs the event log.
import { gzipSync } from 'node:zlib'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { parseArgs } from '../../scripts/lib/args.mjs'
import { getJson, StatsapiError, statsapiUrl } from '../../scripts/lib/statsapi.mjs'
import { applyPatch } from './patch.mjs'
import { classify, pathPrefix, shape, TIMECODE, timecodeMs } from './shape.mjs'

const args = parseArgs(process.argv.slice(2))
const flag = (v) => v === true || v === 'true'
const gamePk = Number(args.gamePk)
if (!Number.isInteger(gamePk)) {
  console.error('usage: node capture.mjs --gamePk=849805 [--out=dir] [--maxMinutes=480] [--minGapMs=1500] [--verifyEvery=10] [--endAtPush] [--diag] [--noDiff]')
  process.exit(2)
}
const maxMs = Number(args.maxMinutes || 480) * 60_000
const minGapMs = Number(args.minGapMs || 1500)
const verifyEvery = Number(args.verifyEvery || 10)
const doDiff = !flag(args.noDiff)
const endAtPush = flag(args.endAtPush)
const diag = flag(args.diag)
let pushStamp = ''

// The socket is not a fetch, so the shared client's retry policy does not apply to it.
// Its address comes from the client's own base, on the sibling "ws." host.
const WS_URL = statsapiUrl(`/api/v1/game/push/subscribe/gameday/${gamePk}`).replace('https://', 'wss://ws.')
// Every HTTP call goes through the shared client (#1116) with ONE try. A retry
// would hide an error and add 2 s to a timing this spike exists to measure.
const get = (path) => getJson(path, { tries: 1, timeoutMs: 20_000 })
// Gzip size of the re-serialized body. On one feed it came within 0.2% of the wire gzip.
const gzOf = (body) => gzipSync(Buffer.from(JSON.stringify(body))).length
const startedAt = new Date()
const outDir = args.out || `out/${gamePk}-${startedAt.toISOString().replace(/[:.]/g, '').slice(0, 15)}`
mkdirSync(outDir, { recursive: true })
const eventsPath = `${outDir}/events.jsonl`

const t0 = Date.now()
const since = () => Date.now() - t0
const ev = (type, fields = {}) => appendFileSync(eventsPath, JSON.stringify({ t: since(), type, ...fields }) + '\n')
const clock = () => {
  const s = Math.floor(since() / 1000)
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
// The only console output. Callers pass numbers and fixed words.
const say = (msg) => console.log(`[${clock()}] ${msg}`)

const stats = {
  gamePk,
  startedAt: startedAt.toISOString(),
  connects: 0,
  closes: {},
  pushes: 0,
  acks: 0,
  pushBytes: 0,
  shapes: {},
  pushTimes: [],
  diff: { patch: 0, empty: 0, fallback: 0, odd: 0, httpError: 0, applyError: 0, stale: 0, upToDate: 0, endMatch: 0, endMiss: 0 },
  ops: { total: 0, byType: {}, byPrefix: {} },
  // Bytes (gzip). The ratio against a poll lives in analyze.mjs.
  gz: { diffTotal: 0, fullTotal: 0, fullLatest: 0, fullAtVerify: [] },
  ageSec: { patch: [], fallback: [] },
  coalesced: [],
  // mismatch = a divergence found; the merged feed is then replaced by the snapshot (repaired), so one
  // divergence is counted once.
  verify: { runs: 0, equal: 0, mismatch: 0, repaired: 0, inconclusive: 0, mismatchAt: {} },
  fallbackStampIsStart: 0,
}

// ---- feed state ---------------------------------------------------------------
let doc = null // the merged feed, replaced (never mutated) on every update
// Bumped whenever `doc` is replaced from outside an update (a resync or a repair). An update or a
// verification that started before the bump knows its base went stale and drops its result.
let gen = 0
let syncing = false

async function fetchFull() {
  const feed = await get(`/api/v1.1/game/${gamePk}/feed/live`)
  if (feed.gamePk !== gamePk) throw new Error('wrong game in full feed')
  return feed
}

async function resync(why) {
  if (syncing) return
  syncing = true
  try {
    const feed = await fetchFull()
    const gz = gzOf(feed)
    doc = feed
    gen++
    stats.gz.fullLatest = gz
    stats.gz.fullTotal += gz
    ev('full', { why, gz })
  } catch (e) {
    // Keep the old feed: a failed refetch must not stop all later updates.
    ev('full-error', { why, name: e.name })
    say(`full feed fetch failed (${why})`)
    if (!doc) setTimeout(() => resync('retry').then(pump), 5000)
  } finally {
    syncing = false
  }
}

function diffPaths(a, b) {
  // Names of differing top-level and second-level keys. Never values.
  const out = []
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (isDeepStrictEqual(a[k], b[k])) continue
    const sub = [...new Set([...Object.keys(a[k] || {}), ...Object.keys(b[k] || {})])].filter((s) => !isDeepStrictEqual((a[k] || {})[s], (b[k] || {})[s]))
    for (const s of sub.length ? sub : ['']) out.push(`/${k}${s ? '/' + s : ''}`)
  }
  return out
}

async function oneUpdate(coalesced) {
  const base = doc
  const g = gen
  const lastTs = base?.metaData?.timeStamp
  if (!lastTs) return resync('no-timestamp')
  const ageSec = (Date.now() - timecodeMs(lastTs)) / 1000
  const end = endAtPush && pushStamp ? pushStamp : ''
  if (end && end <= lastTs) {
    stats.diff.upToDate++
    ev('diff', { outcome: 'up-to-date' })
    return
  }
  const started = Date.now()
  let body
  try {
    body = await get(`/api/v1.1/game/${gamePk}/feed/live/diffPatch?language=en&startTimecode=${lastTs}${end ? `&endTimecode=${end}` : ''}`)
  } catch (e) {
    const ms = Date.now() - started
    if (e instanceof SyntaxError) {
      stats.diff.odd++
      ev('diff', { outcome: 'not-json', ageSec, ms })
      return resync('not-json')
    }
    stats.diff.httpError++
    ev('diff', { outcome: e instanceof StatsapiError ? 'http-error' : 'network-error', status: e.status, ageSec, ms })
    return resync(e instanceof StatsapiError ? `http-${e.status}` : 'network-error')
  }
  const ms = Date.now() - started
  const gz = gzOf(body)
  stats.gz.diffTotal += gz
  if (gen !== g) {
    // A resync (a reconnect's) installed a newer feed while this request was in flight. The patch was
    // built for the old base, so it is dropped. Its bytes still count as cost.
    stats.diff.stale++
    ev('diff', { outcome: 'stale-drop', ageSec, ms, gz })
    return
  }
  stats.coalesced.push(coalesced)
  if (Array.isArray(body) && body.every((x) => Array.isArray(x?.diff))) {
    if (body.length === 0) {
      stats.diff.empty++
      ev('diff', { outcome: 'empty', ageSec, ms, gz })
      return
    }
    let next = base
    let ops = 0
    try {
      for (const item of body) {
        for (const op of item.diff) {
          stats.ops.byType[op.op] = (stats.ops.byType[op.op] || 0) + 1
          const p = pathPrefix(op.path)
          stats.ops.byPrefix[p] = (stats.ops.byPrefix[p] || 0) + 1
        }
        ops += item.diff.length
        next = applyPatch(next, item.diff)
      }
      if (next.gamePk !== gamePk || typeof next.metaData?.timeStamp !== 'string') throw new Error('sanity')
    } catch (e) {
      stats.diff.applyError++
      ev('diff', { outcome: 'apply-error', name: e.message, ageSec, ms, gz })
      return resync('apply-error')
    }
    stats.diff.patch++
    if (end) stats.diff[next.metaData.timeStamp === end ? 'endMatch' : 'endMiss']++
    stats.ops.total += ops
    stats.ageSec.patch.push(ageSec)
    ev('diff', { outcome: 'patch', ageSec, ms, gz, objects: body.length, ops, fullGz: stats.gz.fullLatest })
    doc = next
    if (verifyEvery > 0 && stats.diff.patch % verifyEvery === 0) await verify()
    return
  }
  if (body && body.gamePk === gamePk && body.metaData) {
    // diffPatch answered with a whole feed. Do NOT keep it: its metaData.timeStamp
    // is often the START stamp while its content is not the state at that stamp (found
    // replaying 870064: the body differs from the snapshot for its own stamp). A
    // patch built on it applied to the wrong base ("bad index"). A plain
    // /feed/live is consistent with its own stamp (12 of 12 checks), so refetch it.
    // That refetch is a measured cost of the design, not a choice made to flatter it.
    stats.diff.fallback++
    stats.ageSec.fallback.push(ageSec)
    if (body.metaData.timeStamp === lastTs) stats.fallbackStampIsStart++
    ev('diff', { outcome: 'fallback', ageSec, ms, gz, stampIsStart: body.metaData.timeStamp === lastTs })
    return resync('fallback')
  }
  stats.diff.odd++
  ev('diff', { outcome: 'odd-shape', ageSec, ms })
  return resync('odd-shape')
}

// Compare the merged feed with the snapshot MLB serves for the same timecode. A divergence is
// counted once and then repaired with the snapshot, so later checks do not count it again.
async function verify() {
  const merged = doc
  const g = gen
  const ts = merged.metaData.timeStamp
  try {
    const want = await get(`/api/v1.1/game/${gamePk}/feed/live?timecode=${ts}`)
    stats.gz.fullAtVerify.push(gzOf(want))
    if (gen !== g) return // a resync replaced the feed meanwhile: nothing to compare
    // The server serves the closest EARLIER stored snapshot when none exists for the stamp
    // we ask for (seen: our stamp 001801, served 001800). Different stamps prove nothing.
    if (want.metaData?.timeStamp !== ts) {
      stats.verify.inconclusive++
      return
    }
    stats.verify.runs++
    if (isDeepStrictEqual(merged, want)) {
      stats.verify.equal++
      return
    }
    stats.verify.mismatch++
    for (const p of diffPaths(merged, want)) stats.verify.mismatchAt[p] = (stats.verify.mismatchAt[p] || 0) + 1
    ev('verify', { equal: false })
    if (diag) writeDiag(merged, want)
    doc = want
    gen++
    stats.verify.repaired++
    ev('repair')
  } catch {
    // a failed verification fetch is not a result
  }
}

function writeDiag(merged, want) {
  const n = (f, o) => {
    try {
      return f(o)
    } catch {
      return null
    }
  }
  const plays = (o) => o.liveData.plays.allPlays.length
  const events = (o) => o.liveData.plays.allPlays.reduce((a, p) => a + p.playEvents.length, 0)
  const idx = (o) => o.liveData.plays.currentPlay.about.atBatIndex
  const deep = []
  // At each differing leaf: its path and what each side holds (absent, null, a type), never the value.
  const kind = (v) => (v === undefined ? 'absent' : v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)
  const walk = (a, b, path, depth) => {
    if (deep.length >= 16 || isDeepStrictEqual(a, b)) return
    if (depth === 0 || a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
      return void deep.push(`${path} | doc ${kind(a)} | snapshot ${kind(b)}`)
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}/${k}`, depth - 1)
  }
  walk(merged, want, '', 9)
  const line = { t: since(), docStamp: merged.metaData.timeStamp, wantStamp: want.metaData.timeStamp, plays: [n(plays, merged), n(plays, want)], playEvents: [n(events, merged), n(events, want)], currentAtBat: [n(idx, merged), n(idx, want)], paths: deep }
  appendFileSync(`${outDir}/diag.jsonl`, JSON.stringify(line) + '\n')
}

// ---- push -> fetch scheduler --------------------------------------------------
let inflight = false
let dirty = false
let coalesced = 0
let lastFetchStart = 0
let timer = null

function onPush() {
  dirty = true
  coalesced++
  pump()
}

async function pump() {
  if (!doDiff || inflight || !dirty) return
  if (!doc) {
    // No feed yet (the first fetch is pending or failed): fetch one, then come back.
    if (!syncing) resync('no-doc').then(pump)
    return
  }
  const wait = lastFetchStart + minGapMs - Date.now()
  if (wait > 0) {
    timer ||= setTimeout(() => {
      timer = null
      pump()
    }, wait)
    return
  }
  inflight = true
  dirty = false
  const n = coalesced
  coalesced = 0
  lastFetchStart = Date.now()
  try {
    await oneUpdate(n)
  } catch (e) {
    ev('update-error', { name: e.name })
    await resync('update-error')
  } finally {
    inflight = false
    if (dirty) pump()
  }
}

// ---- game state (state words only; the fields filter keeps scores out) --------
async function gameState() {
  try {
    const sched = await get(`/api/v1/schedule?gamePk=${gamePk}&fields=dates,games,status,abstractGameState,detailedState`)
    const games = (sched.dates || []).flatMap((d) => d.games || [])
    const g = games.find((x) => x.status?.abstractGameState === 'Live') || games[games.length - 1]
    return { abstract: g?.status?.abstractGameState || 'unknown', detail: String(g?.status?.detailedState || '').slice(0, 40) }
  } catch {
    return { abstract: 'unknown', detail: '' }
  }
}

// ---- socket -------------------------------------------------------------------
let ws = null
let keepalive = null
let attempts = 0
let finished = false
const seenShapes = new Map()

function connect() {
  stats.connects++
  const began = Date.now()
  const sock = new WebSocket(WS_URL) // Node sends no Origin header
  ws = sock
  sock.binaryType = 'arraybuffer'
  let gone = false
  let openedAt = 0
  let ka = null
  // Events from a socket that was given up on (or replaced) must not touch the shared state.
  const current = () => ws === sock && !gone

  sock.onopen = () => {
    if (!current()) {
      try {
        sock.close()
      } catch {
        // already closing
      }
      return
    }
    openedAt = Date.now()
    ev('open', { ms: openedAt - began })
    say(`socket open after ${openedAt - began} ms`)
    ka = keepalive = setInterval(() => sock.readyState === 1 && sock.send('Gameday5'), 10_000)
    if (doDiff) resync('open').then(pump)
  }

  sock.onmessage = (m) => {
    if (!current()) return
    const text = typeof m.data === 'string' ? m.data : Buffer.from(m.data).toString('utf8')
    const bytes = Buffer.byteLength(text)
    const { json, ack } = classify(text)
    if (json === undefined && ack) {
      stats.acks++
      ev('ack', { bytes })
      return
    }
    // Group by structure: the stamp, array lengths and string lengths vary push to push.
    const key = JSON.stringify(json === undefined ? '<non-json>' : shape(json))
      .replace(/\d{8}_\d{6}/g, '<timecode>')
      .replace(/"\d+ x"/g, '"n x"')
      .replace(/<array \d+>/g, '<array>')
      .replace(/<str \d+>/g, '<str>')
    stats.pushes++
    stats.pushBytes += bytes
    stats.pushTimes.push(since())
    if (typeof json?.timeStamp === 'string' && TIMECODE.test(json.timeStamp) && json.timeStamp > pushStamp) pushStamp = json.timeStamp
    stats.shapes[key] = (stats.shapes[key] || 0) + 1
    if (!seenShapes.has(key)) {
      seenShapes.set(key, seenShapes.size + 1)
      say(`new push shape #${seenShapes.size}, ${bytes} bytes: ${key.slice(0, 400)}`)
    }
    ev('push', { bytes, shape: seenShapes.get(key) })
    if (stats.pushes % 25 === 0) say(`pushes ${stats.pushes}`)
    onPush()
  }

  // A failed connection can fire "error" and never "close" (seen: a reconnect after a 1006 died
  // this way, and with nothing left on the event loop Node exited silently). So an error with no
  // close within 3 s counts as a close. `gone` makes sure the close is handled once.
  const onGone = async (code, rawReason, clean) => {
    if (gone) return
    gone = true
    clearInterval(ka)
    sock.onopen = sock.onmessage = sock.onerror = sock.onclose = null
    try {
      sock.close()
    } catch {
      // already closed
    }
    stats.closes[code] = (stats.closes[code] || 0) + 1
    // Print the reason text only for the codes whose meaning is known (the file's own rule: no raw
    // server text on the console). Any other code prints a length.
    const known = code === 1013 || code === 4200 || code === 4400
    const reason = known ? String(rawReason).slice(0, 80) : `${String(rawReason).length} chars`
    ev('close', { code, clean })
    say(`socket closed: code ${code} (${reason})`)
    if (finished) return
    if (since() > maxMs) return finish('max-minutes')
    if (code === 4200) return finish('game-final')
    const st = await gameState()
    ev('state', { abstract: st.abstract, detail: st.detail })
    if (st.abstract === 'Final') return finish('state-final')
    if (code === 4400) {
      say(`game state: ${st.abstract} (${st.detail}); retrying in 30 s`)
      return setTimeout(connect, 30_000)
    }
    // The backoff resets only after a socket stayed up for a minute. A server that accepts and at once
    // closes (1013 "Service overloaded") must not be retried every 2 s.
    if (openedAt && Date.now() - openedAt >= 60_000) attempts = 0
    attempts++
    if (attempts > 500) return finish('too-many-failures')
    const wait = Math.max(code === 1013 ? 30_000 : 0, Math.min(60_000, 2000 * 2 ** (attempts - 1)))
    say(`reconnecting in ${wait / 1000} s (attempt ${attempts})`)
    setTimeout(connect, wait)
  }
  sock.onerror = () => {
    ev('socket-error')
    setTimeout(() => !gone && sock.readyState !== 1 && onGone(1006, '', false), 3000)
  }
  sock.onclose = (e) => onGone(e.code, e.reason, e.wasClean)
  // A connection can hang in CONNECTING with neither "open" nor "error" (seen on the busiest game).
  setTimeout(() => {
    if (gone || sock.readyState !== 0) return
    ev('connect-timeout')
    onGone(1006, '', false)
  }, 20_000)
}

// ---- summary ------------------------------------------------------------------
const pct = (arr, p) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const dist = (arr) => ({ n: arr.length, min: pct(arr, 0), p50: pct(arr, 50), p95: pct(arr, 95), max: arr.length ? Math.max(...arr) : null })

function summary(reason) {
  const gaps = stats.pushTimes.slice(1).map((t, i) => t - stats.pushTimes[i])
  const durationMs = since()
  const d = stats.diff
  const fetches = d.patch + d.empty + d.fallback + d.applyError + d.httpError + d.odd + d.stale
  return {
    finishedBecause: reason,
    durationMin: Math.round(durationMs / 600) / 100,
    ...stats,
    pushTimes: undefined,
    pushGapMs: dist(gaps),
    pushesPerMinute: dist(
      Object.values(
        stats.pushTimes.reduce((m, t) => {
          const k = Math.floor(t / 60_000)
          m[k] = (m[k] || 0) + 1
          return m
        }, {}),
      ),
    ),
    ageSec: { patch: dist(stats.ageSec.patch), fallback: dist(stats.ageSec.fallback) },
    coalesced: dist(stats.coalesced),
    // One definition, the same as analyze.mjs: over every diff request. Bytes are in stats.gz.
    fetches,
    fallbackPct: fetches ? Math.round((d.fallback / fetches) * 1000) / 10 : null,
  }
}

function finish(reason) {
  if (finished) return
  finished = true
  clearInterval(keepalive)
  try {
    ws?.close(1000)
  } catch {
    // already closed
  }
  const s = summary(reason)
  writeFileSync(`${outDir}/summary.json`, JSON.stringify(s, null, 2))
  say(`done (${reason}): ${stats.pushes} pushes, diffs patch ${stats.diff.patch} empty ${stats.diff.empty} fallback ${stats.diff.fallback} error ${stats.diff.httpError + stats.diff.applyError + stats.diff.odd}`)
  say(`summary written to ${outDir}/summary.json`)
  setTimeout(() => process.exit(0), 200)
}

process.on('SIGINT', () => finish('interrupted'))
process.on('SIGTERM', () => finish('terminated'))
// A status line when something moved since the last one; a quiet line every
// 10 minutes otherwise, so hours of waiting before first pitch stay short.
// This tick also enforces --maxMinutes while a socket sits open and silent.
let lastBeat = ''
let quietBeats = 0
setInterval(() => {
  if (finished) return
  if (since() > maxMs) return finish('max-minutes')
  writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary('running'), null, 2))
  const d = stats.diff
  const beat = `pushes ${stats.pushes}, diffs patch ${d.patch} empty ${d.empty} fallback ${d.fallback}, connects ${stats.connects}`
  if (beat !== lastBeat || ++quietBeats % 10 === 0) say(beat)
  lastBeat = beat
}, 60_000) // not unref'd: only finish() ends the process

say(`capturing gamePk ${gamePk}${doDiff ? '' : ' (socket only, no diff fetches)'}${endAtPush ? ' (end at push stamp)' : ''}; output in ${outDir}`)
connect()
