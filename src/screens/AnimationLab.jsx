import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BoxScoreSkeleton } from '../components/BoxScoreSkeleton.jsx'
import { Loader } from '../components/ui/Loader.jsx'
import { DelayCard } from '../components/DelayCard.jsx'
import { PostponedBanner } from '../components/GameCard.jsx'
import { CountBlink } from '../components/StatBox.jsx'

// Unlisted QA page (see route.js), reachable only by direct URL
// (/animation-lab). Every decorative animation in the app gets its own entry:
// the real component looping/live, then the same component repeated as a row
// of frozen frames so the in-between stages of a loop or one-shot entrance
// are visible side by side rather than needing a stopwatch (see
// .agents/skills/review-animations for the craft bar this page exists to
// check against). No score/reveal content anywhere — every demo below uses
// made-up data, never a live game feed.
//
// Add a new entry here whenever a new animation ships, and a matching
// `.animlab__frame …` override selector in index.css (search "ANIMATION LAB")
// if the new animation needs its own class listed to be pausable.
export function AnimationLab() {
  useDocumentTitle('Animation Lab')
  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Animation Lab</h1>
      </header>
      <p className="hint hint--prose">
        Every decorative animation in the app, running live, with its stages frozen underneath for
        review. Unlisted — not linked from anywhere else in the app.
      </p>

      <section className="animlab__entry">
        <h2 className="animlab__title">Box-score skeleton — rolling ball</h2>
        <p className="hint hint--prose">
          PastGameFlipCard&rsquo;s &ldquo;still fetching&rdquo; placeholder (src/components/BoxScoreSkeleton.jsx) —
          grayscale blocks pulse together while a hand-drawn baseball tumbles across the card.
        </p>
        <div className="animlab__live">
          <BoxScoreSkeleton />
        </div>
        <span className="animlab__stagelabel">Ball rotation, one 2.4s cycle</span>
        <div className="animlab__frozen">
          {[0, 400, 800, 1200, 1600, 2000].map((ms) => (
            <Frame key={ms} label={`${(ms / 1000).toFixed(1)}s`} delayMs={ms}>
              <BoxScoreSkeleton />
            </Frame>
          ))}
        </div>
      </section>

      <section className="animlab__entry">
        <h2 className="animlab__title">Scoreboard number flip</h2>
        <p className="hint hint--prose">
          The shared cold-load Loader (src/components/Loader.jsx) — a mini National League
          linescore where Milwaukee&rsquo;s inning-2 cell cycles 1&ndash;9, each digit settling in
          with a quick drop-and-catch.
        </p>
        <div className="animlab__live">
          <Loader size="inline" />
        </div>
        <span className="animlab__stagelabel">Every digit it cycles through</span>
        <div className="animlab__frozen">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
            <Frame key={digit} label={String(digit)}>
              <StaticScoreboardPlate digit={digit} />
            </Frame>
          ))}
        </div>
      </section>

      <section className="animlab__entry">
        <h2 className="animlab__title">Weather delay — pop-in + rain loop</h2>
        <p className="hint hint--prose">
          A between-half-innings notice that play stopped (src/components/DelayCard.jsx) &mdash; the
          card pops up on mount, and an unresolved delay keeps a small cloud dripping.
        </p>
        <div className="animlab__live">
          <DelayCard delay={{ reason: 'Rain', durationMinutes: 42, resolved: false }} />
        </div>
        <span className="animlab__stagelabel">Rain loop, one 1.7s cycle</span>
        <div className="animlab__frozen">
          {[0, 340, 680, 1020, 1360].map((ms) => (
            <Frame key={ms} label={`${(ms / 1000).toFixed(2)}s`} delayMs={ms}>
              <DelayCard delay={{ reason: 'Rain', durationMinutes: 42, resolved: false }} />
            </Frame>
          ))}
        </div>
      </section>

      <section className="animlab__entry">
        <h2 className="animlab__title">Postponed rubber stamp</h2>
        <p className="hint hint--prose">
          A postponed game&rsquo;s banner (src/components/GameCard.jsx) — the kraft-tape strip rises in,
          then the stamp presses down onto the paper.
        </p>
        <div className="animlab__live">
          <PostponedGameCardDemo />
        </div>
        <span className="animlab__stagelabel">Stamp press, 300ms</span>
        <div className="animlab__frozen">
          {[0, 75, 150, 225, 300].map((ms) => (
            <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
              <PostponedGameCardDemo />
            </Frame>
          ))}
        </div>
      </section>

      <section className="animlab__entry">
        <h2 className="animlab__title">Count blink (before → after)</h2>
        <p className="hint hint--prose">
          The Worst Call card&rsquo;s count change (src/components/StatBox.jsx) — the old count
          fades/strikes through while the new one flashes highlighter-yellow, then settles to
          plain ink.
        </p>
        <div className="animlab__live">
          <CountBlink before="2–1" after="K" />
        </div>
        <span className="animlab__stagelabel">Old count fading, 360ms</span>
        <div className="animlab__frozen">
          {[0, 90, 180, 270, 360].map((ms) => (
            <Frame key={`old-${ms}`} label={`${ms}ms`} delayMs={ms}>
              <CountBlink before="2–1" after="K" />
            </Frame>
          ))}
        </div>
        <span className="animlab__stagelabel">New count highlight fading out, 1.6s</span>
        <div className="animlab__frozen">
          {[0, 400, 800, 1200, 1600].map((ms) => (
            <Frame key={`new-${ms}`} label={`${(ms / 1000).toFixed(1)}s`} delayMs={ms}>
              <CountBlink before="2–1" after="K" />
            </Frame>
          ))}
        </div>
      </section>
    </div>
  )
}

// One frozen frame: pauses whatever animation(s) `children` renders at
// `delayMs` elapsed (via --animlab-delay, see index.css's ANIMATION LAB
// block) — omit delayMs for a frame with nothing to pause (a plain static
// swatch, like the scoreboard digits below).
function Frame({ label, delayMs, children }) {
  const style = delayMs != null ? { '--animlab-delay': `${-delayMs}ms` } : undefined
  return (
    <div className="animlab__frame" style={style}>
      <div className="animlab__framebox">{children}</div>
      <span className="animlab__framelabel">{label}</span>
    </div>
  )
}

// The same markup Loader.jsx renders for one digit, minus its own setInterval
// — a fixed digit that plays its entrance once on mount and rests, so the
// frozen strip can show every digit 1–9 side by side instead of racing
// Loader's own 750ms cycle.
function StaticScoreboardPlate({ digit }) {
  return (
    <div className="loader__scoreboard" aria-hidden="true">
      <div className="loader__league">NATIONAL</div>
      <span className="loader__colhead" />
      <span className="loader__colhead" />
      <span className="loader__colhead">1</span>
      <span className="loader__colhead">2</span>
      <span className="loader__colhead">3</span>

      <span className="loader__num">32</span>
      <span className="loader__team">MILWAUKEE</span>
      <span className="loader__score">0</span>
      <div className="loader__plate-window">
        <span className="loader__plate">{digit}</span>
      </div>
      <span className="loader__blank" />

      <span className="loader__num">18</span>
      <span className="loader__team">CUBS</span>
      <span className="loader__score">0</span>
      <span className="loader__score">0</span>
      <span className="loader__blank" />
    </div>
  )
}

// PostponedBanner takes the two fields it actually reads (game.rescheduleGameDate,
// status.reason) rather than a real game/status pair — this page never touches
// live game data.
function PostponedGameCardDemo() {
  return (
    <PostponedBanner
      game={{ rescheduleGameDate: '2026-08-02' }}
      status={{ reason: 'Inclement Weather' }}
    />
  )
}
