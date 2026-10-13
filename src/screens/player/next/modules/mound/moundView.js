// The On the mound card's pure view (#1893). workload.json's apps in, the two tabs' drawings out:
// the days-since track and the calendar of recent outings. No React, no fetch.
import { dayIndex, turnStripFor } from '../../../../../api/workload.js'
import { monthDay } from '../../../../../lib/dates.js'

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// workload.json keeps postseason apps too (their rest days are real); the season totals stay regular season.
const ROUND = { F: 'WC', D: 'DS', L: 'CS', W: 'WS', P: 'PS' }
const ROLE_WORD = { SP: 'Starter', RP: 'Reliever', CL: 'Closer' }
const BULLPEN_DAYS = 14 // the same window as the day strip
const MAX_TURN_DAYS = 14 // past this a starter is out of turn (api/workload.js)
const OUTINGS = 10

export const daysSince = (ymd, today) => dayIndex(today) - dayIndex(ymd)
const ceil10 = (n) => Math.ceil(n / 10) * 10
const pct = (n, of) => +((n / of) * 100).toFixed(2)
const isoOf = (idx) => new Date(idx * 86400000).toISOString().slice(0, 10)

// A starter opens on Starter, a reliever or a closer on Bullpen; a card with one tab opens on it.
export function defaultTab(fileRole, tabs) {
  const want = fileRole === 'SP' ? 'starter' : 'bullpen'
  return tabs.includes(want) ? want : tabs[0]
}

// The rail: a tick a day from the last outing, today at `since`, the usual gap as a zone ahead of it.
export function trackFor(since, usual, lastYmd) {
  if (since > MAX_TURN_DAYS) return { since, outOfTurn: true }
  const days = Math.max(8, since + 2, (usual?.max ?? 0) + 1)
  const ticks = Array.from({ length: days + 1 }, (_, i) => {
    const dt = lastYmd ? new Date((dayIndex(lastYmd) + i) * 86400000) : null
    return { left: pct(i, days), on: i === since, dow: dt ? WEEKDAY[dt.getUTCDay()] : '', md: dt ? monthDay(dt.toISOString()) : '' }
  })
  const nowLeft = pct(since, days)
  const zone = usual && usual.max > since ? { left: nowLeft, width: pct(usual.max - since, days) } : null
  return { since, days, ticks, nowLeft, zone, usual }
}

// The calendar: a bar sits at its date, a bracket spans the days between outings, the last one ends at today.
// `apps` run oldest first. `from` (a day index) pins the left edge; else it is three days before the first app.
// `hatch` marks relief outings (a starter's card). A long idle stretch is cut at MAX_TURN_DAYS past his last
// outing and today is not drawn (`live` false): the track already says how long, and the bars stay readable.
export function calendarFor(apps, today, maxP, { from, usual, hatch } = {}) {
  const idxs = apps.map((a) => dayIndex(a.d))
  const todayIdx = dayIndex(today)
  const end = Math.min(todayIdx, idxs.at(-1) + MAX_TURN_DAYS)
  const live = end === todayIdx
  const t0 = from ?? idxs[0] - 3
  const span = end - t0
  const x = (idx) => pct(idx - t0, span)
  const minGap = Math.min(99, ...idxs.slice(1).map((v, i) => v - idxs[i]), end - idxs.at(-1)) || 1 // a doubleheader's two apps share a day
  const w = Math.min(4.2, +(((0.9 * minGap) / span) * 100).toFixed(2))
  const bars = apps.map((a, i) => ({
    left: x(idxs[i]),
    w,
    h: +((a.p / maxP) * 100).toFixed(1),
    p: a.p,
    relief: !!hatch && !a.gs,
    last: i === apps.length - 1,
    post: a.t in ROUND,
    opp: a.o,
    home: a.h,
  }))
  let prevLo = false
  const dates = apps.map((a, i) => {
    const lo = i > 0 && idxs[i] - idxs[i - 1] < 3 && !prevLo
    prevLo = lo
    return { left: x(idxs[i]), t: monthDay(a.d), lo, dense: i % 2 === 1 && (minGap / span) * 100 < 9 }
  })
  const pts = live ? [...idxs, todayIdx] : idxs
  const gaps = pts.slice(1).map((v, i) => {
    const n = v - pts[i]
    const now = live && i === pts.length - 2
    return { left: x(pts[i]), w: pct(n, span), n, now, odd: !!usual && !now && (n < usual.min || n > usual.max) }
  })
  const months = []
  for (let n = t0; n < end; n++) if (isoOf(n).slice(8) === '01' && x(n) < 80) months.push({ left: x(n), lab: MONTH[+isoOf(n).slice(5, 7) - 1] })
  return { bars, dates, gaps, months, live }
}

const lastOf = (a) => ({ md: monthDay(a.d), home: a.h, opp: a.o, p: a.p, tag: ROUND[a.t] ?? '' })

// One pitcher's record (data.pitchers[id]) and the page's cutoff day in, the card out. Null: nothing to draw.
export function moundView(p, today) {
  const apps = (p?.apps ?? []).filter((a) => a.d < today).sort((a, b) => (a.d < b.d ? 1 : -1))
  if (!apps.length) return null
  const s = p.season
  const todayIdx = dayIndex(today)
  const starts = apps.filter((a) => a.gs)
  const recent = apps.filter((a) => dayIndex(a.d) >= todayIdx - BULLPEN_DAYS)
  const views = {}

  if (starts.length) {
    const turn = turnStripFor({ pitchers: { x: p } }, 'x', today)
    const usual = turn?.typicalMin != null ? { min: turn.typicalMin, max: turn.typicalMax } : null
    // Starts only: a swingman's relief outings must not pull the per-start average down.
    const avg = s?.gs > 0 && s.gsPitches != null ? Math.round(s.gsPitches / s.gs) || null : null
    const shown = apps.slice(0, OUTINGS).reverse()
    const maxP = ceil10(Math.max(...shown.map((a) => a.p), avg ?? 0))
    views.starter = {
      head: 'Days since his last start',
      last: lastOf(starts[0]),
      track: trackFor(daysSince(starts[0].d, today), usual, starts[0].d),
      chart: { head: `Last ${shown.length} outings`, avg, avgLabel: avg && `Averages ${avg} pitches per start`, avgPct: avg && pct(avg, maxP), ...calendarFor(shown, today, maxP, { usual, hatch: true }) },
    }
  }
  if (recent.length || !starts.length) {
    const avg = s?.g > 0 ? Math.round(s.pitches / s.g) || null : null
    const shown = recent.slice().reverse()
    const maxP = Math.max(30, ceil10(Math.max(...shown.map((a) => a.p), avg ?? 0)))
    views.bullpen = {
      head: 'Days since his last appearance',
      last: lastOf(apps[0]),
      track: trackFor(daysSince(apps[0].d, today), null, apps[0].d),
      chart: {
        head: `Last ${BULLPEN_DAYS} days`,
        avg,
        avgLabel: avg && `Averages ${avg} pitches per appearance`,
        avgPct: avg && pct(avg, maxP),
        ...(shown.length ? calendarFor(shown, today, maxP, { from: todayIdx - BULLPEN_DAYS }) : { bars: [], dates: [], gaps: [], months: [], live: true }),
      },
    }
  }
  const tabs = ['starter', 'bullpen'].filter((t) => views[t])
  return { role: p.role, roleWord: ROLE_WORD[p.role] ?? 'Pitcher', tabs, tab: defaultTab(p.role, tabs), views }
}
