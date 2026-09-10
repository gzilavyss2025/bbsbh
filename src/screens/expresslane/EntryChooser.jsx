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
// TWO CHOICES, AND THEY ARE ABOUT DIFFERENT THINGS. Mode decides WHAT gets
// downloaded — one clip an at-bat, or every pitch. The plan decides WHEN. They
// multiply, and the second one is the one people get wrong, so the buttons say
// the quiet part: no plan makes the film arrive faster. MLB's clip hosts
// throttle to about 2.1 Mbps per client and concurrency does not help, so a
// nine-inning game in Result mode is about 470 MB and about half an hour
// whichever plan asks for it. "Load it all first" is not a speed-up; it is the
// same wait, taken all at once, in exchange for a session with no waiting in
// it. A chooser that let someone believe otherwise would be selling something
// that does not exist.
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

export function EntryChooser({ mode, onMode, plan, onPlan, onStart, busy = false }) {
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
        <div className="xl-entry__choices">
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
        <legend className="xl-entry__legend">When should the film arrive?</legend>
        <p className="xl-entry__hint">
          None of these is faster than the others. MLB sends the film at one speed, so this
          only decides when you do the waiting.
        </p>
        <div className="xl-entry__choices">
          <button
            type="button"
            className={`xl-entry__choice ${plan === 'demand' ? 'is-on' : ''}`}
            aria-pressed={plan === 'demand'}
            onClick={() => onPlan('demand')}
          >
            <span className="xl-entry__club">On demand</span>
            <span className="xl-entry__side">nothing until you ask for it</span>
            <span className="xl-entry__cost">
              Opens at once, then each play waits for its own clip. Downloads the least, so
              it is the one for dipping into a game for a few plays.
            </span>
          </button>
          <button
            type="button"
            className={`xl-entry__choice ${plan === 'ahead' ? 'is-on' : ''}`}
            aria-pressed={plan === 'ahead'}
            onClick={() => onPlan('ahead')}
          >
            <span className="xl-entry__club">Stay ahead of me</span>
            <span className="xl-entry__side">a short head start, then it keeps up</span>
            <span className="xl-entry__cost">
              About 90 seconds to open, then it works a half-inning ahead of you. The usual
              way to score a game.
            </span>
          </button>
          <button
            type="button"
            className={`xl-entry__choice ${plan === 'all' ? 'is-on' : ''}`}
            aria-pressed={plan === 'all'}
            onClick={() => onPlan('all')}
          >
            <span className="xl-entry__club">All of it first</span>
            <span className="xl-entry__side">the whole nine innings, then no waiting</span>
            <span className="xl-entry__cost">
              About half an hour and 470 MB before the first play, in one clip per at-bat.
              Start it, leave it, come back to a game you can score straight through.
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
