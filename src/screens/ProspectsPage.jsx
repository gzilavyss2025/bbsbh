import { fetchAffiliates, fetchRosterIdsForTeams } from '../api/mlb.js'
import { fetchTopProspects, prospectAffiliateMap } from '../api/prospects.js'
import { SPORT_LABEL } from '../lib/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Ledger } from '../components/Ledger.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function generatedLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// Resolves each ranked player's CURRENT level by live roster membership,
// same approach TeamPage.jsx's org-wide prospect table uses (see
// orgProspectsForTeam/prospectAffiliateMap in api/prospects.js) — the
// scraped `levelRaw` string is sometimes ambiguous (e.g. "ALL (2)" for a
// player who's played at multiple levels this season) or stale (a recent
// call-up). `p.teamId` in the snapshot is each player's MLB parent org, so
// this fans out an affiliate-tree + roster lookup per distinct org, then
// flips every org's rosters (its MLB roster plus every full-season
// affiliate) into one global playerId -> team map.
async function resolveCurrentLevels(players) {
  const season = new Date().getFullYear()
  const orgIds = [...new Set(players.map((p) => p.teamId).filter(Boolean))]
  const affiliatesByOrg = await Promise.all(orgIds.map((id) => fetchAffiliates(id, season)))

  const teamById = new Map()
  const rosterTeamIds = new Set()
  orgIds.forEach((orgId, i) => {
    teamById.set(orgId, { id: orgId, sportId: 1 })
    rosterTeamIds.add(orgId)
    for (const aff of affiliatesByOrg[i]) {
      teamById.set(aff.id, aff)
      rosterTeamIds.add(aff.id)
    }
  })

  const rosterIds = await fetchRosterIdsForTeams([...rosterTeamIds])
  const teamByPlayer = prospectAffiliateMap(rosterIds)

  return players.map((p) => {
    const resolvedTeamId = teamByPlayer.get(p.playerId) ?? null
    const resolvedTeam = resolvedTeamId ? teamById.get(resolvedTeamId) : null
    return { ...p, levelLabel: resolvedTeam ? SPORT_LABEL[resolvedTeam.sportId] ?? p.levelRaw : p.levelRaw }
  })
}

async function loadProspects() {
  const snapshot = await fetchTopProspects()
  const players = snapshot.players ?? []
  if (!players.length) return snapshot
  return { ...snapshot, players: await resolveCurrentLevels(players) }
}

// A standalone replica of MLB Pipeline's Top 100 Prospects list, ranked in
// source order (batters and pitchers interleaved, same as the source),
// linking every row straight into this app's own player/team pages. Data is
// a same-origin static snapshot refreshed weekly — see docs/top-prospects.md
// — so this degrades to a friendly empty state rather than an error when the
// snapshot hasn't been generated yet (or the source page's structure broke
// the scrape).
export function ProspectsPage() {
  useDocumentTitle('Top 100 Prospects')
  const { loading, error, data } = useAsync(() => loadProspects(), [])
  const players = data?.players ?? []

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Top 100 Prospects</h1>
      </header>

      {loading && !data && <p className="hint">Loading prospect rankings…</p>}
      {error && <p className="hint hint--error">Couldn’t load prospect rankings. Try again.</p>}

      {data && players.length === 0 && (
        <p className="hint hint--prose">Prospect rankings aren’t available right now — check back later.</p>
      )}

      {players.length > 0 && (
        <>
          <Ledger
            leftCols={2}
            head={['Rk', 'Player', 'Pos', 'Level', 'Team', 'Line']}
            rows={players.map((p) => ({
              key: p.playerId,
              cells: [
                p.rank,
                <PlayerLink key="player" id={p.playerId} className="prospecttable__name">{p.name}</PlayerLink>,
                p.position || DASH,
                p.levelLabel || DASH,
                <TeamLink key="team" id={p.teamId} className="prospecttable__teamlogo">
                  <TeamLogo teamId={p.teamId} name={p.team} size={20} />
                </TeamLink>,
                p.statLine || DASH,
              ],
            }))}
          />
          {data.generatedAt && (
            <p className="hint prospects__caption">Rankings as of {generatedLabel(data.generatedAt)}.</p>
          )}
        </>
      )}
    </div>
  )
}
