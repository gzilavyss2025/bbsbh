// Prints the run's answer at the end: the list of pages that changed between
// the base server and the branch server, then any page that could not be shot.
// Playwright's own exit code is already non-zero when either list is not empty.

import { BASE, BRANCH } from './setup.js'

export default class ChangedReporter {
  changed = []
  broken = []

  onTestEnd(test, result) {
    if (result.status === 'passed' || result.status === 'skipped') return
    const width = test.parent.project()?.name
    // A shot that differs gets an "-actual.png" attachment (the branch image).
    const shots = result.attachments
      .map((a) => a.name.match(/^(.*)-actual\.png$/)?.[1])
      .filter(Boolean)
    if (shots.length) {
      for (const shot of shots) this.changed.push(`${width.padEnd(6)} ${shot}`)
    } else {
      const reason = (result.error?.message ?? result.status).split('\n')[0]
      this.broken.push(`${width.padEnd(6)} ${test.title}: ${stripAnsi(reason)}`)
    }
  }

  onEnd() {
    const out = [`\n[visual] base ${BASE}  ->  branch ${BRANCH}`]
    if (!this.changed.length && !this.broken.length) out.push('[visual] no page changed.')
    if (this.changed.length) {
      out.push(`[visual] ${this.changed.length} changed shot(s):`, ...this.changed.sort().map((l) => `  ${l}`))
    }
    if (this.broken.length) {
      out.push(`[visual] ${this.broken.length} failed without a comparison:`, ...this.broken.sort().map((l) => `  ${l}`))
    }
    if (this.changed.length || this.broken.length) {
      out.push('[visual] the report: npx playwright show-report visual-report/html')
    }
    console.log(out.join('\n'))
  }

  printsToStdio() {
    return false
  }
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '')
}
