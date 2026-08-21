import { Suspense, lazy, useCallback } from 'react'
import { ordinal, rankedDimensions } from '../../../../lib/ballpark/ballparkData.js'
import { fieldIds, resolveParkName, resolvePhoto, venueKey } from '../../../../lib/ballpark/ballparkArt.js'
import { isClerkEnabled } from '../../../../lib/clerkConfig.js'
import { useCopy } from '../../../../copy/copyContext.js'
import { BallparkDiagram } from '../../../../components/ballpark/BallparkDiagram.jsx'
import { Facts, RankGroup } from '../../../../components/ballpark/BallparkFacts.jsx'
import { useBallparkDraft, useFocalPick } from './useBallparkDraft.js'

// The Overview's Ballpark card. Two stacked rows: a HERO (a photograph of the
// place beside its name) over the DETAILS (the field diagram beside the facts,
// the note, and the ranked dimensions). Both rows collapse to a single column
// below 740px — the app's one responsive breakpoint, src/CLAUDE.md.
//
// Same underlying content as the lineup page's BallparkModal, laid out inline
// rather than behind a tap: this IS the full detail view here, not a preview.
//
// Spoiler-safe and free the whole way down. Park geometry carries no score, the
// photo is a building, and the note is admin-typed prose about that building —
// nothing here is derived from a game. `team.venue.name` comes from the weekly
// static snapshot (gen-teams.mjs), so there is no live fetch either. Renders
// nothing when there is no venue name at all — a lean feed row, same graceful
// degrade every MiLB selector uses.
//
// `attendance` (season avg/high/low/total, sellouts and three league ranks,
// MLB only) is the one piece
// of this card built from completed games rather than hand-authored geometry —
// still spoiler-free (a season aggregate over Final games, same footing as
// WAR), precomputed by the nightly gen-attendance.mjs (src/api/attendance.js).
// null for MiLB or a club with no home games ingested yet; the Facts rows
// simply don't render.
//
// MEASUREMENTS ARE MLB-ONLY; THE PHOTO/NAME HALF IS NOT. `ballparkData.js`'s
// BALLPARKS table is a hand-verified diagram nobody has built for a MiLB
// park, so `rankedDimensions` finds nothing for one and the diagram/dimensions
// half of the card (`ballparkcard__layout`) simply does not render — the same
// graceful-degrade convention `ballparkFor` documents. The hero (photo + name)
// and the owner's gear are NOT gated on that lookup: they key off the venue's
// own name either way (its canonical, alias-resolved name for an MLB park,
// the raw feed name for anything else — MiLB has no alias table to resolve
// through), so every park on file in `milb-ballparks.json`
// (`scripts/gen-milb-ballparks.mjs`) gets the same photo/name/logo editor with
// no diagram beside it.
//
// EDITING IN PLACE. The site owner gets a gear in the masthead that turns the
// card into a form for its own copy fields — the park's name, its art, the
// credit and the crop. It writes through the SAME copy store the /admin panel
// writes, so a save is a Redis field and never a deploy; docs/adr/0025 has the
// why, and BallparkAdminBar.jsx has the auth boundary. Everything to do with it
// is inert for a normal visitor: the gear's module is lazy and only reached on
// a Clerk-configured deploy, and `draft.editing` cannot become true without it.

// Both halves of the editor are lazy, for two different reasons.
//
// The BAR imports @clerk/clerk-react at its top level, whose hooks throw with no
// ClerkProvider ancestor — so it must not even be fetched on a deploy without
// Clerk. Same lazy-behind-isClerkEnabled shape as every other Clerk-touching
// module here (ProfileAccount, the cloud-sync components).
//
// The FIELDS have no such constraint and are lazy anyway, because a form that
// exactly one person in the world can open has no business in the bundle every
// visitor downloads. It carries 61-ballpark-admin.css with it (the 58+ partials
// are component-imported rather than listed in index.css), which means the
// editor's stylesheet is code-split too.
const BallparkAdminBar = lazy(() =>
  import('./BallparkAdminBar.jsx').then((m) => ({ default: m.BallparkAdminBar })),
)
const BallparkEditFields = lazy(() =>
  import('./BallparkEditFields.jsx').then((m) => ({ default: m.BallparkEditFields })),
)

// The photo itself, cropped to widescreen with the admin's chosen focal point.
//
// ATTRIBUTION WITHOUT A CAPTION. There is no visible credit line under the
// photo any more, which is a licence question and not only a layout one: CC BY
// and CC BY-SA require attribution, and a `title` tooltip alone would show
// NOTHING on a phone — this app's primary device. So a bundled photo wraps in a
// link to its Commons file page, where the author and licence live. That is the
// alternative the licence itself sanctions ("a URI or hyperlink to a resource
// that includes the required information"), it survives touch, and the credit
// still rides in `title` and `alt` for hover and screen readers.
//
// An admin's own photo has no Commons page to point at, so it renders as a bare
// image — credited in `title`/`alt` only if they typed a credit. Whatever they
// point at is their call and their licence to hold; see the field's help text.
//
// WHILE EDITING the link is deliberately dropped even for a bundled photo, and
// the wrapper becomes the focal-point target instead. A tap has to mean one
// thing: leaving the Commons link live would send the owner off to Wikimedia
// mid-edit, which is both the wrong action and one that loses the draft.
function ParkPhoto({ name, photo, onPickFocus }) {
  const alt = photo.creditText ? `${name}. ${photo.creditText}` : `${name}, seen from the stands`
  const img = (
    <img
      className="ballparkcard__photo"
      src={photo.src}
      alt={alt}
      title={photo.creditText || undefined}
      style={{ objectPosition: photo.focus }}
      loading="lazy"
      decoding="async"
    />
  )
  if (onPickFocus) {
    return (
      <button
        type="button"
        className="ballparkcard__photoWrap bpadmin__focusTarget"
        onClick={onPickFocus}
        title="Tap the part of the photo to keep when it is cropped"
      >
        {img}
      </button>
    )
  }
  if (!photo.creditHref) return <div className="ballparkcard__photoWrap">{img}</div>
  return (
    <a
      className="ballparkcard__photoWrap"
      href={photo.creditHref}
      target="_blank"
      rel="noreferrer noopener"
    >
      {img}
    </a>
  )
}

// The attendance half of the details column: what this club draws, and where
// each of those figures stands in the league. Two strips of three under the
// park's own opened/roof/capacity strip.
//
// EVERY RANK CARRIES ITS OWN NOTE, because a bare ordinal is not a fact anyone
// can hold — the same argument outlierNote() makes for the dimension strip.
// "2nd" under Total says nothing; "2nd / 3,157,434" says what was ranked. The
// three ranks disagree with each other on purpose (see attendance.js's
// header), so each one has to show the figure it was ordered on.
//
// A rank the file could not compute prints an em dash through `Facts`, which
// is the whole reason the season high/low pair above needs no null guard: a
// club with no capacity on file (a park not in BALLPARKS) still shows its
// crowds and simply cannot show its fill.
function AttendanceFacts({ attendance }) {
  const { rank, of, total, totalRank, totalOf, sellouts, selloutOf, selloutPct } = attendance
  const { fill, fillRank, fillOf } = attendance
  return (
    <>
      <dl className="bpsheet__facts">
        <Facts
          label="Avg attendance"
          value={attendance.avg.toLocaleString()}
          note={rank ? `${ordinal(rank)} of ${of}` : null}
        />
        <Facts label="Season high" value={attendance.high.toLocaleString()} />
        <Facts label="Season low" value={attendance.low.toLocaleString()} />
      </dl>
      <dl className="bpsheet__facts">
        <Facts
          label="Sellouts"
          value={sellouts == null ? '' : `${sellouts} of ${selloutOf}`}
          note={selloutPct ? `${selloutPct}%+ full` : null}
        />
        <Facts
          label="Total rank"
          value={totalRank ? `${ordinal(totalRank)} of ${totalOf}` : ''}
          note={total != null ? total.toLocaleString() : null}
        />
        <Facts
          label="Fill rank"
          value={fillRank ? `${ordinal(fillRank)} of ${fillOf}` : ''}
          note={fill != null ? `${fill}% full` : null}
        />
      </dl>
    </>
  )
}

export function BallparkCard({ team, attendance }) {
  const { t } = useCopy()
  const venueName = team.venue?.name
  const park = venueName ? rankedDimensions(venueName) : null

  // The park's CANONICAL name, never the raw feed string, when we have one —
  // so a renamed MLB venue resolves through its alias to the one shared
  // record. A MiLB park has no alias table to resolve through, so the raw
  // feed name IS canonical for it; that is also exactly what parkBackdrop.js
  // already assumes for the same fallback (see its header). Either way `name`
  // is what keys the copy fields (`milb-ballparks.json`'s entries are keyed
  // the identical way) and what a bare-text card falls back to.
  const name = park ? park.name : venueName
  // Computed before the early return below so the hooks under it always run —
  // a park with no venue name at all still has to call them, in the same order.
  const key = name ? venueKey(name) : ''
  // No useMemo on either of these. React Compiler memoizes them, and a manual
  // useMemo keyed on `key` made it bail out of optimizing this component
  // entirely ("existing memoization could not be preserved") — which is a worse
  // outcome than recomputing five string lookups.
  const ids = fieldIds(key)
  const saved = {
    name: t(ids.name),
    wordmark: t(ids.wordmark),
    photo: t(ids.photo),
    credit: t(ids.credit),
    focus: t(ids.focus),
  }
  const draft = useBallparkDraft(saved)
  const { setValue } = draft
  const pickFocus = useFocalPick(useCallback((focus) => setValue('focus', focus), [setValue]))

  if (!name) return null

  // Empty until the owner writes one in /admin — most parks have no note, and a
  // card with an empty paragraph in it looks broken rather than unwritten. Only
  // an MLB park (park != null) has a note field at all — see milbParkFields()'s
  // header in registry.js for why a MiLB park skips it along with the diagram.
  const note = park ? t(`ballpark.${key}`) : ''
  // What to paint: the saved values normally, the draft while editing (with a
  // local object URL standing in for an image not yet uploaded). One render
  // path either way, so there is no second layout only the owner ever sees.
  const shown = draft.shown
  const title = resolveParkName(name, { name: shown.name, wordmark: shown.wordmark })
  // The bundled photo, or the owner's replacement, with the crop and credit
  // that belong to whichever won. All of these come from the copy store already
  // pattern-validated (registry.js), so nothing here needs re-checking — except
  // a draft value, which has not been through sanitizeOverrides yet. That is
  // safe for the same reason a controlled input is: the value came from this
  // browser's own file picker as an object URL, and the moment it is SAVED it
  // goes through the registry's choke point like everything else.
  const photo = resolvePhoto(name, {
    photo: shown.photo,
    credit: shown.credit,
    focus: shown.focus,
  })

  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Ballpark</span>
        {isClerkEnabled && (
          <Suspense fallback={null}>
            <BallparkAdminBar parkKey={key} draft={draft} saved={saved} />
          </Suspense>
        )}
      </div>
      <div className="thub-card__body">
        <div className="ballparkcard__hero">
          {photo && (
            <ParkPhoto name={name} photo={photo} onPickFocus={draft.editing ? pickFocus : null} />
          )}
          <div className="ballparkcard__title">
            {title.wordmark ? (
              <img className="ballparkcard__logo" src={title.wordmark} alt={title.text} loading="lazy" />
            ) : (
              <p className="ballparkcard__name">{title.text}</p>
            )}
          </div>
        </div>

        {draft.editing && (
          <Suspense fallback={null}>
            <BallparkEditFields draft={draft} defaultName={name} />
          </Suspense>
        )}

        {/* The diagram/dimensions half — MLB only. A MiLB park has no
            BALLPARKS record (no hand-verified distances, no digitized wall
            polygon), so there is nothing here to draw or rank; the card ends
            at the hero + gear above rather than showing a broken diagram. */}
        {park && (
          <div className="ballparkcard__layout">
            <BallparkDiagram
              className="ballparkcard__diagram"
              dist={park.dist}
              wall={park.wall}
              arc={park.arc}
            />
            <div className="ballparkcard__details">
              <dl className="bpsheet__facts">
                <Facts label="Opened" value={park.built} />
                <Facts label="Roof" value={park.roof} />
                <Facts label="Capacity" value={park.capacity?.toLocaleString()} />
              </dl>
              {attendance && <AttendanceFacts attendance={attendance} />}
              {note && <p className="ballparkcard__note">{note}</p>}
              <div className="bpsheet__ranks">
                <RankGroup
                  title="Outfield distances"
                  rows={park.rows.filter((r) => r.group === 'dist')}
                />
                <RankGroup title="Wall heights" rows={park.rows.filter((r) => r.group === 'wall')} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
