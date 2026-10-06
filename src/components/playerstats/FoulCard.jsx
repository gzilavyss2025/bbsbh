import { useState } from 'react'
import { useNav } from '../../lib/nav.js'
import { foulsPath } from '../../lib/route.js'
import { fetchFoulsFor, batterFoulLine, pitcherFoulLine } from '../../api/fouls.js'
import { useAsync } from '../../hooks/useAsync.js'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { FactGrid } from '../ui/frame/FactGrid.jsx'
import { SeasonStack } from '../season/SeasonStack.jsx'
import { PartOfSeason } from '../season/PartOfSeason.jsx'

// The player page's foul-ball card — his season foul line from the nightly
// gen-fouls.mjs sweep, batter or pitcher flavored to match the stat block
// it sits in. Self-fetching like MilestoneWatchCard. Current-day only: the
// precompute can't be cut to a historical `asOf`, so a spoiler-scoped page
// (linked from a sealed game) hides it — same rule the Milestone Watch
// projection follows. Null data (MiLB, file missing, no line) → no card.
//
// A season view (#1202): `seasonYear` (a year or 'all') and `label` (the years
// it covers) are the Analytics tab's picked season; `vs` stacks a second
// season under it. With neither season's line, no card.
//
// The postseason sits BESIDE the regular season (ADR-0101): his bucket's `post`
// slice, the same shape. A Regular season / Postseason toggle shows once he has
// a postseason line, in either of the seasons on screen.
export function FoulCard({ playerId, group, asOf, seasonYear, label, vs = null }) {
  const navigate = useNav()
  const skip = !!asOf
  // His bucket, not the league — see fetchFoulsFor.
  const { data } = useAsync(
    () => (skip ? Promise.resolve(null) : fetchFoulsFor(playerId, { seasonYear })),
    [skip, playerId, seasonYear],
  )
  const { data: before } = useAsync(
    () => (skip || vs == null ? Promise.resolve(null) : fetchFoulsFor(playerId, { seasonYear: vs })),
    [skip, playerId, vs],
  )
  const [wantPost, setWantPost] = useState(false)
  if (skip) return null

  const lineIn = (d) => (!d ? null : group === 'pitching' ? pitcherFoulLine(d, playerId) : batterFoulLine(d, playerId))
  const hasPost = !!(lineIn(data?.post) || lineIn(before?.post))
  const post = wantPost && hasPost
  const lineOf = (d) => lineIn(post ? d?.post : d)
  const line = lineOf(data)
  const prev = vs == null ? null : lineOf(before)
  if (!line && !prev && !hasPost) return null

  return (
    <div className="foulcard">
      <SectionHead look="rule" note={`${label || 'this season'}${post ? ' · postseason' : ''}`}>
        Foul balls
      </SectionHead>
      {hasPost && <PartOfSeason postseason={post} onChange={setWantPost} />}
      {vs == null ? (
        <FoulTiles line={line} group={group} />
      ) : (
        <SeasonStack
          empty="No foul balls on file"
          seasons={[
            { year: label, body: line && <FoulTiles line={line} group={group} /> },
            { year: vs, body: prev && <FoulTiles line={prev} group={group} /> },
          ]}
        />
      )}
      <button
        type="button"
        className="plink foulcard__door"
        onClick={() => navigate(foulsPath({ seasonYear, vs }))}
      >
        League foul tracker ›
      </button>
    </div>
  )
}

function FoulTiles({ line, group }) {
  const tiles =
    group === 'pitching'
      ? [
          { k: 'Fouled off', v: line.fouls },
          { k: 'Foul rate', v: pct(line.fouls / line.pitches) },
          { k: 'Per whiff', v: line.whiffs > 0 ? (line.fouls / line.whiffs).toFixed(1) : '—' },
        ]
      : [
          { k: 'Fouls', v: line.fouls },
          { k: 'Per game', v: (line.fouls / Math.max(1, line.g)).toFixed(1) },
          { k: 'At 2 strikes', v: line.twoStrikeFouls },
          { k: 'Game high', v: line.maxGameFouls ?? '—' },
        ]
  return (
    <FactGrid>
      {tiles.map((t) => (
        <div className="fact" key={t.k}>
          <dt className="fact__label">{t.k}</dt>
          <dd className="fact__value">{t.v}</dd>
        </div>
      ))}
    </FactGrid>
  )
}

const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—')
