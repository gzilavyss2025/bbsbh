// The app is mark-heavy: club strip, game cards, treatment tiles. If a winter
// league's clubs have no logo on the CDN, its slate looks broken.
const API = 'https://statsapi.mlb.com'
const LEAGUES = [
  [119, 'AFL'], [132, 'LMP'], [135, 'LVBP'], [131, 'LIDOM'],
  [133, 'PWL'], [595, 'ABL'], [162, 'CS'],
]
for (const [id, label] of LEAGUES) {
  const j = await (await fetch(`${API}/api/v1/teams?sportId=17&leagueIds=${id}&season=2025`)).json()
  const teams = j.teams ?? []
  let withLogo = 0
  let noAbbr = 0
  const missing = []
  for (const t of teams) {
    if (!t.abbreviation) noAbbr++
    const r = await fetch(`https://www.mlbstatic.com/team-logos/${t.id}.svg`, { method: 'HEAD' })
    if (r.ok) withLogo++
    else missing.push(`${t.id} ${t.name}`)
  }
  console.log(
    `${label.padEnd(6)} clubs ${String(teams.length).padStart(2)} | logo ${withLogo}/${teams.length} | no abbreviation ${noAbbr}` +
      (missing.length ? ` | MISSING: ${missing.slice(0, 3).join(', ')}` : ''),
  )
  if (teams[0]) console.log(`        e.g. ${teams.map((t) => `${t.abbreviation || '??'}=${t.name}`).slice(0, 3).join(' | ')}`)
}
