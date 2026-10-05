// The background "?" report (issue #1446): which events are sent, what a
// report may carry, and the endpoint that receives it. A report holds ids,
// image URLs and flags only, never a score or any game text.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REPORT_CAP,
  buildHeadshotReport,
  sanitizeHeadshotReport,
  shouldReportHeadshot,
} from '../src/lib/headshot/report.js'
import handler from '../api/headshot-report.js'

const QMARK = { kind: 'monogram-shown', shown: '?', component: 'Headshot', personId: 42, teamId: 158, hasName: false }

test('shouldReportHeadshot: only a drawn "?" is reported', () => {
  assert.equal(shouldReportHeadshot(QMARK, new Set()), true)
  assert.equal(shouldReportHeadshot({ ...QMARK, shown: 'J' }, new Set()), false)
  assert.equal(shouldReportHeadshot({ ...QMARK, kind: 'logo-shown' }, new Set()), false)
  assert.equal(shouldReportHeadshot({ ...QMARK, kind: 'load-error' }, new Set()), false)
})

test('shouldReportHeadshot: once per component and person, and capped per session', () => {
  const sent = new Set()
  assert.equal(shouldReportHeadshot(QMARK, sent), true)
  assert.equal(shouldReportHeadshot(QMARK, sent), false, 'same face again')
  assert.equal(shouldReportHeadshot({ ...QMARK, component: 'PitcherPhoto' }, sent), true)
  for (let i = 0; i < REPORT_CAP; i++) shouldReportHeadshot({ ...QMARK, personId: 1000 + i }, sent)
  assert.equal(shouldReportHeadshot({ ...QMARK, personId: 9999 }, sent), false, 'cap reached')
})

test('buildHeadshotReport: attaches the recent log entries for the same person', () => {
  const log = [
    { at: 1, kind: 'load-error', personId: 42, step: 0, url: 'https://img.mlbstatic.com/a' },
    { at: 2, kind: 'load-error', personId: 7, step: 0 },
    { at: 3, kind: 'load-error', personId: 42, step: 1, url: 'https://img.mlbstatic.com/a?retry=1' },
  ]
  const r = buildHeadshotReport(QMARK, log)
  assert.equal(r.kind, 'monogram-shown')
  assert.deepEqual(r.recent.map((e) => e.step), [0, 1])
})

test('sanitizeHeadshotReport: keeps the known fields, drops everything else', () => {
  const r = sanitizeHeadshotReport({
    ...QMARK,
    online: true,
    score: '5-3',
    description: 'Ohtani homers',
    recent: [{ kind: 'load-error', step: 1, url: 'https://img.mlbstatic.com/a', note: 'secret' }],
  })
  assert.equal(r.personId, 42)
  assert.equal(r.online, true)
  assert.equal('score' in r, false)
  assert.equal('description' in r, false)
  assert.equal('note' in r.recent[0], false)
  assert.equal(r.recent[0].step, 1)
})

test('sanitizeHeadshotReport: a URL is kept only for an MLB image host, and is length-capped', () => {
  const ok = sanitizeHeadshotReport({ ...QMARK, url: 'https://img.mlbstatic.com/x' })
  assert.equal(ok.url, 'https://img.mlbstatic.com/x')
  assert.equal('url' in sanitizeHeadshotReport({ ...QMARK, url: 'https://evil.example/x' }), false)
  assert.equal('url' in sanitizeHeadshotReport({ ...QMARK, url: `https://img.mlbstatic.com/${'a'.repeat(400)}` }), false)
})

test('sanitizeHeadshotReport: rejects a non-object or an unknown kind', () => {
  assert.equal(sanitizeHeadshotReport(null), null)
  assert.equal(sanitizeHeadshotReport('x'), null)
  assert.equal(sanitizeHeadshotReport({ kind: 'anything-else' }), null)
})

const post = (body, extra = {}) =>
  new Request('https://t.example/api/headshot-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TestAgent/1.0' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...extra,
  })

async function withLog(fn) {
  const real = console.log
  const lines = []
  console.log = (...a) => lines.push(a.join(' '))
  try {
    return { res: await fn(), lines }
  } finally {
    console.log = real
  }
}

test('endpoint: a valid report is logged once, sanitized, with the user agent, and answers 204', async () => {
  const { res, lines } = await withLog(() => handler(post({ ...QMARK, score: '5-3' })))
  assert.equal(res.status, 204)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /^\[headshot-report\] /)
  const logged = JSON.parse(lines[0].replace('[headshot-report] ', ''))
  assert.equal(logged.personId, 42)
  assert.equal(logged.ua, 'TestAgent/1.0')
  assert.equal('score' in logged, false)
})

test('endpoint: only POST, only valid reports, only small bodies', async () => {
  const get = await withLog(() => handler(new Request('https://t.example/api/headshot-report')))
  assert.equal(get.res.status, 405)
  const bad = await withLog(() => handler(post({ kind: 'nope' })))
  assert.equal(bad.res.status, 400)
  const junk = await withLog(() => handler(post('not json')))
  assert.equal(junk.res.status, 400)
  const big = await withLog(() => handler(post(JSON.stringify({ ...QMARK, pad: 'x'.repeat(5000) }))))
  assert.equal(big.res.status, 413)
  assert.equal(get.lines.length + bad.lines.length + junk.lines.length + big.lines.length, 0, 'nothing logged')
})
