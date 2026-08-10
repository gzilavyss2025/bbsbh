import { PitcherPhoto } from './PitcherNotice.jsx'

// Focus mode only (InningViewer's `focused`, threaded down through AtBatCard
// as `focusHeader`) — the batter/pitcher matchup, GameDay-style. Its own
// component rather than inline in AtBatCard (already at PlayByPlay.jsx's
// file-size ceiling) — one small file, one job. Additive to the at-bat card
// rather than a parallel header: there's still one source of truth for the
// names/positions .pbp__top already renders below it. Decorative — the
// card's own text already names both — same PitcherPhoto/Headshot fallback
// chain (silo -> milb -> team logo -> monogram) as every other headshot in
// the app, no new sizing token (.pitchernotice__shot's own --shot-sm
// default).
export function AtBatMatchup({ batter, pitcher, battingTeamId, pitchingTeamId }) {
  if (!pitcher) return null
  return (
    <div className="pbp__matchup">
      <span className="pbp__matchup-side">
        <PitcherPhoto personId={batter.id} name={batter.last} teamId={battingTeamId} />
        <span className="pbp__matchup-name">{batter.last}</span>
      </span>
      <span className="pbp__matchup-vs" aria-hidden="true">
        vs
      </span>
      <span className="pbp__matchup-side">
        <PitcherPhoto personId={pitcher.id} name={pitcher.last} teamId={pitchingTeamId} />
        <span className="pbp__matchup-name">{pitcher.last}</span>
      </span>
    </div>
  )
}
