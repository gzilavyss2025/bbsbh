// Gate for update-nightly-data.yml: exits 0 once every MLB game from
// yesterday (US Eastern, matching the officialDate the rest of the nightly
// generators key off) has gone Final — or was Postponed/Cancelled, which
// needs no data. Exits 1 (and lists the stragglers) while any game is still
// Live/Preview, e.g. a suspended game resuming, so the workflow can back off
// and retry rather than running the batch against an incomplete slate.
const BASE = 'https://statsapi.mlb.com'
const SETTLED_STATES = new Set(['Postponed', 'Cancelled'])

function easternDateParts(date) {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function yesterdayEasternDateStr() {
  const { y, m, d } = easternDateParts(new Date())
  const yest = new Date(Date.UTC(y, m - 1, d - 1))
  return `${yest.getUTCFullYear()}-${String(yest.getUTCMonth() + 1).padStart(2, '0')}-${String(yest.getUTCDate()).padStart(2, '0')}`
}

async function main() {
  const dateStr = yesterdayEasternDateStr()
  const res = await fetch(
    `${BASE}/api/v1/schedule?sportId=1&gameType=R,F,D,L,W,A&date=${dateStr}`,
  )
  if (!res.ok) throw new Error(`statsapi ${res.status} /api/v1/schedule`)
  const data = await res.json()
  const games = (data.dates ?? []).flatMap((d) => d.games ?? [])

  if (games.length === 0) {
    console.log(`${dateStr}: no MLB games scheduled — nothing to wait for`)
    return
  }

  const pending = games.filter((g) => {
    const abstract = g.status?.abstractGameState
    const detailed = g.status?.detailedState
    return abstract !== 'Final' && !SETTLED_STATES.has(detailed)
  })

  if (pending.length > 0) {
    for (const g of pending) {
      const away = g.teams?.away?.team?.name ?? '?'
      const home = g.teams?.home?.team?.name ?? '?'
      console.log(`  pending: ${away} @ ${home} — ${g.status?.detailedState}`)
    }
    console.error(`${dateStr}: ${pending.length}/${games.length} game(s) not yet settled`)
    process.exit(1)
  }

  console.log(`${dateStr}: all ${games.length} game(s) settled`)
}

main().catch((err) => {
  console.error(err.stack ?? String(err))
  process.exit(1)
})
