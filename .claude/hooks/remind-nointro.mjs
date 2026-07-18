#!/usr/bin/env node
// PreToolUse (Bash) advisory hook — a safety net behind the structural
// guarantees (the e2e fixture auto-appends `?nointro`; docs/skills say to use
// it). When a shell command drives the running app at a URL that WOULD pop the
// first-visit welcome modal — the slate (`/` or `/{MMDDYYYY}`) on a fresh
// localStorage — but doesn't carry `?nointro`, print a one-line reminder.
//
// Deliberately non-blocking: it always exits 0 (never denies the tool call),
// only ever emits an advisory on stderr, and never throws — a reminder must
// not become a road block. It matches only slate-shaped localhost URLs, since
// deep game/team/etc. routes don't render the modal and need no flag.
import { readFileSync } from 'node:fs'

try {
  const raw = readFileSync(0, 'utf8')
  const input = JSON.parse(raw || '{}')
  const cmd = input?.tool_input?.command
  if (typeof cmd === 'string') {
    // A localhost app URL that is the bare slate root or a /MMDDYYYY date
    // slate: `localhost:5173/` (end/quote/space) or `localhost:5173/07072026`.
    // Bare slate root (`localhost:5173/`) or a bare date slate
    // (`localhost:5173/07072026`) — but NOT a deeper game route
    // (`.../07072026/milstl/...`), which doesn't render the modal.
    const slate =
      /localhost:\d{4}\/(?:["'\s?#]|$)/.test(cmd) ||
      /localhost:\d{4}\/\d{8}(?:["'\s?#]|$)/.test(cmd)
    if (slate && !/\bnointro\b/.test(cmd)) {
      process.stderr.write(
        'Reminder: testing the slate/home page? Append `?nointro` to the URL ' +
          "so the first-visit welcome modal doesn't cover the screen and steal " +
          'focus (see docs/development.md). e2e specs get this automatically via ' +
          'e2e/fixtures.js.\n',
      )
    }
  }
} catch {
  // A reminder hook must never break a tool call — swallow everything.
}
process.exit(0)
