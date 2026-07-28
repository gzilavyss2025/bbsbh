#!/usr/bin/env node
// Hand-run spike probe for the MLB Stats API's undocumented diffPatch mode
// (`/api/v1.1/game/{gamePk}/feed/live/diffPatch?startTimecode=...`). NOT part
// of the app, NEVER imported by src/, and NEVER run on a cron — like
// game-buzz.mjs, this is deliberately terminal-only because it handles
// unsealed score data. It prints only counts and byte sizes, never a score,
// run total, or team result, so its output is safe to paste into a PR.
//
// Usage:
//   node scripts/probe-diffpatch.mjs --replay --gamePk=823035 --interval=60
//   node scripts/probe-diffpatch.mjs --gamePk=<live gamePk> --polls=20 --interval=60
//
// --replay walks a Final game's full timestamp history and simulates a
// poller at --interval, giving a deterministic full-game distribution in
// minutes. Live mode (no --replay) polls a genuinely in-progress game in
// real time for --polls ticks. Either way the script:
//   1. fetches diffPatch for the interval and applies it to the last base
//      via a vendored, IMMUTABLE RFC 6902 applier (returns a new root —
//      an in-place applier would defeat the reveal-cache identity check
//      ADR-0007 depends on, so the probe deliberately measures the same
//      discipline production would need)
//   2. fetches a straight full feed for the same tick
//   3. deep-compares the two and records byte counts (raw + gzip)
// Output: a table to stdout, plus a JSON summary written to
// .scratch/live-feed-diffpatch/probe-{gamePk}-{interval}s.json

import { gzipSync } from 'node:zlib'
import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://statsapi.mlb.com'

function parseArgs(argv) {
  const args = { polls: 20, interval: 60, replay: false }
  for (const raw of argv) {
    const [key, value] = raw.replace(/^--/, '').split('=')
    if (key === 'replay') args.replay = true
    else if (key === 'gamePk') args.gamePk = value
    else if (key === 'polls') args.polls = Number(value)
    else if (key === 'interval') args.interval = Number(value)
  }
  if (!args.gamePk) {
    throw new Error('Usage: node scripts/probe-diffpatch.mjs --gamePk=<id> [--replay] [--polls=N] [--interval=seconds]')
  }
  return args
}

async function getJsonWithBytes(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`MLB API ${res.status} for ${url}`)
  const text = await res.text()
  return { json: JSON.parse(text), rawBytes: Buffer.byteLength(text), gzipBytes: gzipSync(text).length }
}

// --- Minimal, immutable RFC 6902 (JSON Patch) applier -----------------
// Deliberately vendored rather than a dependency: the op set observed live
// (add/remove/replace/copy) is small, and whether to add a real dependency
// is a productionization decision, not a spike one. `move`/`test` are
// implemented too since the wire format could use them even though this
// probe hasn't observed them yet — see the summary's `opsSeen` field.

function unescapePointerToken(token) {
  return token.replace(/~1/g, '/').replace(/~0/g, '~')
}

function parsePointer(pointer) {
  if (pointer === '') return []
  if (!pointer.startsWith('/')) throw new Error(`Invalid JSON Pointer: ${pointer}`)
  return pointer.slice(1).split('/').map(unescapePointerToken)
}

function getIn(root, tokens) {
  let node = root
  for (const token of tokens) {
    if (node == null) return undefined
    node = Array.isArray(node) ? node[token === '-' ? node.length - 1 : Number(token)] : node[token]
  }
  return node
}

function applyOp(root, op) {
  const tokens = parsePointer(op.path)
  const lastToken = tokens[tokens.length - 1]
  const parentTokens = tokens.slice(0, -1)
  const parent = tokens.length === 0 ? undefined : getIn(root, parentTokens)

  const setAt = (container, token, value) => {
    if (Array.isArray(container)) {
      const index = token === '-' ? container.length : Number(token)
      container.splice(index, 0, value)
    } else {
      container[token] = value
    }
  }
  const removeAt = (container, token) => {
    if (Array.isArray(container)) {
      const index = token === '-' ? container.length - 1 : Number(token)
      return container.splice(index, 1)[0]
    }
    const value = container[token]
    delete container[token]
    return value
  }
  const replaceAt = (container, token, value) => {
    if (Array.isArray(container)) {
      const index = token === '-' ? container.length - 1 : Number(token)
      container[index] = value
    } else {
      container[token] = value
    }
  }

  switch (op.op) {
    case 'add':
      if (tokens.length === 0) return op.value
      setAt(parent, lastToken, structuredClone(op.value))
      return root
    case 'remove':
      removeAt(parent, lastToken)
      return root
    case 'replace':
      if (tokens.length === 0) return structuredClone(op.value)
      replaceAt(parent, lastToken, structuredClone(op.value))
      return root
    case 'move': {
      const fromTokens = parsePointer(op.from)
      const fromParent = getIn(root, fromTokens.slice(0, -1))
      const value = removeAt(fromParent, fromTokens[fromTokens.length - 1])
      setAt(parent, lastToken, value)
      return root
    }
    case 'copy': {
      const fromTokens = parsePointer(op.from)
      const value = structuredClone(getIn(root, fromTokens))
      setAt(parent, lastToken, value)
      return root
    }
    case 'test': {
      const actual = getIn(root, tokens)
      assert.deepStrictEqual(actual, op.value, `test op failed at ${op.path}`)
      return root
    }
    default:
      throw new Error(`Unsupported JSON Patch op: ${op.op}`)
  }
}

// Applies a list of RFC 6902 ops to `base` WITHOUT mutating it — returns a
// new root object. This is the property a production integration must
// preserve (ADR-0007): the reveal-progress cache invalidates on object
// identity, so an in-place patcher would silently freeze stale derivations.
function applyPatchImmutable(base, ops) {
  let root = structuredClone(base)
  for (const op of ops) {
    root = applyOp(root, op)
  }
  return root
}

// --- Tick sources -------------------------------------------------------

async function fetchTimestamps(gamePk) {
  const { json } = await getJsonWithBytes(`${BASE}/api/v1.1/game/${gamePk}/feed/live/timestamps`)
  return json
}

async function fetchFullFeed(gamePk, timecode) {
  const suffix = timecode ? `?timecode=${timecode}` : ''
  return getJsonWithBytes(`${BASE}/api/v1.1/game/${gamePk}/feed/live${suffix}`)
}

async function fetchDiffPatch(gamePk, startTimecode, endTimecode) {
  const endParam = endTimecode ? `&endTimecode=${endTimecode}` : ''
  return getJsonWithBytes(`${BASE}/api/v1.1/game/${gamePk}/feed/live/diffPatch?startTimecode=${startTimecode}${endParam}`)
}

// --- Tick processing ------------------------------------------------------

function processTick({ base, diffResponse, fullResponse }) {
  const isPatch = Array.isArray(diffResponse.json)
  let merged = base
  let applyError = null
  if (isPatch) {
    try {
      for (const entry of diffResponse.json) {
        merged = applyPatchImmutable(merged, entry.diff)
      }
    } catch (error) {
      applyError = error.message
    }
  } else {
    merged = diffResponse.json // endpoint degraded to a full feed object
  }

  let divergence = null
  if (!applyError) {
    try {
      assert.deepStrictEqual(merged, fullResponse.json)
    } catch {
      const sameStringified = JSON.stringify(merged) === JSON.stringify(fullResponse.json)
      divergence = sameStringified ? 'key-order-only' : 'semantic'
    }
  }

  const opsSeen = isPatch ? diffResponse.json.flatMap((entry) => entry.diff.map((op) => op.op)) : []

  return {
    shape: isPatch ? 'patch' : 'full-feed-fallback',
    diffEntries: isPatch ? diffResponse.json.length : 0,
    opsSeen,
    applyError,
    divergence,
    rawBytesDiff: diffResponse.rawBytes,
    gzipBytesDiff: diffResponse.gzipBytes,
    rawBytesFull: fullResponse.rawBytes,
    gzipBytesFull: fullResponse.gzipBytes,
    // Re-base on the FRESH full feed whenever the merge didn't verify, so a
    // single bad tick doesn't cascade divergences through the rest of the run.
    nextBase: applyError || divergence === 'semantic' ? fullResponse.json : merged,
  }
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0
  const index = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length))
  return sortedValues[index]
}

function summarize(ticks, gamePk, interval) {
  const bytesFullTotal = ticks.reduce((sum, t) => sum + t.rawBytesFull, 0)
  const bytesDiffTotal = ticks.reduce((sum, t) => sum + t.rawBytesDiff, 0)
  const gzipFullTotal = ticks.reduce((sum, t) => sum + t.gzipBytesFull, 0)
  const gzipDiffTotal = ticks.reduce((sum, t) => sum + t.gzipBytesDiff, 0)
  const gzipDiffSorted = ticks.map((t) => t.gzipBytesDiff).sort((a, b) => a - b)

  return {
    gamePk,
    interval,
    polls: ticks.length,
    patchResponses: ticks.filter((t) => t.shape === 'patch').length,
    fullFeedFallbacks: ticks.filter((t) => t.shape === 'full-feed-fallback').length,
    applyErrors: ticks.filter((t) => t.applyError).length,
    divergences: ticks.filter((t) => t.divergence).length,
    keyOrderOnlyDiffs: ticks.filter((t) => t.divergence === 'key-order-only').length,
    bytesFullTotal,
    bytesDiffTotal,
    gzipFullTotal,
    gzipDiffTotal,
    reductionRatioGzip: gzipDiffTotal > 0 ? gzipFullTotal / gzipDiffTotal : null,
    p50GzipDiffBytes: percentile(gzipDiffSorted, 50),
    p95GzipDiffBytes: percentile(gzipDiffSorted, 95),
    opsSeen: [...new Set(ticks.flatMap((t) => t.opsSeen))].sort(),
  }
}

function printTable(ticks) {
  console.log(
    ['tick', 'shape', 'entries', 'gzipDiff', 'gzipFull', 'applyError', 'divergence'].join('\t'),
  )
  ticks.forEach((t, i) => {
    console.log(
      [i, t.shape, t.diffEntries, t.gzipBytesDiff, t.gzipBytesFull, t.applyError ?? '', t.divergence ?? ''].join('\t'),
    )
  })
}

// --- Runners --------------------------------------------------------------

async function runReplay({ gamePk, interval }) {
  const timestamps = await fetchTimestamps(gamePk)
  if (timestamps.length < 2) throw new Error(`Not enough timestamps for gamePk ${gamePk} to replay`)

  // Build a subsequence of timestamps spaced ~`interval` seconds apart by
  // walking the real timestamp list (statsapi emits one per event, not one
  // per second) and taking the first entry at or past each interval boundary.
  const toEpochSeconds = (ts) => {
    // format: YYYYMMDD_HHMMSS (UTC)
    const y = ts.slice(0, 4), mo = ts.slice(4, 6), d = ts.slice(6, 8)
    const h = ts.slice(9, 11), mi = ts.slice(11, 13), s = ts.slice(13, 15)
    return Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`) / 1000
  }
  const start = toEpochSeconds(timestamps[0])
  const ticks = []
  let base = null
  let lastTimecode = timestamps[0]
  let nextBoundary = start + interval

  for (const ts of timestamps) {
    if (base === null) {
      base = (await fetchFullFeed(gamePk, ts)).json
      continue
    }
    if (toEpochSeconds(ts) < nextBoundary) continue
    nextBoundary = toEpochSeconds(ts) + interval

    const [diffResponse, fullResponse] = await Promise.all([
      fetchDiffPatch(gamePk, lastTimecode, ts),
      fetchFullFeed(gamePk, ts),
    ])
    const result = processTick({ base, diffResponse, fullResponse })
    ticks.push(result)
    base = result.nextBase
    lastTimecode = ts
  }
  return ticks
}

async function runLive({ gamePk, polls, interval }) {
  const initial = await fetchFullFeed(gamePk)
  let base = initial.json
  let lastTimecode = base.metaData?.timeStamp
  if (!lastTimecode) throw new Error('Live game feed carries no metaData.timeStamp — cannot start diffPatch polling')

  const ticks = []
  for (let i = 0; i < polls; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000))
    const [diffResponse, fullResponse] = await Promise.all([
      fetchDiffPatch(gamePk, lastTimecode),
      fetchFullFeed(gamePk),
    ])
    const result = processTick({ base, diffResponse, fullResponse })
    ticks.push(result)
    base = result.nextBase
    lastTimecode = fullResponse.json.metaData?.timeStamp ?? lastTimecode
  }
  return ticks
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(`Probing gamePk=${args.gamePk} mode=${args.replay ? 'replay' : 'live'} interval=${args.interval}s`)

  const ticks = args.replay ? await runReplay(args) : await runLive(args)
  if (ticks.length === 0) {
    console.log('No ticks produced — game may be too short, or too recent for a full timestamp history.')
    return
  }

  printTable(ticks)
  const summary = summarize(ticks, args.gamePk, args.interval)
  console.log('\nSummary:')
  console.log(JSON.stringify(summary, null, 2))

  const outDir = path.join('.scratch', 'live-feed-diffpatch')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `probe-${args.gamePk}-${args.interval}s.json`)
  await writeFile(outPath, JSON.stringify(summary, null, 2))
  console.log(`\nWrote ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
