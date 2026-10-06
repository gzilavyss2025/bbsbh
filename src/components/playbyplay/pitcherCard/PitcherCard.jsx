import { fetchPitcherLastGame, fetchPitcherSeasonLine } from '../../../api/game.js'
import { fetchPitcherPostseasonCareer } from '../../../api/postseason/pitcherCareer.js'
import { fetchPitchArsenalFor, pitchArsenalFor } from '../../../api/pitchArsenal.js'
import { useAsync } from '../../../hooks/useAsync.js'
import {
  entryFlag,
  isPostseason,
  pitchTiles,
  pitcherRole,
  restLabel,
  showCareerRow,
  showPostseasonRow,
} from '../../../lib/pitcherCard/card.js'
import { PitcherNotice } from '../PitcherNotice.jsx'
import { LastAppearance } from './LastAppearance.jsx'
import { PitchMix } from './PitchMix.jsx'
import { SeasonLines } from './SeasonLines.jsx'

// The FULL Now Pitching card (#1344): the PitcherNotice header, then his season
// line (and a postseason line), an animated scene of his pitch arcs with one
// tile per pitch, and his last appearance. Shown only when an arm TAKES THE
// MOUND — HalfInning.jsx's card when `isFreshPitcher`, and PlayByPlay.jsx's
// mid-half `pitching_substitution` card. Everywhere else (the persistent
// header, ReliefRepeat) keeps the plain header: the card repeats down the feed,
// and a full card on every repeat makes a half many screens long.
//
// SPOILER FOOTING. Inside the innings viewer, so inside the scope (ADR-0034).
// Nothing here is reveal-only and nothing reads linescore.js or derive.js:
// both stat lines END THE DAY BEFORE this game (fetchPitcherSeasonLine,
// ADR-0088), the last appearance is strictly before it (doubleheader-safe,
// fetchPitcherLastGame), the pitch mix is a completed-game season total, and
// no decision from an earlier game in the series is shown (the postseason
// row's decision column is a dash; the last appearance has none).
//
// `relief`: he enters as a reliever (any arm after the first half his club
// pitched). Drives "Starter in relief" and "Pitched yesterday".
export function PitcherCard({ feed, relief, pitcher, teamId, teamName, className, label, entering }) {
  const game = feed?.gameData ?? {}
  const officialDate = game.datetime?.officialDate ?? null
  const season = game.game?.season ?? null
  const gameType = game.game?.type ?? 'R'
  const gameNumber = game.game?.gameNumber ?? 1
  const sportId = game.teams?.home?.sport?.id ?? 1
  const id = pitcher?.id
  // A position player on the mound has no arsenal worth drawing. Pitchers are
  // '1'; a two-way player ('Y') pitches for real.
  const position = game.players?.[`ID${id}`]?.primaryPosition?.code ?? '1'
  const positionPlayer = position !== '1' && position !== 'Y'

  const { data } = useAsync(
    async () => {
      if (!id || !officialDate) return null
      const [line, post, last, shard] = await Promise.all([
        fetchPitcherSeasonLine(id, season, sportId, officialDate),
        isPostseason(gameType) ? fetchPitcherSeasonLine(id, season, sportId, officialDate, { postseason: true }) : null,
        fetchPitcherLastGame(id, season, officialDate, gameNumber),
        // MLB and AAA only: AA and below carry no pitch tracking.
        sportId === 1 || sportId === 11 ? fetchPitchArsenalFor(id, { seasonYear: season }) : null,
      ])
      // His earlier Octobers: one extra yearByYear request, only in a postseason
      // game, and it ends the day before this one like `post` (ADR-0088).
      const career = isPostseason(gameType) ? await fetchPitcherPostseasonCareer(id, season, post) : null
      return { line, post, career, last, shard }
    },
    [id, officialDate, gameNumber, season, sportId, gameType],
  )

  const role = pitcherRole(data?.line)
  const tiles = positionPlayer ? [] : pitchTiles(pitchArsenalFor(data?.shard, id, sportId === 1))
  const flag = data ? entryFlag({ role, relief, last: data.last, officialDate }) : null

  return (
    <div className={`pcard ${className ?? ''}`}>
      <PitcherNotice
        pitcher={pitcher}
        teamId={teamId}
        teamName={teamName}
        label={label}
        entering={entering}
        flag={flag}
      />
      {data && (
        <>
          <SeasonLines
            role={role}
            line={data.line}
            post={showPostseasonRow(gameType, data.post) ? data.post : null}
            season={season}
            career={showCareerRow(gameType, data.career, data.post) ? data.career : null}
            debut={!data.line && !data.last}
            sportId={sportId}
          />
          {tiles.length > 0 && <PitchMix tiles={tiles} lefty={pitcher.hand === 'L'} name={pitcher.name} />}
          {data.last && (
            <LastAppearance
              last={data.last}
              season={season}
              sportId={sportId}
              rest={restLabel(role, data.last, officialDate)}
            />
          )}
        </>
      )}
    </div>
  )
}
