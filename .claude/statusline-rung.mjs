#!/usr/bin/env node
// Status line: folder | model + effort + ladder rung | context % | rate limits.
// Node, not jq: jq is not installed on this Windows machine, which is why the old
// bash script (statusline-command.sh) never showed the model.
//
// The ladder is in memory/model-effort-ladder.md and .claude/skills/improve-prompt:
//   1 Haiku 4.5 | 2-5 Sonnet 5.5 low/medium/high/xhigh(+max) | 6-9 Opus 5.5
//   medium(+low)/high/xhigh/max | 10 Fable 5.1
//
// Quiet flag: the repo hook design-work-flag.mjs writes a file when design files are
// edited. While that flag is fresh, a rung below 3 or at 9 and above shows in amber.
// Nothing else changes colour. The script never throws and always prints a line.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DESIGN_FLOOR = 3 // below this, a design job is probably under-powered
const DESIGN_CEILING = 9 // at or above this, a design job is probably over-powered
const FLAG_MAX_AGE_MS = 30 * 60 * 1000

const AMBER = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const SONNET_55 = { low: 2, medium: 3, high: 4, xhigh: 5, max: 5 }
const OPUS_55 = { low: 6, medium: 6, high: 7, xhigh: 8, max: 9 }

// Returns { label, rung } where rung is a number, or null for a model off the ladder.
export function rungFor(modelId, displayName, effort) {
  const id = String(modelId || '').toLowerCase()
  const m = /claude-(haiku|sonnet|opus|fable)-(\d+)-(\d+)/.exec(id)
  const label = m
    ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}.${m[3]}`
    : displayName || id || 'model?'
  if (!m) return { label, rung: null }
  const [, family, major, minor] = m
  const v = `${major}.${minor}`
  if (family === 'haiku' && v === '4.5') return { label, rung: 1 }
  if (family === 'sonnet' && v === '5.5') return { label, rung: SONNET_55[effort] ?? null }
  if (family === 'opus' && v === '5.5') return { label, rung: OPUS_55[effort] ?? null }
  if (family === 'fable' && v === '5.1') return { label, rung: 10 }
  return { label, rung: null }
}

export function designFlag(rung, flagFresh) {
  if (!flagFresh || rung == null) return ''
  if (rung < DESIGN_FLOOR) return 'low for design'
  if (rung >= DESIGN_CEILING) return 'more than design needs'
  return ''
}

function flagIsFresh(sessionId) {
  try {
    const safe = String(sessionId || '').replace(/[^A-Za-z0-9_-]/g, '')
    // "any" is the hook's fallback when the hook input had no session id.
    return [safe, 'any'].filter(Boolean).some((name) => {
      const file = path.join(homedir(), '.claude', 'rung-flags', `${name}.json`)
      return existsSync(file) && Date.now() - statSync(file).mtimeMs < FLAG_MAX_AGE_MS
    })
  } catch {
    return false
  }
}

export function render(input, fresh) {
  const cwd = input?.workspace?.current_dir || input?.cwd || process.cwd()
  const effort = input?.effort?.level
  const { label, rung } = rungFor(input?.model?.id, input?.model?.display_name, effort)
  const flag = designFlag(rung, fresh)

  let model = label
  if (effort) model += ` ${effort}`
  model += rung == null ? '' : ` r${rung}`
  const parts = [`PS ${cwd}`]
  parts.push(flag ? `${AMBER}${model} - ${flag}${RESET}` : model)

  const ctx = input?.context_window?.used_percentage
  if (typeof ctx === 'number') parts.push(`${DIM}ctx ${Math.round(ctx)}%${RESET}`)

  const five = input?.rate_limits?.five_hour?.used_percentage
  const seven = input?.rate_limits?.seven_day?.used_percentage
  const rate = []
  if (typeof five === 'number') rate.push(`5h ${Math.round(five)}%`)
  if (typeof seven === 'number') rate.push(`7d ${Math.round(seven)}%`)
  if (rate.length) parts.push(`${DIM}${rate.join(' / ')}${RESET}`)
  return parts.join(' | ')
}

function main() {
  let input = {}
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    // Show a bare line rather than nothing.
  }
  process.stdout.write(render(input, flagIsFresh(input?.session_id)))
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  try {
    main()
  } catch {
    process.stdout.write('status line error')
  }
}
