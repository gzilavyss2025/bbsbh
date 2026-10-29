import { useEffect, useSyncExternalStore } from 'react'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { usePlayerHoverStats } from '../../hooks/usePlayerHoverStats.js'
import { subscribeHover, getHoverSnapshot, hideHoverNow } from '../../lib/playerHoverStore.js'
import { hoverCardPosition } from '../../lib/playerHoverPosition.js'
import { headerThemeFor, headerThemeStyle, themeKeyFor } from '../../lib/headerTheme.js'
import { Pill } from '../ui/control/Pill.jsx'

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
  const { id, name, rect, detail } = useSyncExternalStore(subscribeHover, getHoverSnapshot, getHoverSnapshot)
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

  const pos = hoverCardPosition(rect, { width: window.innerWidth, height: window.innerHeight })
  // The club's band, from the Identity Lab's header triad (ADR-0030: a club may
  // colour a card that names the club). No curated triad, or no club: the house
  // navy band, which is what the band's own var() fallbacks draw.
  const theme = data?.team ? headerThemeFor(data.team.id, themeKeyFor(data.team.id, 'home', 'main')) : null

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
          ...headerThemeStyle(theme),
        }}
      >
        {data ? <PlayerHoverCardBody data={data} detail={detail} /> : <div className="phcard__loading" aria-hidden="true" />}
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

function StatRow({ label, fields, post = false }) {
  return (
    <tr className={post ? 'phcard__row phcard__row--post' : 'phcard__row'}>
      <th scope="row" className="phcard__rowk">{label}</th>
      {fields.map((f) => (
        <td key={f.k} className="phcard__rowv">{f.v}</td>
      ))}
    </tr>
  )
}

// The scorebook line: a club-coloured band (photo, two-line name, crest), an
// optional level/rehab strip, then one table — the four season figures, and a
// Postseason row under them in the same columns once he has played an October
// game. The two rows share the season row's heads (see pitcherHoverFields).
function PlayerHoverCardBody({ data, detail }) {
  const tag = identityTag(data)
  return (
    <>
      <div className="phcard__band sectionhead--band">
        <span className="phcard__photo">
          <Headshot
            personId={data.id}
            name={data.fullName}
            teamId={data.team?.id ?? null}
            fallbackTeamId={data.team?.parentOrgId ?? null}
          />
        </span>
        <div className="phcard__id">
          {data.firstName && <div className="phcard__first">{data.firstName}</div>}
          <div className="phcard__last">{data.lastName}</div>
          <div className="phcard__meta">{metaLine(data)}</div>
        </div>
        {data.team && (
          <span className="phcard__crest">
            <TeamLogo teamId={data.team.id} name={data.team.name} size={32} />
          </span>
        )}
      </div>
      {tag && (
        <div className="phcard__tagrow">
          <Pill fill="paper" className={`phcard__tag phcard__tag--${tag.kind}`}>{tag.text}</Pill>
        </div>
      )}
      {detail ? (
        <HoverDetail detail={detail} />
      ) : (
      <table className="phcard__table">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Split</span></th>
            {data.fields.map((f) => (
              <th key={f.k} scope="col" className="phcard__colk t-label t-label--nocaps">{f.k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <StatRow label="Season" fields={data.fields} />
          {data.postFields && <StatRow label="Postseason" fields={data.postFields} post />}
        </tbody>
      </table>
      )}
    </>
  )
}

// A caller's own figures in the card's table, in place of the season line
// (lib/playerHoverStore.js, `detail`). The ABS Challenges card is the one
// caller: the numbers that place a man on its plot, and below them one mark per
// review he made, oldest first, filled when the call was overturned (he was
// right) and hollow when it stood. All of it arrives as plain data:
//   columns  the column heads.
//   row      { label, cells: [{ v, over? }] }, one cell per column.
//   strip    { label, marks, right, wrong, total, shown } for a man with
//            reviews, { label } alone for a man with none, or nothing.
// The marks are a picture, so a screen reader gets the counts as text instead.
function HoverDetail({ detail }) {
  const { columns, row, strip } = detail
  return (
    <table className="phcard__table">
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Split</span></th>
          {columns.map((c) => (
            <th key={c} scope="col" className="phcard__colk t-label t-label--nocaps">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="phcard__row">
          <th scope="row" className="phcard__rowk">{row.label}</th>
          {row.cells.map((cell, i) => (
            <td key={columns[i]} className={cell.over ? 'phcard__rowv phcard__rowv--over' : 'phcard__rowv'}>{cell.v}</td>
          ))}
        </tr>
        {strip && (
          <tr className="phcard__row phcard__row--marks">
            <th scope="row" className="phcard__rowk">{strip.label}</th>
            <td colSpan={columns.length} className="phcard__marks">
              {strip.marks ? (
                <>
                  <span className="phcard__strip" aria-hidden="true">
                    {[...strip.marks].map((m, i) => (
                      <i key={i} className={m === '1' ? 'phcard__mark' : 'phcard__mark phcard__mark--wrong'} />
                    ))}
                  </span>
                  <span className="phcard__markkey">
                    <i className="phcard__mark" /> {strip.right} right <i className="phcard__mark phcard__mark--wrong" /> {strip.wrong} wrong
                  </span>
                  <span className="phcard__markkey">
                    {strip.total > strip.shown ? `Last ${strip.shown} of ${strip.total}, oldest first` : 'Oldest first'}
                  </span>
                </>
              ) : (
                <span className="phcard__markkey">No reviews</span>
              )}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
