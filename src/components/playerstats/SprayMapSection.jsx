import { SectionTitle } from '../ui/SectionTitle.jsx'
import { SprayMap } from '../charts/SprayMap.jsx'
import { fetchSprayFor, sprayView } from '../../api/spray.js'
import { useAsync } from '../../hooks/useAsync.js'

// The player page's mount for the season spray map. Self-fetching like
// FoulCard and MilestoneWatchCard: it reads the batter's own bucket
// (src/api/spray.js) rather than making PlayerPage load a dataset most players
// never open.
//
// FOUR REASONS IT RENDERS NOTHING, all of them ordinary:
//   • a pitcher's stat block (`group` is not hitting);
//   • a spoiler `asOf` cutoff — the nightly precompute is season-to-date and
//     cannot be cut to a date, so a page reached from a sealed game hides this
//     the same way FoulCard and the Milestone Watch projection do;
//   • no entry in his bucket, which is every level below AAA and every player
//     who has not put a ball in play in a swept game;
//   • under the card's balls-in-play floor (MIN_SPRAY_BIP), where the dots
//     would be anecdotes.
//
// Deliberately ONE self-contained block, title and all, so the whole card
// relocates as a two-line move when the player page is split into tabs.
export function SprayMapSection({ playerId, group, asOf }) {
  const skip = !!asOf || group !== 'hitting'
  const { data } = useAsync(
    () => (skip ? Promise.resolve(null) : fetchSprayFor(playerId)),
    [skip, playerId],
  )
  const view = skip ? null : sprayView(data, playerId)
  if (!view) return null

  return (
    <>
      <SectionTitle title="Spray map" note="where his hits land" />
      <SprayMap view={view} />
    </>
  )
}
