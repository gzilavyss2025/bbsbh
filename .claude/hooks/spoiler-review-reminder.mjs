#!/usr/bin/env node
// PreToolUse (Skill) advisory hook — fires whenever the code-review skill is
// invoked on this repo. General code review checks CLAUDE.md compliance as
// one of many concerns; the spoiler rule is this app's whole point and gets
// missed when it's just one line among many. This forces a dedicated lens
// every time, regardless of which agent/session runs the review.
//
// Deliberately non-blocking: always exits 0, only ever emits an advisory on
// stderr, never throws — a reminder must not become a road block.
import { readFileSync } from 'node:fs'

try {
  const raw = readFileSync(0, 'utf8')
  const input = JSON.parse(raw || '{}')
  const skill = input?.tool_input?.skill
  if (typeof skill === 'string' && skill.split(':').pop() === 'code-review') {
    process.stderr.write(
      'bbsbh code-review note: add a dedicated spoiler-rule review lens, ' +
        "separate from general CLAUDE.md compliance. Its only question: does " +
        'this diff let a score-revealing value exist in the DOM, get fetched, ' +
        'or get computed before the user reveals it — outside a SealBox reveal ' +
        'render function, outside a caller-gated pre-pitch selector ' +
        '(halfIndex <= revealedThrough + 1), or bypassing revealedThrough ' +
        "entirely. See CLAUDE.md's spoiler-rule section and ADR-0001–0010, " +
        "ADR-0034. Report it under its own issue category ('spoiler-rule'), " +
        'not folded into general CLAUDE.md findings. Apply this at every ' +
        'effort level, including low.\n',
    )
  }
} catch {
  // A reminder hook must never break a tool call — swallow everything.
}
process.exit(0)
