import { useState } from 'react'
import { highlightPoster } from '../../api/highlights.js'
import { ordinal } from '../../lib/format.js'
import { HighlightSheet } from '../../components/playbyplay/HighlightSheet.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { SectionMasthead } from '../../components/ui/SectionMasthead.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'

// Pitchers of record, stacked one per line. Each name carries its season line in
// parens — (W-L) for the win and loss, (saves) for the save — the way a printed
// box score writes the decisions.
export function Decisions({ decisions }) {
  // The name links to his player page (PlayerLink degrades to plain text if
  // the feed carried no id — never a dead link); the season record stays
  // plain text outside the link, same split as every batting/pitching row.
  const withRec = (id, name, rec) => (
    <>
      <PlayerLink id={id}>{name}</PlayerLink>
      {rec ? ` (${rec})` : ''}
    </>
  )
  const parts = [
    decisions.win && {
      k: 'Win',
      v: withRec(decisions.winId, decisions.win, decisions.winRecord),
    },
    decisions.loss && {
      k: 'Loss',
      v: withRec(decisions.lossId, decisions.loss, decisions.lossRecord),
    },
    decisions.save && {
      k: 'Save',
      v: withRec(decisions.saveId, decisions.save, decisions.saveRecord),
    },
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <Card as="div" body="flush" className="bs__decisions">
      {parts.map((p) => (
        <span className="bs__decision" key={p.k}>
          <span className="bs__decisionK">{p.k}</span>
          <span className="bs__decisionV">{p.v}</span>
        </span>
      ))}
    </Card>
  )
}

// The night's single most memorable moment (see computePlayOfTheGame) — the
// play itself, not a player, so it sits above the three stars. Hidden entirely
// when WPA isn't available (most MiLB parks).
//
// `highlight` is the eligible video clip for this exact play, or null — which
// is the majority case (a clip was matched on 32-41 of 44 sampled games, but
// coverage is genuinely uneven). When it's null the card renders exactly as it
// did before the affordance existed: no empty state, nothing additive is
// missing, this is purely a bonus when MLB happens to have cut the play.
//
// Everything here is already inside the box score's single top-level SealBox
// (see BoxScore above), which is what makes the poster safe: it's an image of
// a play whose description, score and players this same card is printing in
// text two lines up, so it adds no information the reader doesn't already
// have. That is the whole argument — it does NOT generalize to a surface
// where the play isn't already spelled out.
export function PlayOfTheGame({ play, highlight, awayAbbr, homeAbbr }) {
  const [watchOpen, setWatchOpen] = useState(false)
  // A poster URL that 404s would leave a broken frame on the card, so a failed
  // load falls back to the plain text button rather than an empty box.
  const [posterFailed, setPosterFailed] = useState(false)
  if (!play || !play.desc) return null
  const halfLabel = play.half === 'top' ? 'Top' : 'Bottom'
  const hasScore = play.awayScore != null && play.homeScore != null
  const poster = highlight && !posterFailed ? highlightPoster(highlight) : null
  // Generic label only — never the clip's own title, same discipline as
  // PlayByPlay's per-play button: the title narrates the play in words the
  // card's own prose hasn't necessarily been read yet. The batter's name is
  // enough to say what you're about to watch, and the full context still
  // reaches screen readers through aria-label.
  const watchLabel = play.batterName
    ? `Watch highlight for ${play.batterName}`
    : 'Watch highlight for the play of the game'
  return (
    <Card as="div" body="flush" className="bs__potg">
      <SectionMasthead as="h3" title="Play of the game" />
      <div className="bs__potgBody">
        <Headshot
          personId={play.batterId}
          name={play.batterName}
          teamId={play.batterTeamId}
          className="bs__potgShot"
        />
        <div className="bs__potgMain">
          {play.batterName && (
            <div className="bs__potgWho">
              <PlayerLink id={play.batterId} className="bs__potgName">
                {play.batterName}
              </PlayerLink>
              {(play.batterTeamAbbr || play.batterPos) && (
                <span className="t-label t-label--bold bs__potgMeta">
                  {[play.batterTeamAbbr, play.batterPos].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          )}
          <p className="bs__potgDesc">
            {play.inning != null && (
              <span className="bs__potgWhen">
                {halfLabel} {ordinal(play.inning)}{' '}
              </span>
            )}
            {play.desc}
            {/* The score right after this play, so the moment reads with its
                consequence attached — bold, and (unlike the narrative above it)
                not run through title case: team abbreviations stay shouting
                like the rest of the sheet. */}
            {hasScore && (
              <span className="bs__potgScore">
                {' '}
                {awayAbbr} {play.awayScore}, {homeAbbr} {play.homeScore}
              </span>
            )}
          </p>
        </div>
      </div>
      {/* The poster IS the button when there's a frame to show — a 16:9 still
          with a play badge over it, which is the affordance the team/player
          rails will read as too. With no usable poster it degrades to the same
          plain kraft pill the innings view's per-play button uses, so the
          feature never depends on the image resolving. */}
      {highlight && (
        <button
          type="button"
          className={`bs__potgWatch${poster ? ' bs__potgWatch--poster' : ''}`}
          onClick={() => setWatchOpen(true)}
          aria-label={watchLabel}
        >
          {poster && (
            <img
              className="bs__potgPoster"
              src={poster}
              alt=""
              loading="lazy"
              onError={() => setPosterFailed(true)}
            />
          )}
          <span className="bs__potgPlay">
            <span className="bs__potgPlayIcon" aria-hidden="true">▶</span> Watch
          </span>
        </button>
      )}
      {watchOpen && highlight && (
        <HighlightSheet item={highlight} onClose={() => setWatchOpen(false)} />
      )}
    </Card>
  )
}

// The three stars of the game — the hockey-tradition nod, ranked by
// win-probability added (see computeThreeStars). Hidden entirely when WPA
// isn't available (most MiLB parks). One card markup for all entries (0-3
// of them — a candidate can be missing, not just WPA-unavailable) so the
// row reads as one family of cards at any width; the top mover gets a
// `--hero` modifier for extra weight (the inset gradient panel) since it's
// still the single most important line
// on the card. On phone that pairs with a bigger typeface; from the
// horizontal-row breakpoint up, every card shares one photo size and one
// type scale (see 21a-box-score-stars.css) so the panel alone carries the
// emphasis in a row that otherwise reads as one uniform family.
export function ThreeStars({ stars }) {
  if (!stars || stars.length === 0) return null
  return (
    <Card as="div" body="flush" className="bs__stars">
      <SectionMasthead as="h3" title="Three stars" />
      <ol className="stars3__row">
        {stars.map((s, i) => (
          <Card as="li" frame="ledger" body="flush" className={`stars3__card${i === 0 ? ' stars3__card--hero' : ''}`} key={s.id}>
            <Headshot personId={s.id} name={s.name} teamId={s.teamId} className="stars3__shot" />
            <span className="stars3__copy">
              <span className="stars3__marks" aria-label={`${s.stars} star`}>
                {'★'.repeat(s.stars)}
              </span>
              <PlayerLink id={s.id} className="stars3__name">{s.name}</PlayerLink>
              {(s.teamName || s.pos) && (
                <span className="t-label t-label--bold stars3__meta">{[s.teamName, s.pos].filter(Boolean).join(' · ')}</span>
              )}
            </span>
            <span className="stars3__stat">{s.stat}</span>
          </Card>
        ))}
      </ol>
    </Card>
  )
}

// What's left of the info block after selectBoxscore peels off the
// structured fill-in-box fields (umpires, weather+wind, venue, attendance,
// first pitch, duration) and splits every per-player row onto its own team's
// TeamBlock — pitcher rows into `pitchNotes` there, HBP/IBB into that club's
// BATTING group: whole-game fields with no team owner (an ejection names its
// club in prose and has no roster name to key on), plus any entry that
// couldn't be matched to a roster name.
//
// An entry landing HERE that names a player is a parse bug, not a category —
// that is exactly how a double plunk ("Culpepper, K 2 (by Gasser, by
// Patrick)") ended up at the foot of the sheet. See splitGameNotes.
export function GameInfo({ rows }) {
  if (rows.length === 0) return null
  return (
    <Card as="div" body="flush" className="bs__info">
      {rows.map((r, i) => (
        <p className="bs__infoRow" key={i}>
          <span className="bs__infoLabel">{r.label}:</span> {r.value}
        </p>
      ))}
    </Card>
  )
}
