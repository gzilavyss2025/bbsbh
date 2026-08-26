#!/usr/bin/env node
// PreToolUse (Bash|WebFetch) advisory hook — fires when a session is about to
// hit statsapi.mlb.com directly, and points it at the live-audited endpoint
// catalog before it spends a call re-discovering something already known.
//
// WHY A HOOK AND NOT A LINE IN CLAUDE.md. docs/MLB_STATS_API.md was
// live-audited end to end (PR #917): every endpoint this app documents or
// calls, checked against the real API and cross-checked against every real
// caller in src/ and scripts/, annotated confirmed / unused / drifted / dead
// / new. That audit is only worth what it saves a future session from
// re-learning one curl call at a time — a dead endpoint, a required param
// that changed. Prose in CLAUDE.md is a request a busy session can
// rationalize past on the way to "just try it"; a hook fires on the call
// itself, every time, whoever is driving. Same reasoning as
// research-diary-reminder.mjs and contender-diary-reminder.mjs.
//
// WHY IT REMINDS RATHER THAN BLOCKS. A first exploratory call is sometimes
// exactly how the catalog finds out it's missing a row — blocking it would be
// backwards. It nags on the way past and leaves the judgement where it
// belongs: check the catalog first when it might already have the answer,
// and add to it when it doesn't, so the next session isn't the one paying
// this cost again.
//
// Stays quiet when the call already references the doc (a session already
// consulting or updating the catalog doesn't need to be told to).
import { readFileSync } from 'node:fs'

const DOC = 'docs/MLB_STATS_API.md'
const TARGET = 'statsapi.mlb.com'

function normalize(text) {
  return String(text ?? '').replace(/\\/g, '/')
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const toolInput = input?.tool_input ?? {}

  const haystack = normalize(
    [toolInput.command, toolInput.url, toolInput.prompt].filter(Boolean).join('\n'),
  )
  if (!haystack.includes(TARGET)) process.exit(0)
  if (haystack.includes(DOC)) process.exit(0)

  process.stderr.write(
    'bbsbh API note: this calls statsapi.mlb.com directly. ' +
      DOC +
      " is a live-audited catalog of this app's whole known API surface (64 " +
      'endpoints as of the PR #917 audit) — every row says confirmed (in use, ' +
      'verified live), unused (documented, verified live, nothing calls it), ' +
      'drifted (required params changed — the row says how), or dead (no ' +
      'longer responds, do not use it). Check there before treating this as a ' +
      'from-scratch exploration; a dead endpoint or a stale required param has ' +
      'probably already been found. If this is genuinely new — a field, param, ' +
      'or endpoint the catalog does not cover — verify it live and add a row. ' +
      'The catalog stays a source of truth only as long as new findings land ' +
      'back in it. A call that already references ' +
      DOC +
      ' does not need this note.\n',
  )
} catch {
  // A reminder hook must never break a tool call — swallow everything.
}
process.exit(0)
