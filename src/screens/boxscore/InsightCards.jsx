import { useState } from 'react'
import { resolveCardPlayer } from '../../api/boxscore.js'
import { PerformerCard } from '../../components/player/PerformerCard.jsx'
import { CalloutNote } from '../../components/playbyplay/CalloutNote.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { SectionMasthead } from '../../components/ui/SectionMasthead.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { useRollupNotes } from '../../hooks/callouts/useLastTime.js'

// How many insight CARDS the Insights card shows before folding the rest
// behind a Show-more button (the former-teammates pattern). The notes arrive
// already ranked by worthiness (see computeGameCalloutNotes), so the cap
// keeps the most impactful ones on top without dropping anything.
const INSIGHTS_SHOWN = 6

// Every note about the same player (or, for a club-level note, the same
// team) folds into ONE card with a bullet per note, instead of one card per
// note — a hitter with a streak note AND a platoon split shouldn't get two
// cards competing for grid space. `calloutNotes` arrives globally sorted by
// worthiness (see computeGameCalloutNotes), so a group's position is set by
// its first (i.e. highest-scored) note and the resulting group order stays
// worthiness-ranked without a re-sort.
function groupCalloutNotes(notes) {
  const groups = []
  const byKey = new Map()
  for (const note of notes) {
    const key = note.personId != null ? `p:${note.personId}` : `t:${note.teamId}`
    let group = byKey.get(key)
    if (!group) {
      group = {
        personId: note.personId,
        personName: note.personName,
        teamId: note.teamId,
        teamName: note.teamName,
        oppTeamId: note.oppTeamId,
        oppTeamName: note.oppTeamName,
        notes: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.notes.push(note)
  }
  return groups
}

// The three Statcast superlatives (see computeGameSuperlatives), each
// resolved to the "baseball card" shape PerformerCard renders via
// resolveCardPlayer (boxscore.js). Filters out any superlative whose value or
// player couldn't be resolved (most MiLB parks carry no tracking data at all).
function statcastCards(feed, insights) {
  const {
    maxVelo, maxVeloType, maxVeloPlayerId,
    hardestHit, hardestHitPlayerId,
    longestHit, longestHitPlayerId,
  } = insights ?? {}
  return [
    maxVelo != null && {
      label: 'Fastest pitch',
      player: resolveCardPlayer(feed, maxVeloPlayerId),
      stat: `${maxVelo.toFixed(1)} MPH${maxVeloType ? ` · ${maxVeloType}` : ''}`,
    },
    hardestHit != null && {
      label: 'Hardest hit',
      player: resolveCardPlayer(feed, hardestHitPlayerId),
      stat: `${hardestHit.toFixed(1)} MPH`,
    },
    longestHit != null && {
      label: 'Longest ball',
      player: resolveCardPlayer(feed, longestHitPlayerId),
      stat: `${Math.round(longestHit)} FT`,
    },
  ]
    .filter(Boolean)
    .filter((c) => c.player)
    .map((c) => ({ label: c.label, entry: { ...c.player, stat: c.stat } }))
}

// Whole-game Statcast superlatives — the fastest pitch, the hardest-hit
// ball, the longest ball, whoever owns each — rendered as the same
// PerformerCard "baseball card" tile the past-day recap's Top
// Performers/Statcast Leaders use (headshot, team, stat line). Its own
// full-width card between the linescore column and the two team cards (see
// BoxScoreBody) rather than folded into the Insights card below,
// so the three tiles can lay out as their own row instead of competing with
// the callout-notes waterfall for width. Hidden entirely when the feed
// carried no tracking data (most MiLB parks), same graceful-degrade as the
// per-half Statcast row in the innings view (which keeps its own plain-text
// StatcastCard — no boxscore to resolve a headshot against mid-game).
export function StatcastLeadersCard({ feed, insights }) {
  const cards = statcastCards(feed, insights)
  if (cards.length === 0) return null
  return (
    <Card body="flush" className="bs__statcastCard">
      <SectionMasthead as="h3" title="Statcast Leaders" />
      <div className="bs__statcastRow">
        {cards.map(({ label, entry }) => (
          <div className="bs__statcastCol" key={label}>
            <h4 className="playerline__bucket">{label}</h4>
            <ul className="playerline__list">
              <PerformerCard entry={entry} />
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Every note that fired somewhere in the game (computeGameCalloutNotes, plus a no-hitter's
// "last time" lines, useRollupNotes). Hidden entirely when nothing fired.
export function InsightsCard({ calloutNotes: rolled, feed }) {
  const calloutNotes = useRollupNotes(feed, rolled)
  const [showAll, setShowAll] = useState(false)
  const hasNotes = calloutNotes && calloutNotes.length > 0
  if (!hasNotes) return null
  const groups = groupCalloutNotes(calloutNotes)
  const shownGroups = showAll ? groups : groups.slice(0, INSIGHTS_SHOWN)
  const hiddenCount = groups.length - shownGroups.length
  return (
    <Card body="flush" className="bs__insights">
      <SectionMasthead as="h3" title="Insights" />
      {/* The notes shown one at a time on the play they belong to in the innings view, rolled up
          here as tonight's full set with the game's outcome folded into the record-based ones
          ("moved to 18-2…"), grouped one card per player (or club) with a headshot/logo(s) so
          it's clear at a glance who it's about. A waterfall column layout (see .bs__noteGrid)
          packs the variable-height cards tightly instead of stretching every row to its tallest
          card. Ranked most-impactful-first by the shared worthiness score; the tail waits behind Show more. */}
      <div className="bs__noteGrid">
        {shownGroups.map((group, i) => (
          <InsightNoteCard key={i} group={group} />
        ))}
      </div>
      {hiddenCount > 0 && (
        <Door layout="block" onClick={() => setShowAll(true)}>
          Show {hiddenCount} more {hiddenCount === 1 ? 'insight' : 'insights'}
        </Door>
      )}
    </Card>
  )
}

// One player's (or club's) insight card: the headshot (or, for a note about
// a club rather than a person — a situational team record — that club's
// logo, both logos when it pits two clubs against each other) beside his
// name and a bullet per note that fired for him tonight.
function InsightNoteCard({ group }) {
  return (
    <Card as="div" frame="ledger" body="flush" className="bs__noteCard">
      <span className="bs__noteAvatar">
        {group.personId != null ? (
          <Headshot personId={group.personId} name={group.personName} teamId={group.teamId} className="bs__noteShot" />
        ) : (
          <span className="bs__noteLogos">
            <TeamLogo teamId={group.teamId} name={group.teamName} size={26} />
            {group.oppTeamId != null && (
              <TeamLogo teamId={group.oppTeamId} name={group.oppTeamName} size={26} />
            )}
          </span>
        )}
      </span>
      <span className="bs__noteBody">
        {group.personName && <span className="bs__noteWho">{group.personName}</span>}
        {group.notes.map((note, i) => (
          <CalloutNote key={i} text={note.text} kind={note.kind} link={note.link} />
        ))}
      </span>
    </Card>
  )
}
