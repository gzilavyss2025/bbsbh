#!/usr/bin/env node
// One GitHub issue per failing nightly step (Gary, 2026-11-04). Every generator
// runs with continue-on-error, so a broken one shows a green step and only the
// last step goes red; the failure email then says nothing about which. This
// opens a needs-triage issue for each failed step, comments on it when the step
// fails again, and closes it the first night the step passes. A step the input
// gates skipped (scripts/nightly/inputs.mjs) proves nothing, so its issue stays.
//
// Run as the job's last step with STEPS_JSON=${{ toJSON(steps) }}, RUN_URL and
// GH_TOKEN; it drives the `gh` CLI the runner ships with. The step log is
// linked, not quoted: a job cannot read its own logs until it has finished.
import { execFileSync } from 'node:child_process'

export const titleFor = (id) => `Nightly data: step "${id}" failed`

// steps: the workflow's `steps` context ({ id: { outcome } }); open: the open
// issues as [{ number, title }].
export function planIssues(steps, open) {
  const byTitle = new Map(open.map((i) => [i.title, i.number]))
  const plan = { open: [], comment: [], close: [] }
  for (const [id, { outcome }] of Object.entries(steps)) {
    const number = byTitle.get(titleFor(id))
    if (outcome === 'failure') {
      if (number) plan.comment.push({ id, number })
      else plan.open.push(id)
    } else if (outcome === 'success' && number) {
      plan.close.push({ id, number })
    }
  }
  return plan
}

function main() {
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' })
  const steps = JSON.parse(process.env.STEPS_JSON ?? '{}')
  const run = process.env.RUN_URL ?? ''
  const day = new Date().toISOString().slice(0, 10)
  const open = JSON.parse(gh('issue', 'list', '--state', 'open', '--search', 'in:title "Nightly data: step"', '--json', 'number,title', '--limit', '100'))
  const plan = planIssues(steps, open)
  for (const id of plan.open) {
    gh('issue', 'create', '--title', titleFor(id), '--label', 'needs-triage', '--body',
      `The nightly data step \`${id}\` failed on ${day}.\n\nStep log: ${run}\n\n` +
        'This issue closes itself the first night the step passes (scripts/nightly/failure-issues.mjs).')
  }
  for (const { id, number } of plan.comment) gh('issue', 'comment', String(number), '--body', `\`${id}\` failed again on ${day}: ${run}`)
  for (const { id, number } of plan.close) gh('issue', 'close', String(number), '--comment', `\`${id}\` passed on ${day}: ${run}`)
  console.log(`failure issues: ${plan.open.length} opened, ${plan.comment.length} commented, ${plan.close.length} closed`)
}

if (import.meta.main) main()
