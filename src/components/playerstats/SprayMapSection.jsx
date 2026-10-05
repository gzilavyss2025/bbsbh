import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { SprayMap } from '../charts/SprayMap.jsx'
import { fetchSprayFor, sprayView } from '../../api/spray.js'
import { useAsync } from '../../hooks/useAsync.js'
import { SeasonStack } from '../season/SeasonStack.jsx'

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
// A season view (#1202), like FoulCard: `seasonYear` and `label` are the
// picked season, and `vs` stacks a second season's map under it.
//
// Deliberately ONE self-contained block, title and all, so the whole card
// relocates as a two-line move when the player page is split into tabs.
export function SprayMapSection({ playerId, group, asOf, seasonYear, label, vs = null }) {
  const skip = !!asOf || group !== 'hitting'
  const { data } = useAsync(
    () => (skip ? Promise.resolve(null) : fetchSprayFor(playerId, { seasonYear })),
    [skip, playerId, seasonYear],
  )
  const { data: before } = useAsync(
    () => (skip || vs == null ? Promise.resolve(null) : fetchSprayFor(playerId, { seasonYear: vs })),
    [skip, playerId, vs],
  )
  const view = skip ? null : sprayView(data, playerId)
  const prev = skip || vs == null ? null : sprayView(before, playerId)
  if (!view && !prev) return null

  const note = label ? `${label} · where his hits land` : 'where his hits land'
  return (
    <>
      <SectionHead look="rule" note={note}>Spray map</SectionHead>
      {vs == null ? (
        <SprayMap view={view} />
      ) : (
        <SeasonStack
          empty="Too few balls in play on file"
          seasons={[
            { year: label, body: view && <SprayMap view={view} /> },
            { year: vs, body: prev && <SprayMap view={prev} /> },
          ]}
        />
      )}
    </>
  )
}
