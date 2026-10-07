import { fetchPitcherLastGame, fetchPitcherSeasonLine } from '../../../api/game.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { entryFlag, pitcherRole } from '../../../lib/pitcherCard/card.js'
import { noticeClass } from '../../../lib/design/noticeClass.js'
import { PitcherPhoto } from '../../playbyplay/PitcherNotice.jsx'

// The cards that dock under the lens's frame (#724, ADR-0092): one at a time,
// and the new-pitcher notice wins over the Entering card. The page picks which
// one from `frontierArmChange` (lib/scorecard/arm.js), whose header says when
// a pitching change becomes visible. Nothing here reads the feed's plays.
//
// Navy, ink and the notice tint only: kraft means a tap lifts a seal
// (ADR-0083), and neither card lifts one.

// At a leadoff with no new arm: "Entering Bottom 3", who pitches, and who is
// new or moved on defense. The page drops it after the half's first tap.
export function EnteringCard({ title, pitcherLine, defense }) {
  return (
    <div className="sc-entering">
      <p className="sc-entering__title">{title}</p>
      {pitcherLine && <p className="sc-entering__pitcher">{pitcherLine}</p>}
      <p className="sc-entering__defense">{defense}</p>
    </div>
  )
}

// The new-pitcher notice: PitcherNotice's own parts on the same tier-1 notice
// ground (the event Notice frame, as the feed's callers pass it), drawn as ONE button that opens the pitcher
// sheet. Not PitcherNotice itself: its name is a player link, and a link
// inside a button is two controls in one.
export function ArmNotice({ feed, arm, onOpen }) {
  const { pitcher, team, relief } = arm
  const flag = useEntryFlag(feed, pitcher.id, relief)
  // The card draws an arsenal at MLB and Triple-A only (PitcherCard.jsx).
  const sportId = feed?.gameData?.teams?.home?.sport?.id ?? 1
  const more = sportId === 1 || sportId === 11 ? 'Arsenal · last time out ›' : 'Last time out ›'
  return (
    <button type="button" className={`pitchernotice ${noticeClass({ tone: 'event', className: 'pitchernotice--pbp' })} sc-armnotice`} onClick={onOpen}>
      <PitcherPhoto personId={pitcher.id} name={pitcher.name} teamId={team.id} />
      <span className="pitchernotice__body">
        <span className="pitchernotice__now">Now pitching{team.name ? ` for the ${team.name}` : ''}</span>
        <span className="pitchernotice__pitcher">
          <span>{pitcher.name || '—'}</span>
          <span className="pitchernotice__badges">
            {pitcher.jersey ? <span className="pitchernotice__jersey">{pitcher.jersey}</span> : null}
            {pitcher.hand ? <span className="pitchernotice__hand">{pitcher.hand}HP</span> : null}
          </span>
        </span>
        {flag && <span className="pitchernotice__flag">{flag}</span>}
      </span>
      <span className="sc-armnotice__more">{more}</span>
    </button>
  )
}

// The notice's flag ("Pitched yesterday", "Starter in relief"), by the card's
// own rule (entryFlag). Both reads end the day before this game (ADR-0088), so
// the flag says nothing about this game. A first arm in inning 1 is no
// reliever and has no flag, so he costs no fetch.
function useEntryFlag(feed, id, relief) {
  const game = feed?.gameData ?? {}
  const officialDate = game.datetime?.officialDate ?? null
  const season = game.game?.season ?? null
  const gameNumber = game.game?.gameNumber ?? 1
  const sportId = game.teams?.home?.sport?.id ?? 1
  const { data } = useAsync(async () => {
    if (!relief || !id || !officialDate) return null
    const [line, last] = await Promise.all([
      fetchPitcherSeasonLine(id, season, sportId, officialDate),
      fetchPitcherLastGame(id, season, officialDate, gameNumber),
    ])
    return entryFlag({ role: pitcherRole(line), relief, last, officialDate })
  }, [relief, id, officialDate, season, gameNumber, sportId])
  return data
}
