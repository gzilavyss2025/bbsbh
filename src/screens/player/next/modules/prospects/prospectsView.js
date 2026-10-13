import { prospectRankView } from '../../../../../api/player/prospectRankHistory.js'
import { prospectBadge } from '../../../../../api/prospects.js'
import { teamClubName } from '../../../../../lib/teams.js'

// The Prospect rankings board's rows (#1927). Pure. The list history, the debut row's place and the
// credit lines are prospectRankView's; the snapshot adds today's two ranks. Null with no ranking on file.
// A rank reads "#14", never "of X" and never a bar (Gary, #1927).

export function prospectsView({ history, snapshot, playerId, debutYear, currentSeason }) {
  const { rank, orgRank, orgTeamId } = prospectBadge(snapshot, playerId)
  const base = prospectRankView({ history, playerId, debutYear, currentRank: rank, currentSeason })
  const entries = base?.entries ?? (rank ? [{ kind: 'today', rank }] : [])

  let prev = null
  const rows = entries.map((e) => {
    if (e.kind === 'debut') return { tone: 'debut', year: e.season, label: 'Debuted', rank: '', delta: '' }
    if (e.kind === 'today') {
      return { tone: 'today', year: 'Today', label: 'Current list · MLB Pipeline', rank: `#${e.rank}`, delta: '' }
    }
    const diff = prev == null ? null : prev - e.rank
    prev = e.rank
    return {
      tone: 'rank',
      year: e.season,
      label: e.sourceLabel,
      rank: `#${e.rank}`,
      delta: diff == null ? '' : diff === 0 ? '=' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`,
    }
  })
  if (orgRank) {
    const club = teamClubName(orgTeamId)
    rows.push({ tone: 'today', year: 'Today', label: club ? `${club} org list` : 'Org list', rank: `#${orgRank}`, delta: '' })
  }
  if (!rows.length) return null

  const lists = rows.filter((r) => r.tone === 'rank').length
  return {
    rows,
    badge: lists ? `${lists} ${lists === 1 ? 'list' : 'lists'}` : 'Prospect',
    note: base ? base.note : !rank ? '' : 'No earlier lists on file.',
    credits: base?.credits ?? [],
  }
}
