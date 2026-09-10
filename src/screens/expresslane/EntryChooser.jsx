// THE ENTRY STEP — the pace, and the consent.
//
// THERE IS NO BOOTH CHOICE, and its absence is a fact about the film rather
// than a simplification. Tier 2 resolves a playId through Savant, which answers
// with ONE mp4 — whichever broadcast called that pitch. The only host
// addressable by booth is `fastball-clips.mlb.com/{gamePk}/{home|away}/`, and
// it is Referer-locked to mlb.com, so from this origin it gives
// MEDIA_ERR_SRC_NOT_SUPPORTED (clipIndex.js records both). This screen asked
// "Which booth?" and warned that changing it later meant fetching the film
// again; neither the choice nor the cost was real, and the club name it put in
// the header did not describe the picture on screen. A door may not claim a
// decision the app cannot carry out.
//
// THE CONSENT IS THE OTHER HALF OF THIS SCREEN, and it cannot be skipped.
// Every clip frame carries the broadcast scorebug burned into the pixels, so
// Express Lane can never have an unrevealed preview mode: opening it is
// agreeing to see the score of the pitch you are on. That is a real
// constraint on how this door is allowed to be presented, so the door says it
// plainly rather than burying it.
//
// MODE IS THE CHOICE THAT IS LEFT, and it is a real one: it decides what gets
// downloaded, and changing it after staging begins throws bytes away.
//
// THE FIGURES ARE ON THE BUTTONS ON PURPOSE. This is the one choice that costs
// the evening — the difference between about 35 minutes of film arriving and
// about 100 — and under the film gate the arrival time IS the session's pace,
// because the cursor cannot pass the picture. A chooser that hid that would be
// asking for a decision while withholding the only fact that decides it.
//
// They are figures for a TYPICAL nine-inning game, and they have to stay that
// way. A count taken from THIS game's own feed would state how many plate
// appearances it has, and so whether it went to extra innings (ADR-0008). So
// the numbers here describe the MODE and never the game in front of you.
//
// Every pitch is offered rather than withheld, and the honest warning rides on
// the button instead. It needs a clip roughly every 18 seconds, which under the
// gate is closer to a slideshow than to scoring — but that is a judgement about
// how someone wants to spend their night, and the measurement belongs to them.

export function EntryChooser({ mode, onMode, onStart, busy = false }) {
  return (
    <section className="xl-entry" aria-label="Start Express Lane">
      <h1 className="xl-entry__title">Express Lane</h1>
      <p className="xl-entry__lede">
        The pitches instead of the broadcast. Every pitch in this game has film, and you step
        to it — no commercials, no dead air, no scrubbing.
      </p>

      <fieldset className="xl-entry__group">
        <legend className="xl-entry__legend">How much of each at-bat?</legend>
        <p className="xl-entry__hint">
          The film arrives about as fast as MLB will send it, and you cannot get ahead of it.
          So this choice sets the pace of the whole session.
        </p>
        <div className="xl-entry__choices xl-entry__choices--modes">
          <button
            type="button"
            className={`xl-entry__choice ${mode === 'result' ? 'is-on' : ''}`}
            aria-pressed={mode === 'result'}
            onClick={() => onMode('result')}
          >
            <span className="xl-entry__club">The decision pitch</span>
            <span className="xl-entry__side">one clip per at-bat</span>
            <span className="xl-entry__cost">
              About 15 minutes of film in a nine-inning game, arriving over about 35 minutes.
            </span>
          </button>
          <button
            type="button"
            className={`xl-entry__choice ${mode === 'full' ? 'is-on' : ''}`}
            aria-pressed={mode === 'full'}
            onClick={() => onMode('full')}
          >
            <span className="xl-entry__club">Every pitch</span>
            <span className="xl-entry__side">the whole at-bat</span>
            <span className="xl-entry__cost">
              About 40 minutes of film, arriving over about 100 — a clip roughly every 18
              seconds, so expect to wait between them.
            </span>
          </button>
        </div>
      </fieldset>

      <p className="xl-entry__consent">
        The broadcast burns the score into every frame, so there is no way to watch a pitch
        without seeing where the game stood at that pitch. Going in means agreeing to that.
      </p>

      <button type="button" className="btn btn--reveal xl-entry__go" onClick={onStart} disabled={busy}>
        {busy ? 'Getting the film…' : 'Start scoring'}
      </button>
    </section>
  )
}
