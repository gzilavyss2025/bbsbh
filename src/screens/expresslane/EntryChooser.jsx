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
// MODE IS NOT ON THIS SCREEN IN v1. Result mode — one clip per plate
// appearance, the pitch that carries the outcome — is what ships. Full mode
// (every clip-bearing event) is built through every tier below this and is
// deliberately not offered: it needs a clip every ~18 seconds, and under the
// film gate that is a slideshow of waits rather than a way to score a game.
// Its trigger is still open (issue #1019) and the PRD's own instruction is to
// settle it by trying a game on a laptop, not by argument. When it is settled,
// the choice belongs beside the booth, because the two are staged together.

export function EntryChooser({ awayName, homeName, booth, onBooth, onStart, busy = false }) {
  return (
    <section className="xl-entry" aria-label="Start Express Lane">
      <h1 className="xl-entry__title">Express Lane</h1>
      <p className="xl-entry__lede">
        The pitches instead of the broadcast. Every pitch in this game has film, and you step
        to it — no commercials, no dead air, no scrubbing.
      </p>

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
