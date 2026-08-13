import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { BetweenInnings } from '../components/gamehud/BetweenInnings.jsx'
import { halfIndex } from '../api/select.js'
import { weekdayFromDate } from '../api/callout-notes.js'

const GAME_DATE = '2026-07-07'
const DOW = weekdayFromDate(GAME_DATE)

// Unlisted QA page (see route.js), reachable only by direct URL
// (/between-innings-lab). Every synthetic fixture below is made up — no live
// game feed, no score/reveal content. Every card below is BetweenInnings
// itself — it opens on the tally grid (its resting state) and TAPS reveal
// what's under it, exactly as the console band does; there is no static way
// to render past card 1 short of clicking through in the browser.

function feed({ probables = true, inning = 1, extraInnings = [] } = {}) {
  const innings = [{ num: 1, away: z(), home: z() }, ...extraInnings]
  return {
    gameData: {
      datetime: { officialDate: GAME_DATE },
      players: {
        ID642547: { id: 642547, fullName: 'Freddy Peralta' },
        ID543243: { id: 543243, fullName: 'Sonny Gray' },
        ID999999: { id: 999999, fullName: 'M. Ortiz' },
      },
      teams: { away: { id: 158 }, home: { id: 138 } },
      probablePitchers: probables ? { away: { id: 543243 }, home: { id: 642547 } } : undefined,
    },
    liveData: {
      linescore: { innings: innings.length ? innings : [{ num: inning, away: z(), home: z() }] },
      plays: { allPlays: [] },
    },
  }
}
function z() {
  return { runs: 0, hits: 0, errors: 0, leftOnBase: 0 }
}

const bundle = {
  away: { teamId: 158, name: 'Cardinals' },
  home: { teamId: 138, name: 'Brewers' },
  starterRecords: {
    543243: { teamStarts: { w: 8, l: 7 } },
    642547: { teamStarts: { w: 11, l: 6 } },
  },
  teamRecords: {
    away: { dayOfWeek: { [DOW]: { w: 9, l: 3 } } },
    home: { dayOfWeek: { [DOW]: { w: 10, l: 4 } } },
  },
}
const minimalBundle = { away: { name: 'Cardinals' }, home: { name: 'Brewers' } }

const headshotNote = {
  text: 'Laboring: 24.7 pitches per inning through 4.0 IP — his season norm is 16.1.',
  kind: 'laboring', score: 48, dedupeKey: 'laboring-642547', personId: 642547, side: 'home',
}
const fallbackNote = {
  text: 'Working a third straight day — 41 pitches over his last 2 appearances.',
  kind: 'penFatigue', score: 42, dedupeKey: 'penFatigue-999999', personId: 999999, side: 'home',
}
const cycleNotes = [
  headshotNote,
  { text: 'Fastball down 2.3 mph from his early innings (96.1 → 93.8).', kind: 'veloDecay', score: 46, dedupeKey: 'veloDecay-642547', personId: 642547, side: 'home' },
  fallbackNote,
  { text: 'Opponents hit .198 off him with the Brewers ahead this season, .276 with them trailing.', kind: 'leverage', score: 34, dedupeKey: 'leverage-642547', personId: 642547, side: 'home' },
]

export function BetweenInningsLab() {
  useDocumentTitle('Between Innings Lab')
  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Between Innings Lab</h1>
      </header>
      <p className="hint hint--prose">
        The post-half hold, against synthetic fixtures. Unlisted — not linked from anywhere
        else in the app.
      </p>

      <section className="bilab__entry">
        <h2 className="bilab__title">Grid, no facts available — tap does nothing (not a button)</h2>
        <BetweenInnings feed={feed()} bundle={minimalBundle} marginNotes={[]} inning={1} half="top" revealedThrough={0} gameDate={GAME_DATE} battingSide="away" getDerived={() => ({})} />
      </section>

      <section className="bilab__entry">
        <h2 className="bilab__title">Tap the grid — person-scoped fact (headshot)</h2>
        <BetweenInnings feed={feed()} bundle={minimalBundle} marginNotes={[headshotNote]} inning={1} half="top" revealedThrough={0} gameDate={GAME_DATE} battingSide="away" getDerived={() => ({})} />
      </section>

      <section className="bilab__entry">
        <h2 className="bilab__title">Tap the grid — team-level fact (no avatar slot)</h2>
        <BetweenInnings feed={feed({ probables: false })} bundle={{ away: bundle.away, teamRecords: { away: bundle.teamRecords.away } }} marginNotes={[]} inning={1} half="top" revealedThrough={0} gameDate={GAME_DATE} battingSide="away" getDerived={() => ({})} />
      </section>

      <section className="bilab__entry">
        <h2 className="bilab__title">Tap the grid — missing photo (fallback chain: photo → logo → monogram)</h2>
        <BetweenInnings feed={feed()} bundle={minimalBundle} marginNotes={[fallbackNote]} inning={1} half="top" revealedThrough={0} gameDate={GAME_DATE} battingSide="away" getDerived={() => ({})} />
      </section>

      <section className="bilab__entry">
        <h2 className="bilab__title">Tap-through — cycles every fact, then returns to the grid</h2>
        <BetweenInnings feed={feed({ probables: false })} bundle={minimalBundle} marginNotes={cycleNotes} inning={1} half="top" revealedThrough={0} gameDate={GAME_DATE} battingSide="away" getDerived={() => ({})} />
      </section>

      <section className="bilab__entry">
        <h2 className="bilab__title">Scenario — quiet half (top 6, 1-2-3 inning)</h2>
        <BetweenInnings
          feed={feed()} bundle={bundle}
          marginNotes={[{ text: 'Peralta is riding a 3-outing scoreless streak entering tonight.', kind: 'scorelessStreak', score: 32, dedupeKey: 'scorelessStreak-642547', personId: 642547, side: 'home' }]}
          inning={6} half="top" revealedThrough={halfIndex(6, 'top')} gameDate={GAME_DATE}
          battingSide="away" getDerived={() => ({})}
        />
      </section>

      <section className="bilab__entry">
        <h2 className="bilab__title">Scenario — loud half (bottom 4, pitching change, 5 runs)</h2>
        <BetweenInnings
          feed={feed()} bundle={bundle} marginNotes={cycleNotes}
          inning={4} half="bottom" revealedThrough={halfIndex(4, 'bottom')} gameDate={GAME_DATE}
          battingSide="home" getDerived={() => ({})}
        />
      </section>

      <section className="bilab__entry">
        <h2 className="bilab__title">Scenario — first hold of the game (top 1, sub-5 pool)</h2>
        <BetweenInnings
          feed={feed()} bundle={bundle} marginNotes={[]}
          inning={1} half="top" revealedThrough={halfIndex(1, 'top')} gameDate={GAME_DATE}
          battingSide="away" getDerived={() => ({})}
        />
      </section>
    </div>
  )
}
