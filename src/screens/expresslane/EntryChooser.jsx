// THE ENTRY STEP — the pace, and the consent.
//
// THERE IS NO BOOTH CHOICE, and its absence is a fact about the film rather
// than a simplification. Tier 2 resolves a playId through Savant, which answers
// with ONE mp4 — whichever broadcast called that pitch. The only host
// addressable by booth is `fastball-clips.mlb.com/{gamePk}/{home|away}/`, and
// it is Referer-locked to mlb.com, so from this origin it gives
// MEDIA_ERR_SRC_NOT_SUPPORTED (clipIndex.js records both). A door may not claim
// a decision the app cannot carry out.
//
// THE CONSENT IS THE OTHER HALF OF THIS SCREEN, and it cannot be skipped.
// Every clip frame carries the broadcast scorebug burned into the pixels, so
// Express Lane can never have an unrevealed preview mode: opening it is
// agreeing to see the score of the pitch you are on. The door says it plainly
// rather than burying it, and "Start scoring" is the act of agreeing.
//
// TWO CHOICES, AND THEY ARE ABOUT DIFFERENT THINGS. Mode decides WHAT gets
// downloaded — one clip an at-bat, or every pitch. The plan decides WHEN. They
// multiply, and the second one is the one people get wrong, so its own line
// says the quiet part: no plan makes the film arrive faster. MLB's clip hosts
// throttle to about 2.1 Mbps per client and concurrency does not help.
//
// THE FIGURES ARE THE CHOICE, so they are drawn as figures rather than written
// into sentences. This is the one decision that costs the evening — 35 minutes
// of film arriving against 100 — and under the film gate the arrival time IS
// the session's pace, because the cursor cannot pass the picture. Set as a
// ledger column, the five cards compare down the page at a glance: 15 against
// 40 minutes of film, at once against 90 seconds against half an hour to open.
// The prose that used to carry those numbers said the same thing at more than
// twice the length, and could not be compared at all.
//
// They are figures for a TYPICAL nine-inning game, and they have to stay that
// way. A count taken from THIS game's own feed would state how many plate
// appearances it has, and so whether it went to extra innings (ADR-0008). So
// the numbers here describe the MODE and never the game in front of you.
//
// Every pitch is offered rather than withheld, and the honest warning rides on
// the card instead: "with waits between". It needs a clip roughly every 18
// seconds, which under the gate is closer to a slideshow than to scoring — but
// that is a judgement about how someone wants to spend their night, and the
// measurement belongs to them.

// One card. Name, what it is, then the figures that decide it.
function Choice({ on, onClick, name, side, figures }) {
  return (
    <button
      type="button"
      className={`xl-entry__choice ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      <span className="xl-entry__name">{name}</span>
      <span className="xl-entry__side">{side}</span>
      {/* The deciding numbers, in the app's ledger face. A figure and the word
          that says what it measures — never a sentence with a number in it. */}
      <span className="xl-entry__figs">
        {figures.map(([value, label]) => (
          <span key={label} className="xl-entry__fig">
            <b className="xl-entry__figval">{value}</b>
            <span className="xl-entry__figlabel">{label}</span>
          </span>
        ))}
      </span>
    </button>
  )
}

export function EntryChooser({ mode, onMode, plan, onPlan, onStart, busy = false }) {
  return (
    <section className="xl-entry" aria-label="Start Express Lane">
      <header className="xl-entry__head">
        <h1 className="xl-entry__title">Express Lane</h1>
        <p className="xl-entry__lede">
          The pitches, not the broadcast. One play at a time.
        </p>
      </header>

      <fieldset className="xl-entry__group">
        <legend className="xl-entry__legend">How much film</legend>
        <p className="xl-entry__hint">You cannot get ahead of it, so this sets the pace.</p>
        <div className="xl-entry__choices">
          <Choice
            on={mode === 'result'}
            onClick={() => onMode('result')}
            name="The decision pitch"
            side="one clip an at-bat"
            figures={[
              ['15 min', 'of film'],
              ['35 min', 'to arrive'],
            ]}
          />
          <Choice
            on={mode === 'full'}
            onClick={() => onMode('full')}
            name="Every pitch"
            side="the whole at-bat, with waits between"
            figures={[
              ['40 min', 'of film'],
              ['100 min', 'to arrive'],
            ]}
          />
        </div>
      </fieldset>

      <fieldset className="xl-entry__group">
        <legend className="xl-entry__legend">When it arrives</legend>
        <p className="xl-entry__hint">None is faster. They only move the waiting.</p>
        <div className="xl-entry__choices">
          <Choice
            on={plan === 'demand'}
            onClick={() => onPlan('demand')}
            name="On demand"
            side="nothing until you ask for it"
            figures={[['At once', 'to open']]}
          />
          <Choice
            on={plan === 'ahead'}
            onClick={() => onPlan('ahead')}
            name="Stay ahead of me"
            side="keeps a half-inning in front"
            figures={[['90 sec', 'to open']]}
          />
          <Choice
            on={plan === 'all'}
            onClick={() => onPlan('all')}
            name="All of it first"
            side="then nothing to wait for"
            figures={[
              ['30 min', 'to open'],
              ['470 MB', 'up front'],
            ]}
          />
        </div>
      </fieldset>

      <p className="xl-entry__consent">
        Every frame carries the broadcast scorebug. You cannot watch a pitch here without
        seeing the score at that pitch.
      </p>

      {/* Pinned to the foot, where the scoring surface behind this door keeps
          its own primary action. Tapping it IS the consent stated above it. */}
      <div className="xl-entry__foot">
        <button
          type="button"
          className="btn btn--reveal xl-entry__go"
          onClick={onStart}
          disabled={busy}
        >
          {busy ? 'Getting the film…' : 'Start scoring'}
        </button>
      </div>
    </section>
  )
}
