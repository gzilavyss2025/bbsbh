import { prospectRankView } from '../../../../../api/player/prospectRankHistory.js'
import { prospectBadge } from '../../../../../api/prospects/top100.js'
import { weeklyRanks } from '../../../../../api/prospects/top100History.js'
import { teamClubName } from '../../../../../lib/teams.js'

// The Prospect rankings board's rows (#1927). Pure. The list history, the debut row's place and the
// credit lines are prospectRankView's; the snapshot adds today's two ranks. Null with no ranking on file.
// A rank reads "#14", never "of X" and never a bar (Gary, #1927).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayLabel = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

export function prospectsView({ history, snapshot, playerId, debutYear, currentSeason, weekly = null }) {
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

  // The weekly Top-100 ranks (#2970, Gary picked the dated rows): newest first, shown
  // only from two snapshots on, since one week is just today's rank again.
  const weeks = rank ? weeklyRanks(weekly, playerId) : []

  const lists = rows.filter((r) => r.tone === 'rank').length
  return {
    rows,
    // Drawn under the "Current list" row (the first today row).
    // A week from an earlier year than the newest one says its year, so the list stays readable past New Year.
    weeks: weeks.length >= 2
      ? weeks.map((w) => ({
        key: w.date,
        date: w.date.slice(0, 4) === weeks[0].date.slice(0, 4) ? dayLabel(w.date) : `${dayLabel(w.date)}, ${w.date.slice(0, 4)}`,
        rank: `#${w.rank}`,
      }))
      : [],
    weeksAfter: rows.findIndex((r) => r.tone === 'today'),
    badge: lists ? `${lists} ${lists === 1 ? 'list' : 'lists'}` : 'Prospect',
    note: base ? base.note : !rank ? '' : 'No earlier lists on file.',
    credits: base?.credits ?? [],
  }
}
