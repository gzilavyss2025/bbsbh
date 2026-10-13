import { prospectRankView } from '../../../../../api/player/prospectRankHistory.js'
import { prospectBadge } from '../../../../../api/prospects.js'
import { teamClubName } from '../../../../../lib/teams.js'

// The Prospect rankings board's rows (#1927). Pure. The list history, the debut row's place and the
// credit lines are prospectRankView's; the snapshot adds today's two ranks. Null with no ranking on file.
// A bar is the place on its list: the file's depth for a past list, 100 for today's Top 100 (the list's
// name). Today's org list has no depth in the store, so it draws no bar.
const bar = (rank, of) => Math.round(((of + 1 - rank) / of) * 100)

export function prospectsView({ history, snapshot, playerId, debutYear }) {
  const { rank, orgRank, orgTeamId } = prospectBadge(snapshot, playerId)
  const base = prospectRankView({ history, playerId, debutYear, currentRank: rank })
  const entries = base?.entries ?? (rank ? [{ kind: 'today', rank }] : [])

  let prev = null
  const rows = entries.map((e) => {
    if (e.kind === 'debut') return { tone: 'debut', year: e.season, label: 'Debuted', rank: '', bar: null, delta: '' }
    if (e.kind === 'today') {
      return { tone: 'today', year: 'Today', label: 'Current list · MLB Pipeline', rank: e.rank, bar: bar(e.rank, 100), delta: '' }
    }
    const diff = prev == null ? null : prev - e.rank
    prev = e.rank
    const label = [e.sourceLabel, e.of && `of ${e.of}`].filter(Boolean).join(' · ')
    return {
      tone: 'rank',
      year: e.season,
      label,
      rank: e.rank,
      bar: e.of ? bar(e.rank, e.of) : null,
      delta: diff == null ? '' : diff === 0 ? '=' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`,
    }
  })
  if (orgRank) {
    const club = teamClubName(orgTeamId)
    rows.push({ tone: 'today', year: 'Today', label: club ? `${club} org list` : 'Org list', rank: orgRank, bar: null, delta: '' })
  }
  if (!rows.length) return null

  const lists = rows.filter((r) => r.tone === 'rank').length
  return {
    rows,
    badge: lists ? `${lists} ${lists === 1 ? 'list' : 'lists'}` : 'Prospect',
    note: base || !rank ? '' : 'No earlier lists on file. Bars show place on a 100-deep list: longer is higher.',
    credits: base?.credits ?? [],
  }
}
