// THE ENTRY STEP — the booth, and the consent.
//
// The broadcast is chosen HERE and not in a settings page, because it decides
// what gets staged: switching booths after staging has begun throws away every
// byte already paid for ahead of the cursor. It is a per-session choice, not a
// setting — leaving and re-entering the same game with the other booth is
// allowed and costs a re-stage.
//
// THE CONSENT IS THE OTHER HALF OF THIS SCREEN, and it cannot be skipped.
// Every clip frame carries the broadcast scorebug burned into the pixels, so
// Express Lane can never have an unrevealed preview mode: opening it is
// agreeing to see the score of the pitch you are on. That is a real
// constraint on how this door is allowed to be presented, so the door says it
// plainly rather than burying it.
//
// MODE IS THE OTHER CHOICE, and it belongs beside the booth because the two are
// staged together: each decides what gets downloaded, and changing either after
// staging begins throws bytes away.
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

export function EntryChooser({
  awayName,
  homeName,
  booth,
  onBooth,
  mode,
  onMode,
  onStart,
  busy = false,
}) {
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

      <fieldset className="xl-entry__group">
        <legend className="xl-entry__legend">Which booth?</legend>
        <p className="xl-entry__hint">
          Both broadcasts carry every clip. Pick one now — changing it later means fetching the
          film again.
        </p>
        <div className="xl-entry__choices">
          <button
            type="button"
            className={`xl-entry__choice ${booth === 'away' ? 'is-on' : ''}`}
            aria-pressed={booth === 'away'}
            onClick={() => onBooth('away')}
          >
            <span className="xl-entry__club">{awayName}</span>
            <span className="xl-entry__side">visitors’ booth</span>
          </button>
          <button
            type="button"
            className={`xl-entry__choice ${booth === 'home' ? 'is-on' : ''}`}
            aria-pressed={booth === 'home'}
            onClick={() => onBooth('home')}
          >
            <span className="xl-entry__club">{homeName}</span>
            <span className="xl-entry__side">home booth</span>
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
