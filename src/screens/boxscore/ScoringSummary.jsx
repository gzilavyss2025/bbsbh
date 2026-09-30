import { useEffect, useRef, useState } from 'react'
import { Card } from '../../components/ui/frame/Card.jsx'
import { SectionMasthead } from '../../components/ui/SectionMasthead.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { HighlightSheet } from '../../components/playbyplay/HighlightSheet.jsx'
import { CLIP_PACKAGE, CLIP_RAW, watchClipSource, resolveRawClip } from '../../components/highlights/watchClip.js'

// THE SCORING SUMMARY — every run, grouped by half-inning, each row a face, a
// name, MLB's own sentence, the score after it and a small ▶ for the film.
//
// MOUNTED ONLY inside the box score's SealBox reveal render (BoxScore.jsx), and
// `groups` arrives from `api/boxscore/scoringSummary.js` through
// `revealBoxScore.js` — a reveal-only selector (ADR-0001). Nothing here decides
// what may be shown.
//
// EACH PLAY IS ITS OWN ROW under a head that reads: club mark, ▲/▼ + inning (the
// tag the win-probability chart's swing ledger prints, SwingLedger.jsx), then
// the man and the event. The score after the play sits under MLB's sentence,
// never on the head — on the head it reads as the score BEFORE the play.
//
// THE ▶ COSTS NO NETWORK, exactly as in PlayByPlay.jsx (watchClip.js explains
// why): the source is decided from data the row already holds, one tap asks
// one host about one playId, and a miss is thrown away so a second tap after
// the clip publishes finds it. A game with no film at all (`filmEligible`
// false — MiLB, pre-2016) draws no button unless MLB cut an edited package.
export function ScoringSummary({ groups, box, filmEligible = true }) {
  if (!groups || groups.length === 0) return null
  const awayAbbr = box.away.abbreviation
  const homeAbbr = box.home.abbreviation
  return (
    <Card as="div" body="flush" className="bs__scoring">
      <SectionMasthead as="h3" title="Scoring summary" />
      <ol className="scoresum__plays">
        {groups.flatMap((g) =>
          g.plays.map((p) => (
            <PlayRow
              key={p.atBatIndex}
              play={p}
              group={g}
              awayAbbr={awayAbbr}
              homeAbbr={homeAbbr}
              filmEligible={filmEligible}
            />
          )),
        )}
      </ol>
    </Card>
  )
}

function ScoreAfter({ away, home, awayAbbr, homeAbbr, className }) {
  if (away == null || home == null) return null
  return (
    <span className={className}>
      {awayAbbr} {away} – {homeAbbr} {home}
    </span>
  )
}

function PlayRow({ play, group, awayAbbr, homeAbbr, filmEligible }) {
  const [open, setOpen] = useState(false)
  // A hit is kept (the Savant token is deterministic); a miss is not — see the
  // header. Set on the way IN as well as cleared on the way out, or a StrictMode
  // remount leaves the sheet stuck on "Loading…" (PlayByPlay.jsx, same trap).
  const [clipSrc, setClipSrc] = useState(null)
  const [notice, setNotice] = useState('')
  const [resolving, setResolving] = useState(false)
  const liveRef = useRef(true)
  const abortRef = useRef(null)
  useEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const source = watchClipSource(play.highlight, play.playId, { filmEligible })
  const openClip = async () => {
    setOpen(true)
    if (source !== CLIP_RAW || clipSrc || resolving) return
    setNotice('')
    setResolving(true)
    const controller = new AbortController()
    abortRef.current = controller
    const { src, notice: miss } = await resolveRawClip(play.playId, { signal: controller.signal })
    abortRef.current = null
    if (!liveRef.current) return
    setClipSrc(src)
    setNotice(miss)
    setResolving(false)
  }

  return (
    <li className="scoresum__play">
      {/* The top row names the play: which club batted, the half, and WHO and
          WHAT. The score is NOT up here — a figure on the head of a play reads
          as the score before it happened, and with several runs in one half
          that is exactly how it was misread. It sits under the sentence. */}
      <header className="scoresum__head">
        <TeamLogo teamId={group.teamId} name={group.abbr} size={22} className="scoresum__logo" />
        <span className="scoresum__when">
          <span aria-hidden="true">{group.half === 'top' ? '▲' : '▼'}{group.inning}</span>
          <span className="sr-only">{group.half === 'top' ? 'Top' : 'Bottom'} of inning {group.inning}</span>
        </span>
        <PlayerLink id={play.playerId} className="scoresum__name">{play.playerName}</PlayerLink>
        {play.event && <span className="scoresum__event">{play.event}</span>}
      </header>
      <div className="scoresum__body">
        <Headshot personId={play.playerId} name={play.playerName} teamId={group.teamId} className="scoresum__shot" />
        <div className="scoresum__main">
          <p className="scoresum__desc">{play.desc}</p>
          <ScoreAfter away={play.awayScore} home={play.homeScore} awayAbbr={awayAbbr} homeAbbr={homeAbbr} className="scoresum__score" />
        </div>
      {source && (
        <button
          type="button"
          className="scoresum__watch"
          onClick={openClip}
          aria-label={`Watch highlight for ${play.playerName || 'this run'}`}
        >
          <span aria-hidden="true">▶</span>
        </button>
      )}
      {open && source && (
        <HighlightSheet
          item={source === CLIP_PACKAGE ? play.highlight : null}
          src={clipSrc}
          loading={resolving}
          notice={notice}
          onClose={() => setOpen(false)}
        />
      )}
      </div>
    </li>
  )
}
