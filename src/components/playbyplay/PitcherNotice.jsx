import { useEffect, useState } from 'react'
import { headshotSources, isMlbTeamId, teamClubName, teamLogoUrl, teamTintColor } from '../../lib/teams.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../lib/headshot/retry.js'
import { logHeadshotEvent } from '../../lib/headshot/log.js'
import { eventCardClass } from '../../lib/design/cardClass.js'
import { useHeadshotStep, useImgReady } from '../../hooks/images/useHeadshotStep.js'
import { TABS } from './cardCopy.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

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
export function PitcherNotice({ pitcher, teamId = null, teamName, className = '', label = TABS.pitching, entering = null, flag = null, logo = true }) {
  if (!pitcher) return null
  return (
    <div className={`change ${className}`}>
      <ActorHead tab={label} id={pitcher.id} name={pitcher.name} jersey={pitcher.jersey} hand={pitcher.hand} teamId={teamId} teamName={teamName} logo={logo}>
        {flag && <span className="change__flag">{flag}</span>}
      </ActorHead>
      {entering && (
        <span className="change__entering">
          <span className="change__enteringcount">{entering.pitches} pitches</span>
          <span className="change__enteringwhen">at {entering.halfLabel}</span>
        </span>
      )}
    </div>
  )
}

// The body every actor card shares (ADR-0113, slice 2): the photo, the tab naming the
// event, the name ("Last, First"), a row of badges (jersey, throwing hand, PR), what the
// caller adds under them, and the club's logo at the right end. The club is a logo, not
// words; `teamName` is its alt text. A card with no club draws no logo.
export function ActorHead({ tab, id, name, jersey, hand, pr = false, teamId = null, teamName, logo = true, children }) {
  return (
    <>
      <PitcherPhoto personId={id} name={name} teamId={teamId} stamped />
      <div className="change__body">
        <h4 className="card__name">{tab}</h4>
        <span className="change__pitcher">
          <PlayerLink id={id}>{name}</PlayerLink>
        </span>
        <span className="change__badges">
          {jersey ? <span className="change__jersey">{jersey}</span> : null}
          {hand ? <span className="change__hand">{hand}HP</span> : null}
          {pr ? <span className="change__prtag">PR</span> : null}
        </span>
        {children}
      </div>
      {logo && teamId != null && <TeamLogo teamId={teamId} name={teamName ?? teamClubName(teamId) ?? ''} size={36} className="change__logo" />}
    </>
  )
}

// A reliever's card repeated at the head of the window holding his first batter
// (focus mode, PlayByPlay's lead-in, which owns the wrapper). The change itself
// trails the at-bat BEFORE it, so without this the page with his first result
// never names him. "Pitching", not "Now pitching": he is already in, the wording
// the persistent header drops to for an arm already in.
export function ReliefRepeat({ pitcher, teamId, teamName }) {
  return <PitcherNotice pitcher={pitcher} teamId={teamId} teamName={teamName} className={eventCardClass('change--framed')} label={TABS.reminder} />
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
export function PitcherPhoto({ personId, name, teamId = null, bare = false, large = false, stamped = false }) {
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
  const underlayUrl = teamId && !logoFailed && !bare ? teamLogoUrl(teamId) : null
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

  // `bare`: a person's photo or nothing (the ejection card), never a logo or a monogram box.
  if (!url && !underlayUrl) {
    if (bare) return null
    return (
      <span className="change__shot change__shot--fallback" aria-hidden="true">
        {monogram}
      </span>
    )
  }
  return (
    <span
      className={`change__shot${showLogo ? ' change__shot--logo' : ''}${stamped || large ? ' change__shot--stamped' : ''}${large ? ' change__shot--lg' : ''}`}
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
