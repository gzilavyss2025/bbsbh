#!/usr/bin/env node
// The browser suite runs only when Gary asks for it. Two events share this file:
//
// - UserPromptSubmit: when Gary's prompt asks to RUN the browser tests
//   ("run e2e", "run the playwright tests", "run the visual suite"), write a
//   flag for this session. A prompt that only TALKS about e2e sets nothing.
// - PreToolUse (Bash|PowerShell): a command that starts the Playwright test
//   runner (`npm run e2e*`, `npm run visual`, `playwright test`) is refused
//   unless this session holds the flag.
//
// Why a hook and not a doc line: "never, unless asked" must hold for every
// agent and subagent, and a doc line is only advice. The flag lives in the OS
// temp dir, keyed on session_id, so it dies with the session.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SUITE = String.raw`(?:e2e|end[- ]to[- ]end|playwright|browser (?:tests?|suite|specs?)|visual (?:suite|tests?)|invariant specs?)`

// A request to run: "run e2e", "run the e2e tests", "e2e run please",
// "npm run e2e", "go ahead and run playwright on it".
const ASK = new RegExp(
  String.raw`\b(?:run|rerun|re-run|execute|kick off|start)\b[^.?!\n]{0,40}\b${SUITE}|\b${SUITE}\b[^.?!\n]{0,20}\b(?:run|rerun|pass)\b`,
  'i',
)

// The Playwright TEST runner. `playwright install` and the one-off shot
// scripts (`e2e/shots/*.mjs`) are not tests, so they stay open.
const RUNNER = /\bnpm\s+run\s+(?:e2e|visual)\b|\bplaywright(?:\.cmd)?\s+test\b/

export function asksForSuite(prompt) {
  return typeof prompt === 'string' && ASK.test(prompt)
}

export function startsSuite(command) {
  return typeof command === 'string' && RUNNER.test(command)
}

function flagPath(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_')
  return path.join(tmpdir(), 'bbsbh-e2e-ok', safe)
}

function main() {
  let input = {}
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.exit(0)
  }
  const flag = flagPath(input.session_id)

  if (input.hook_event_name === 'UserPromptSubmit') {
    if (asksForSuite(input.prompt)) {
      try {
        mkdirSync(path.dirname(flag), { recursive: true })
        writeFileSync(flag, new Date().toISOString())
      } catch {
        // A flag we cannot write only means the next run is refused; the
        // refusal says what to do.
      }
    }
    process.exit(0)
  }

  if (startsSuite(input.tool_input?.command) && !existsSync(flag)) {
    process.stderr.write(
      'Refused: the browser suite (npm run e2e / npm run visual / playwright test) ' +
        'runs only when Gary asks for it in this session. Verify with npm test, ' +
        'npm run lint and a dev-server link instead. If Gary did ask and this ' +
        'hook missed it, ask him to type "run e2e".\n',
    )
    process.exit(2)
  }
  process.exit(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
