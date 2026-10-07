import { useEffect, useState } from 'react'
import { headshotSources, isMlbTeamId, teamLogoUrl, teamTintColor } from '../../lib/teams.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../lib/headshot/retry.js'
import { logHeadshotEvent } from '../../lib/headshot/log.js'
import { noticeClass } from '../../lib/design/noticeClass.js'
import { useHeadshotStep, useImgReady } from '../../hooks/images/useHeadshotStep.js'
import { PlayerLink } from '../player/PlayerLink.jsx'

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
//
// `flag`, when given, is the full Now Pitching card's note under the name —
// "Pitched yesterday" or "Starter in relief" (pitcherCard/PitcherCard.jsx).
export function PitcherNotice({ pitcher, teamId = null, teamName, className = '', label = 'Now pitching', entering = null, flag = null }) {
  if (!pitcher) return null
  return (
    <div className={`change ${className}`}>
      <PitcherPhoto personId={pitcher.id} name={pitcher.name} teamId={teamId} />
      <div className="change__body">
        <span className="change__now">
          {label}{teamName ? ` for the ${teamName}` : ''}
        </span>
        <span className="change__pitcher">
          <PlayerLink id={pitcher.id}>{pitcher.name}</PlayerLink>
          {/* Uniform number + throwing hand, right-aligned same as the
              lineup card's .lineup__jersey (see index.css) rather than
              trailing inline after the name. */}
          <span className="change__badges">
            {pitcher.jersey ? <span className="change__jersey">{pitcher.jersey}</span> : null}
            {pitcher.hand ? <span className="change__hand">{pitcher.hand}HP</span> : null}
          </span>
        </span>
        {flag && <span className="change__flag">{flag}</span>}
      </div>
      {entering && (
        <span className="change__entering">
          <span className="change__enteringcount">{entering.pitches} pitches</span>
          <span className="change__enteringwhen">at {entering.halfLabel}</span>
        </span>
      )}
    </div>
  )
}

// A reliever's card repeated at the head of the window holding his first batter
// (focus mode). The change itself trails the at-bat BEFORE it, so without this
// the page with his first result never names him. Windowed only — a stacked half
// already reads change-then-batter, and the same card twice running is noise.
// "Pitching", not "Now pitching": he was announced a tap ago, the wording the
// persistent header drops to for an arm already in.
export function ReliefRepeat({ pitcher, teamId, teamName }) {
  if (!pitcher) return null
  return (
    <div className="pbp__entry">
      <PitcherNotice pitcher={pitcher} teamId={teamId} teamName={teamName} className={noticeClass({ tone: 'event', className: 'change--framed' })} label="Pitching" />
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
  const [logoFailed, setLogoFailed] = useState(false)
  // Reset fallback progress on identity change, computed during render (not
  // in an effect) — see Headshot.jsx for the same pattern and rationale.
  const identityKey = `${personId}|${teamId}|${mlb}`
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey)
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey)
    setLogoFailed(false)
  }
  // Two tries per photo source, the retry after a pause (headshot/retry.js).
  const stepInfo = { component: 'PitcherPhoto', personId, teamId, hasName: Boolean(name) }
  const { url, onError: onPhotoError } = useHeadshotStep(identityKey, sources, stepInfo)
  // The logo is the base layer from the first paint; the photo replaces it once
  // loaded (same rule as Headshot.jsx).
  const underlayUrl = teamId && !logoFailed ? teamLogoUrl(teamId) : null
  const logoUrl = !url ? underlayUrl : null
  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?' // caps-js-exempt
  // Issue #1446's trace: note every time a real face is NOT what's drawn.
  useEffect(() => {
    if (url || (logoUrl && !personId)) return
    logHeadshotEvent({ kind: logoUrl ? 'logo-shown' : 'monogram-shown', ...stepInfo, shown: logoUrl ? 'logo' : monogram })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stepInfo is rebuilt each render; these are its inputs
  }, [url, logoUrl, personId, teamId, name])
  const bg = teamTintColor(teamId)
  const photoReady = useImgReady(url)
  const logoReady = useImgReady(underlayUrl)
  const photoShown = Boolean(url) && photoReady.pending === undefined
  const showLogo = Boolean(underlayUrl) && !photoShown

  if (!url && !underlayUrl) {
    return (
      <span className="change__shot change__shot--fallback" aria-hidden="true">
        {monogram}
      </span>
    )
  }
  return (
    <span
      className={`change__shot${showLogo ? ' change__shot--logo' : ''}`}
      style={showLogo && bg ? { backgroundColor: bg } : undefined}
      aria-hidden="true"
    >
      {url && (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          data-pending={photoReady.pending}
          onLoad={photoReady.onLoad}
          onError={onPhotoError}
          crossOrigin={HEADSHOT_CROSS_ORIGIN}
          aria-hidden="true"
        />
      )}
      {showLogo && (
        <img
          key={underlayUrl}
          src={underlayUrl}
          alt=""
          loading="lazy"
          decoding="async"
          data-pending={logoReady.pending}
          onLoad={logoReady.onLoad}
          onError={() => setLogoFailed(true)}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
