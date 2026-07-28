import { useState } from 'react'
import { headshotSources, isMlbTeamId, teamLogoUrl, teamTintColor } from '../lib/teams.js'
import { PlayerLink } from './PlayerLink.jsx'

// The "now pitching" notification card — the entering pitcher's headshot beside
// his name / number / throwing hand, on the seal-amber attention surface. Shared
// by two surfaces so a pitching change looks the same wherever it lands: the
// row-2 stat slot when a change is announced BEFORE a half's first pitch
// (StatBox), and the play-by-play feed when a change happens MID-inning
// (PlayByPlay). The outer card chrome (the statbox card vs. the inline feed
// card) comes from the caller's `className`; the inner photo+body layout is
// this component's. `pitcher` is the { id, name, jersey, hand } shape
// selectPrePitchChanges / pitchingChangePitcher build. `teamId` (optional) is
// the club he's pitching for — passed through to PitcherPhoto for its
// logo fallback.
//
// `entering`, when given, is the persistent header's own extra: how many
// pitches he'd already thrown BEFORE this half — `{ pitches, halfLabel }`,
// e.g. `{ pitches: 78, halfLabel: 'the start of the 6th' }`. Optional and
// only ever passed by HalfInning.jsx's persistent card — a pre-pitch/mid-
// inning change notice (StatBox.jsx / PlayByPlay.jsx's own uses of this same
// component) has no natural "entering the half" moment to hang it on.
export function PitcherNotice({ pitcher, teamId = null, teamName, className = '', label = 'Now pitching', entering = null }) {
  if (!pitcher) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={pitcher.id} name={pitcher.name} teamId={teamId} />
      <div className="pitchernotice__body">
        <span className="pitchernotice__now">
          {label}{teamName ? ` for the ${teamName}` : ''}
        </span>
        <span className="pitchernotice__pitcher">
          <PlayerLink id={pitcher.id}>{pitcher.name}</PlayerLink>
          {/* Uniform number + throwing hand, right-aligned same as the
              lineup card's .lineup__jersey (see index.css) rather than
              trailing inline after the name. */}
          <span className="pitchernotice__badges">
            {pitcher.jersey ? <span className="pitchernotice__jersey">{pitcher.jersey}</span> : null}
            {pitcher.hand ? <span className="pitchernotice__hand">{pitcher.hand}HP</span> : null}
          </span>
        </span>
      </div>
      {entering && (
        <span className="pitchernotice__entering">
          <span className="pitchernotice__enteringcount">{entering.pitches} pitches</span>
          <span className="pitchernotice__enteringwhen">at {entering.halfLabel}</span>
        </span>
      )}
    </div>
  )
}

// The entering pitcher's headshot. Walks the same ordered fallback chain as
// Headshot.jsx (`headshotSources` — silo, then milb for a MiLB/unknown club,
// never milb for a confirmed MLB player, see that file's header for the
// policy this guards). `teamId` is always the actual club he's playing for
// here (every PlayByPlay/HalfInning caller passes the real game team id, not
// a display/parent-org id), so `isMlbTeamId(teamId)` is the correct gate
// directly. On a full photo miss, degrades to a centered team logo (when
// `teamId` is known — same treatment as Headshot.jsx's own logo rung) rather
// than a faceless placeholder, then to a plain monogram once neither a photo
// nor a team is available.
export function PitcherPhoto({ personId, name, teamId = null }) {
  const mlb = isMlbTeamId(teamId)
  const sources = headshotSources(personId, { mlb })
  const [rung, setRung] = useState(0)
  const [logoFailed, setLogoFailed] = useState(false)
  // Reset fallback progress on identity change, computed during render (not
  // in an effect) — see Headshot.jsx for the same pattern and rationale.
  const identityKey = `${personId}|${teamId}|${mlb}`
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey)
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey)
    setRung(0)
    setLogoFailed(false)
  }
  const url = sources[rung] ?? null
  const logoUrl = !url && teamId && !logoFailed ? teamLogoUrl(teamId) : null
  const bg = teamTintColor(teamId)

  if (!url) {
    if (logoUrl) {
      return (
        <span
          className="pitchernotice__shot pitchernotice__shot--logo"
          style={bg ? { backgroundColor: bg } : undefined}
          aria-hidden="true"
        >
          <img
            key={logoUrl}
            src={logoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
            aria-hidden="true"
          />
        </span>
      )
    }
    const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?' // caps-js-exempt
    return (
      <span className="pitchernotice__shot pitchernotice__shot--fallback" aria-hidden="true">
        {monogram}
      </span>
    )
  }
  return (
    <span className="pitchernotice__shot">
      <img
        key={url}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setRung((r) => r + 1)}
        aria-hidden="true"
      />
    </span>
  )
}
