// The browser suite runs only when Gary asks (.claude/hooks/e2e-on-request.mjs).
// These pin the two regexes: which prompts count as asking, and which commands
// count as starting the suite.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asksForSuite, startsSuite } from '../.claude/hooks/e2e-on-request.mjs'

test('a prompt that asks to run the browser suite sets the flag', () => {
  for (const p of [
    'run e2e',
    'Run the e2e tests on this branch',
    'go ahead and run playwright',
    'please rerun the invariant specs',
    'npm run e2e for the slate spec',
    'kick off the visual suite',
    'e2e run please',
  ]) assert.equal(asksForSuite(p), true, p)
})

test('a prompt that only talks about the browser suite does not', () => {
  for (const p of [
    'what if we completely got rid of e2e tests',
    'i feel like we should make them extremely optional',
    'the e2e suite has never been green on main',
    'why is playwright installed?',
    '',
    undefined,
  ]) assert.equal(asksForSuite(p), false, String(p))
})

test('commands that start the Playwright test runner are caught', () => {
  for (const c of [
    'npm run e2e',
    'npm run e2e -- e2e/smoke.spec.js',
    'E2E_PORT=5172 npm run visual',
    'npx playwright test e2e/smoke.spec.js --project=mobile',
    'cd ../wt && npx playwright test',
    'node_modules/.bin/playwright.cmd test',
  ]) assert.equal(startsSuite(c), true, c)
})

test('other commands are not', () => {
  for (const c of [
    'npm test',
    'npm run lint',
    'npm run dev:2',
    'npx playwright install chromium',
    'node e2e/shots/poster-shot.mjs /08122026/milsd/preview out.png',
    'grep -rn e2e docs',
  ]) assert.equal(startsSuite(c), false, c)
})
