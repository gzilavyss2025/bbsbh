import { fetchPitcherLastGame, fetchPitcherSeasonLine } from '../../../api/game.js'
import { fetchPitcherPostseasonCareer } from '../../../api/postseason/pitcherCareer.js'
import { fetchPitchArsenalFor, pitchArsenalFor } from '../../../api/pitchArsenal.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { keyedCache } from '../../../lib/pitcherCard/cardData.js'
import {
  bandPaint,
  entryFlag,
  isPostseason,
  pitchTiles,
  pitcherRole,
  restLabel,
  showCareerRow,
  showPostseasonRow,
} from '../../../lib/pitcherCard/card.js'
import { PitcherNotice } from '../PitcherNotice.jsx'
import { TABS } from '../cardCopy.js'
import { useArrival } from '../../../hooks/motion/useArrival.js'
import { CardBand, Unfold } from './Arrival.jsx'
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
// the last appearance shows no decision (the postseason rows do show W-L).
//
// `relief`: he enters as a reliever (any arm after the first half his club
// pitched). Drives "Starter in relief" and "Pitched yesterday".
//
// THE NAME BAND WEARS THE PITCHING CLUB'S COLOURS (ADR-0030's 2026-10-14
// addendum): `side` and `treatment` (the jersey both clubs wear, `{ away, home }`)
// resolve the same hand-set triad the lineup cards use, and a club with none
// keeps the house navy. Identity only; no game state reaches the theme.
//
// THE ARRIVAL (ADR-0113, slice 3). The card starts as the plain yellow card. When its data
// arrives the band wipes in over the top, the tab fades, and the three sections unfold
// (Arrival.jsx; it plays only for a fetch the reader watched, so a card with its data in hand
// draws final). The repeat at the head of the next at-bat is this same card: it shares the
// answer through `cardData` below, keyed by arm and game: once the first card has loaded it asks
// the network for nothing and draws complete on its first render (opened directly, with no first
// card, it is the first asker and arrives like any card). `after` renders what sits right below the card and
// arrives with it (the departing arm's line), told whether the card has settled.
const cardData = keyedCache()

export function PitcherCard({ feed, relief, pitcher, teamId, teamName, className, label, entering, side, treatment, after }) {
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

  const key = `${id}|${season}|${sportId}|${gameType}|${officialDate}|${gameNumber}`
  // A read that lost the pitch-arsenal shard (a failed fetch gives null) is shown but not kept, so the next ask retries it.
  const kept = (a) => a != null && (!(sportId === 1 || sportId === 11) || a.shard != null)
  const { data: asked, loading } = useAsync(
    () =>
      cardData.load(key, async () => {
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
        return { key, line, post, career, last, shard }
      }, kept),
    [key],
  )
  // A kept answer is in hand on the first render; otherwise it is the fetch's, and only this key's
  // (useAsync clears the last key's answer in an effect, one render late).
  const data = cardData.peek(key) ?? (asked?.key === key ? asked : null)

  const role = pitcherRole(data?.line)
  const tiles = positionPlayer ? [] : pitchTiles(pitchArsenalFor(data?.shard, id, sportId === 1))
  const flag = data ? entryFlag({ role, relief, last: data.last, officialDate }) : null

  const open = Boolean(data)
  const arrival = useArrival(open)
  const band = bandPaint({ teamId, side, treatment })
  const tab = label ?? TABS.pitching
  return (
    <>
      <div className={`pcard ${arrival} ${className ?? ''}`} style={band.style}>
        <CardBand label={tab} house={band.house} />
        <PitcherNotice
          pitcher={pitcher}
          teamId={teamId}
          teamName={teamName}
          label={label}
          entering={entering}
          flag={flag}
        />
        <Unfold open={open} delay={380}>
          <SeasonLines
            role={role}
            line={data?.line}
            post={showPostseasonRow(gameType, data?.post) ? data.post : null}
            season={season}
            career={showCareerRow(gameType, data?.career, data?.post) ? data.career : null}
            debut={!data?.line && !data?.last}
            sportId={sportId}
          />
        </Unfold>
        <Unfold open={open && tiles.length > 0} delay={435}>
          <PitchMix tiles={tiles} lefty={pitcher?.hand === 'L'} name={pitcher?.name} />
        </Unfold>
        <Unfold open={Boolean(data?.last)} delay={490}>
          <LastAppearance
            last={data?.last}
            season={season}
            sportId={sportId}
            rest={restLabel(role, data?.last, officialDate)}
          />
        </Unfold>
      </div>
      {after?.(open || !loading)}
    </>
  )
}
