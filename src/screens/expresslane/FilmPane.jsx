import { useState } from 'react'

// THE FILM PANE — the top band of Concept A's Split Deck.
//
// It shows one of four things and never a fifth: the clip, an indeterminate
// wait, a row that has no film, or a refusal it can explain.
//
// FIVE RULES HOLD THIS PANE, and four of them are about what it must NOT draw.
//
// 1. NEVER THE NEXT CLIP'S POSTER AS A PLACEHOLDER. Every frame carries the
//    broadcast scorebug burned into the pixels — score, inning, count, outs,
//    read off real frames rather than assumed. So pitch N+1's poster shows the
//    result of the at-bat still being scored. The placeholder here is neutral
//    and drawn in CSS; no poster URL reaches this file.
// 2. THE WAIT IS INDETERMINATE. No bar, no ETA, no byte count, no clip
//    duration printed before it plays. Terminal clips run 4.34 to 12.11 MB
//    precisely BECAUSE a longer one holds more play developing, so a
//    determinate bar would tell the scorer that the plate appearance ahead is
//    a long one — timing that is a function of the reveal, which ADR-0046
//    forbids.
// 3. NO GAME-WIDE COUNT. Not here and not anywhere on this surface: a total
//    states how long the game ran, and so whether it went to extras (ADR-0008).
// 4. A row with no film is not an error. Roughly 275 events a game carry no
//    clip and never will, and MLB mints playIds by formula for every
//    intentional walk. Those read as an ordinary row with nothing to watch.
// 5. It is someone else's video, with someone else's bug on it — Marquee,
//    Bally, whoever had the booth. The frame is theirs; the chrome around it
//    is ours, and the two should not be confused.
//
// THE FRAME IS ONE CONTINUOUS BOX, and that is what this file's newest change
// is for. A clip that is already on the device used to cost two waits: the pane
// had nothing to draw while the bytes were read off the disk, and then the
// video element sat black while it loaded them. Now the box is there from the
// moment the cursor lands. While the bytes are being read it shows the spinner
// alone, since "the film is coming" would be untrue of a clip that is here, and
// once the <video> exists the spinner stays over it until it has a frame.

function Placeholder({ children, tone = 'wait' }) {
  return (
    <div className={`xl-film__placeholder xl-film__placeholder--${tone}`}>
      <span className="xl-film__mark" aria-hidden="true" />
      <p className="xl-film__msg">{children}</p>
    </div>
  )
}

// The video, with the spinner held over it until it has a picture to show.
//
// Only where the clip autoplays. The Matchup Scout's pitch modal shows the same
// pane with `autoPlay={false}`, and a browser that will not load a clip it has
// not been asked to play (iOS in Low Power Mode) would leave a spinner turning
// over a video that is simply waiting for a tap. The overlay never takes a
// pointer event, so the native controls stay under the thumb either way.
function FilmVideo({ url, autoPlay }) {
  const [shown, setShown] = useState(false)
  const show = () => setShown(true)
  return (
    <>
      <video
        className="xl-film__video"
        src={url}
        controls
        playsInline
        autoPlay={autoPlay}
        preload="auto"
        onLoadedData={show}
        onCanPlay={show}
        onPlaying={show}
        onError={show}
      />
      {autoPlay && !shown && (
        <span className="xl-film__mark xl-film__mark--over" role="status" aria-label="Loading the clip" />
      )}
    </>
  )
}

export function FilmPane({ clipUrl, gate, blockedReason, onSkipFilm, onRetry, autoPlay = true }) {
  // Blocked by the world rather than by the film: a full disk, or a host that
  // has stopped answering. Both are worth naming, because both have a remedy
  // the scorer can act on and neither is going to clear itself.
  if (blockedReason) {
    return (
      <div className="xl-film">
        <Placeholder tone="stop">
          {blockedReason === 'quota'
            ? 'No room left for film on this device. Free some space first.'
            : blockedReason === 'host'
              ? 'MLB has stopped sending clips for now. Give it a few minutes.'
              : 'The film stopped arriving.'}
          <button type="button" className="btn xl-film__btn" onClick={onRetry}>
            Try again
          </button>
        </Placeholder>
      </div>
    )
  }

  if (clipUrl) {
    return (
      <div className="xl-film">
        {/* `key` on the URL so the element is replaced rather than re-sourced:
            a <video> handed a new src mid-play keeps the old frame up on some
            builds, which on this surface would be the PREVIOUS play's picture
            sitting under the new play's box. */}
        <FilmVideo key={clipUrl} url={clipUrl} autoPlay={autoPlay} />
      </div>
    )
  }

  // THE BYTES ARE HERE AND THE VIDEO IS NOT MOUNTED YET: the few frames between
  // the cursor landing and the clip being read off the disk. The box is already
  // drawn and says nothing, so the swap to the video is not a second wait.
  if (gate?.reason === 'ready') {
    return (
      <div className="xl-film">
        <span className="xl-film__mark" role="status" aria-label="Loading the clip" />
      </div>
    )
  }

  // NOTHING HAS BEEN SCORED YET, so there is no row to be showing the film of.
  // A null gate means the cursor has not been placed, which is a different
  // thing from a row that has no film — saying "nothing to watch here" before
  // the scorer has started points at a row they have not reached.
  if (!gate) {
    return (
      <div className="xl-film">
        <Placeholder tone="none">The first play is ready when you are.</Placeholder>
      </div>
    )
  }

  // No clip expected for this row, and none ever will be: paperwork, or a
  // playId MLB generated by formula. An ordinary row with nothing to watch.
  if (gate?.reason === 'paperwork' || gate?.reason === 'no-film') {
    return (
      <div className="xl-film">
        <Placeholder tone="none">No film for this play.</Placeholder>
      </div>
    )
  }

  // WATCHED, AND THE BYTES LET GO. The working set keeps a lookbehind of a
  // dozen clips and reclaims what is further back, so a scorer who steps a long
  // way back inside one half arrives at a play whose film is no longer on the
  // device. That is not a wait and must not read as one: the play is scored and
  // written, and "the film is coming" would be untrue about a clip nothing is
  // fetching.
  if (gate?.reason === 'evicted') {
    return (
      <div className="xl-film">
        <Placeholder tone="none">This clip was let go to make room — what you wrote stands.</Placeholder>
      </div>
    )
  }

  // The film was expected, its URL resolved, and the bytes will not come. This
  // is the ONE consented escape, and it has to read as a decision the scorer
  // makes rather than a fallback that happens to them — or the gate erodes
  // back into the design it replaced within a week of use.
  if (gate?.escapable) {
    return (
      <div className="xl-film">
        <Placeholder tone="stop">
          This clip is not coming.
          <button type="button" className="btn xl-film__btn" onClick={onSkipFilm}>
            Score it without the film
          </button>
        </Placeholder>
      </div>
    )
  }

  return (
    <div className="xl-film">
      <Placeholder>The film is coming.</Placeholder>
    </div>
  )
}
