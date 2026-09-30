#!/usr/bin/env node
// Guards the rule that ONE client reaches statsapi.mlb.com from Node (#1116).
//
// Every generator in scripts/ and every research script in .scratch/ calls
// getJson(path) from scripts/lib/statsapi.mjs. That client holds the retry
// policy, the timeout option, the DNS-in-the-sandbox error and the opt-in research
// cache. A script that builds its own `https://statsapi.mlb.com/...` URL and
// fetches it gets none of that, and it grows its own retry loop with its own
// numbers, which is how five generators came to keep five opinions.
//
// This guard fails when a .mjs, .cjs or .js file under scripts/ or .scratch/
// (except the client itself, and this file):
//   1. names the host `statsapi.mlb.com` on a line that is not a comment, or
//   2. uses STATSAPI_BASE, the constant the client builds its URLs from (use
//      statsapiUrl(path) to RECORD an address, getJson(path) to fetch one), or
//   3. (scripts/ only) names cachedGetJson. The research cache is for .scratch:
//      a generator must never read it, because the nightly data must be fresh.
//
// Comment lines are skipped: a header may say where its data comes from.
//
// OUT OF SCOPE, on purpose: src/, api/, test/ and e2e/. src/api/statsapi.js is
// the browser's own client, with a timeout and a service-worker rule (ADR-0004)
// a Node script has no use for. api/ holds the Vercel functions, which run on
// their own runtime. test/ and e2e/ replay captured feeds and may name the host
// in a fixture. None of them is a Node caller of the live API.
//
// A file that must keep the host sits in ALLOWLIST with a one-line reason. The
// list is a ratchet like check-dir-size.mjs's BUDGETS: an entry whose file no
// longer needs it fails, so the list can only shrink.
//
// Run by `npm run lint`.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ROOTS = ['scripts', '.scratch']
const EXTS = ['.mjs', '.cjs', '.js']

// The client, and this guard (its regexes name the host).
export const EXEMPT = new Set(['scripts/lib/statsapi.mjs', 'scripts/check-statsapi-client.mjs'])

// Files that name the host and are NOT a way around the client. Each says why.
export const ALLOWLIST = {
  'scripts/check-feed-shape-drift.mjs':
    'its message names the host; the check re-fetches each fixture from the sourceUrl recorded in the fixture manifest',
  '.scratch/club-live-overlay/probe-degrade.mjs':
    'blocks the wire with a Playwright route glob so the page degrades; it calls nothing',
  '.scratch/home-transactions/build-report.mjs':
    'the host is text inside the report HTML that names its source; no call is made',
  '.scratch/team-one-scroll/count-requests.mjs':
    'counts the traffic a Playwright page makes, sorted by host; it makes no call of its own',
}

const HOST = /statsapi\.mlb\.com/
const BASE = /\bSTATSAPI_BASE\b/
const CACHE = /\bcachedGetJson\b/

const norm = (p) => p.split('\\').join('/')

// The lines of `source` that are code, as [lineNumber, text]. A line that opens
// with //, /* or * is a comment, and so is every line inside a /* ... */ block.
export function codeLines(source) {
  const out = []
  let inBlock = false
  source.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (inBlock) {
      if (line.includes('*/')) inBlock = false
      return
    }
    if (line.startsWith('//')) return
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true
      return
    }
    if (line.startsWith('*')) return
    out.push([i + 1, raw])
  })
  return out
}

// Every way `source` (the text of the file at repo-relative `file`) goes around
// the client: [{ line, rule, text }]. The pure half, tested in
// test/statsapi-client-guard.test.js.
export function findViolations(source, file = '') {
  const inScripts = norm(file).startsWith('scripts/')
  const found = []
  for (const [line, text] of codeLines(source)) {
    if (HOST.test(text)) found.push({ line, rule: 'host', text: text.trim() })
    if (BASE.test(text)) found.push({ line, rule: 'base', text: text.trim() })
    if (inScripts && CACHE.test(text)) found.push({ line, rule: 'cache', text: text.trim() })
  }
  return found
}

export function listSources(root = ROOT, roots = ROOTS) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git') continue
      const path = join(dir, name)
      const info = statSync(path)
      if (info.isDirectory()) walk(path)
      else if (EXTS.some((e) => name.endsWith(e))) out.push(norm(relative(root, path)))
    }
  }
  for (const r of roots) walk(join(root, r))
  return out.sort()
}

const HELP = {
  host: 'builds a statsapi.mlb.com URL. Call getJson(path) from scripts/lib/statsapi.mjs instead (import path relative to this file).',
  base: 'uses STATSAPI_BASE. Fetch with getJson(path); to record an address, use statsapiUrl(path).',
  cache: 'names cachedGetJson in scripts/. The research cache is for .scratch only: a generator must read fresh data.',
}

function main() {
  const problems = []
  const used = new Set()
  const files = listSources()
  for (const file of files) {
    if (EXEMPT.has(file)) continue
    const found = findViolations(readFileSync(join(ROOT, file), 'utf8'), file)
    if (!found.length) continue
    if (file in ALLOWLIST) {
      used.add(file)
      continue
    }
    for (const v of found) problems.push(`${file}:${v.line}: ${HELP[v.rule]}\n      ${v.text}`)
  }

  for (const file of Object.keys(ALLOWLIST)) {
    if (used.has(file)) continue
    problems.push(
      `${file}: sits in ALLOWLIST but no longer names the host (or is gone). Delete the entry in scripts/check-statsapi-client.mjs.`,
    )
  }

  if (problems.length) {
    console.error('\n✗ A script reaches statsapi.mlb.com around the shared client (#1116).\n')
    for (const p of problems) console.error(`  ${p}\n`)
    process.exit(1)
  }
  console.log(
    `✓ One statsapi client — ${files.length} files under ${ROOTS.join(' and ')} checked, ` +
      `${Object.keys(ALLOWLIST).length} allowlisted.`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
