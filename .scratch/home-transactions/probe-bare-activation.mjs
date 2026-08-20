// Follow-up probe for issue #772 decision 3 ("recover plain activations").
//
// probe-coverage.mjs showed 110 MLB-touching activations in 60 days whose
// sentence names NO source list ("Chicago Cubs activated RHP Jayden Murray.").
// Whether letting those in is news or duplicate noise depends entirely on what
// they ECHO. This walks each one's own player rows in a +/- 7 day window and
// classifies what sits next to it.
//
// Run: node .scratch/home-transactions/probe-bare-activation.mjs [days]
import { getJson } from '../../src/api/statsapi.js'
import { txnDate, mentionsInjuredList } from '../../src/api/rehab-policy.js'

const DAYS = Number(process.argv[2] ?? 60)
const end = new Date()
const start = new Date(end.getTime() - DAYS * 86400000)
const iso = (d) => d.toISOString().slice(0, 10)

const mlbIds = new Set(
  ((await getJson('/api/v1/teams?sportId=1')).teams ?? []).map((t) => t.id),
)
const raw = (await getJson(
  `/api/v1/transactions?startDate=${iso(start)}&endDate=${iso(end)}`,
)).transactions ?? []

const touchesMlb = (t) => mlbIds.has(t.fromTeam?.id) || mlbIds.has(t.toTeam?.id)
const isBareActivation = (t) =>
  t.typeCode === 'SC' &&
  /activat/i.test(t.description || '') &&
  !mentionsInjuredList(t) &&
  !/\bfrom the\b/i.test(t.description || '') &&
  !/all-stars? activated/i.test(t.description || '')

const bare = raw.filter((t) => touchesMlb(t) && isBareActivation(t))
console.log(`window ${iso(start)} .. ${iso(end)}`)
console.log(`bare MLB activations (no source named): ${bare.length}\n`)

// Field shape: does the row itself carry a fromTeam?
const shapes = new Map()
for (const t of bare) {
  const k = `from=${t.fromTeam ? (mlbIds.has(t.fromTeam.id) ? 'MLB' : 'non-MLB') : 'none'} to=${t.toTeam ? (mlbIds.has(t.toTeam.id) ? 'MLB' : 'non-MLB') : 'none'}`
  shapes.set(k, (shapes.get(k) ?? 0) + 1)
}
console.log(`field shapes: ${[...shapes].map(([k, n]) => `${k} x${n}`).join(', ')}\n`)

// Every row per person, so we can look around each bare activation.
const byPerson = new Map()
for (const t of raw) {
  const pid = t.person?.id
  if (pid == null) continue
  if (!byPerson.has(pid)) byPerson.set(pid, [])
  byPerson.get(pid).push(t)
}

const dayNum = (d) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000)

// What the bare activation most plausibly completes, most specific first.
// ECHO_WINDOW is +/- 2 days, not same-day: the wire files the activation a day
// after the move it completes often enough that a same-day-only test badly
// under-counts echoes (Justin Lawrence activated the day after his claim,
// David Peterson the day after his trade).
const ECHO_WINDOW = 2
const ARRIVAL_CODES = ['CU', 'SE', 'CLW', 'TR', 'SFA', 'SGN', 'IFA', 'ACQ', 'OBT', 'PUR', 'CP']

function classify(act) {
  const pid = act.person?.id
  const d0 = dayNum(txnDate(act))
  const near = (byPerson.get(pid) ?? [])
    .filter((t) => t !== act)
    .map((t) => ({ t, delta: dayNum(txnDate(t)) - d0 }))
    .filter((x) => Math.abs(x.delta) <= 7)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.delta - b.delta)

  const echoable = near.filter((x) => Math.abs(x.delta) <= ECHO_WINDOW)
  const before = near.filter((x) => x.delta < 0)

  const hit = (pool, pred) => pool.find((x) => pred(x.t))
  const isSigning = (t) => ['SFA', 'SGN', 'IFA'].includes(t.typeCode)
  const isIlPlacement = (t) =>
    t.typeCode === 'SC' && /placed/i.test(t.description || '') && mentionsInjuredList(t)
  const isOtherList = (t) =>
    t.typeCode === 'SC' && /placed|restricted|paternity|bereavement/i.test(t.description || '')
  const isSuspension = (t) => t.typeCode === 'SU' || /suspend/i.test(t.description || '')

  const arrival = ARRIVAL_CODES.map((c) => hit(echoable, (t) => t.typeCode === c)).find(Boolean)

  const m =
    arrival ? [`ECHO of a kept arrival (${arrival.t.typeCode}, ${arrival.delta >= 0 ? '+' : ''}${arrival.delta}d)`, arrival]
    : hit(echoable, isSuspension) ? ['return from SUSPENSION — real news', hit(echoable, isSuspension)]
    : hit(before, isIlPlacement) ? ['earlier IL PLACEMENT — unnamed IL return', hit(before, isIlPlacement)]
    : hit(before, isOtherList) ? ['earlier OTHER-LIST placement', hit(before, isOtherList)]
    : near.length ? [`no arrival within ${ECHO_WINDOW}d — nearest is ${near[0].t.typeCode} ${near[0].delta >= 0 ? '+' : ''}${near[0].delta}d`, near[0]]
    : ['NOTHING within 7 days', null]
  return { label: m[0], evidence: m[1] }
}

const groups = new Map()
for (const act of bare) {
  const { label, evidence } = classify(act)
  if (!groups.has(label)) groups.set(label, [])
  groups.get(label).push({ act, evidence })
}

for (const [label, items] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(items.length).padStart(4)}  ${label}`)
  for (const { act, evidence } of items.slice(0, 4)) {
    console.log(`        ${txnDate(act)} ${act.description}`)
    if (evidence) {
      console.log(`          <- ${txnDate(evidence.t)} (${evidence.delta >= 0 ? '+' : ''}${evidence.delta}d) [${evidence.t.typeCode}] ${evidence.t.description}`)
    }
  }
  console.log()
}
