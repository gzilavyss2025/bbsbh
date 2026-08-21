import { useEffect, useSyncExternalStore } from 'react'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { usePlayerHoverStats } from '../../hooks/usePlayerHoverStats.js'
import { subscribeHover, getHoverSnapshot, hideHoverNow } from '../../lib/playerHoverStore.js'
import { playerHoverCardPosition } from '../../lib/playerHoverPosition.js'
import { teamPrimaryColor } from '../../lib/teams.js'

const CARD_ID = 'player-hover-card'

// The one global hover card — mounted ONCE in App.jsx, singleton by design
// (there is only ever one thing being hovered at a time). PlayerLink writes
// to the shared store on hover/focus; this reads it via useSyncExternalStore,
// so it's the only component that re-renders on a hover change. Portalled to
// <body> (ModalPortal) for the same reason the focus-mode reference sheet
// is: position: fixed off a captured rect must land in the ROOT stacking
// context, not under whatever card/section happened to render the trigger,
// several of which set overflow: hidden or isolation: isolate.
export function PlayerHoverCard() {
  const { id, name, rect } = useSyncExternalStore(subscribeHover, getHoverSnapshot, getHoverSnapshot)
  const active = id != null
  const { data, loading } = usePlayerHoverStats(id, active)

  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'Escape') hideHoverNow()
    }
    // A captured rect describes where the trigger WAS — once the page moves
    // the card is no longer anchored to anything real, so it closes rather
    // than tracking the scroll live. `wheel` and `touchmove` close it for a
    // reason `scroll` alone misses: a wheel tick over a page (or a pane) with
    // nothing left to scroll fires NO scroll event, so the intent to travel
    // is there and the card would sit through it.
    const close = () => hideHoverNow()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('touchmove', close, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('wheel', close)
      window.removeEventListener('touchmove', close)
    }
  }, [active])

  if (!active || !rect || (!loading && !data)) return null

  const pos = playerHoverCardPosition(rect, { width: window.innerWidth, height: window.innerHeight })
  const accent = data?.team ? teamPrimaryColor(data.team.id) : null

  return (
    <ModalPortal>
      <div
        id={CARD_ID}
        role="dialog"
        aria-label={data?.fullName ?? name ?? ''}
        className="phcard"
        style={{
          left: pos.left,
          top: pos.top,
          ...(accent ? { '--phcard-accent': accent } : undefined),
        }}
      >
        {data ? <PlayerHoverCardBody data={data} /> : <div className="phcard__loading" aria-hidden="true" />}
      </div>
    </ModalPortal>
  )
}

function metaLine(data) {
  const hand = data.isPitcher ? data.throws : data.bats
  const handLabel = data.isPitcher ? 'Throws' : 'Bats'
  return [data.posAbbr, hand ? `${handLabel} ${hand}` : null, data.number ? `#${data.number}` : null]
    .filter(Boolean)
    .join(' · ')
}

// A club-identity tag beside the name — only for a genuinely non-MLB level
// or a rehab assignment, never a plain current MLB player (the crest already
// names his club; a "MILWAUKEE BREWERS" pill under Jackson Chourio's name
// said nothing a reader didn't already know). At most one tag, since rehab
// and a genuine level assignment can never both be true (see
// resolveHoverIdentity in api/playerHoverCard.js). Rehab is dashed rather
// than solid, echoing that it's a temporary status, not his real team.
function identityTag(data) {
  if (!data.onRehab && !data.teamLevelLabel) return null
  const place = [data.teamLevelLabel, data.team?.name].filter(Boolean).join(' · ')
  if (!place) return null
  return data.onRehab
    ? { kind: 'rehab', text: `On rehab · ${place}` }
    : { kind: 'level', text: place }
}

function PlayerHoverCardBody({ data }) {
  const tag = identityTag(data)
  return (
    <>
      <div className="phcard__spine" />
      <div className="phcard__head">
        <Headshot
          personId={data.id}
          name={data.fullName}
          teamId={data.team?.id ?? null}
          fallbackTeamId={data.team?.parentOrgId ?? null}
          className="phcard__photo"
        />
        <div className="phcard__id">
          <div className="phcard__name">{data.fullName}</div>
          <div className="phcard__meta">{metaLine(data)}</div>
          {tag && <span className={`phcard__tag phcard__tag--${tag.kind}`}>{tag.text}</span>}
        </div>
        {data.team && (
          <TeamLogo teamId={data.team.id} name={data.team.name} size={30} className="phcard__crest" />
        )}
      </div>
      <div className="phcard__rule" />
      <div className="phcard__stats">
        {data.fields.map((f) => (
          <div className="phcard__tile" key={f.k}>
            <span className="phcard__tilev">{f.v}</span>
            <span className="phcard__tilek">{f.k}</span>
          </div>
        ))}
      </div>
    </>
  )
}
