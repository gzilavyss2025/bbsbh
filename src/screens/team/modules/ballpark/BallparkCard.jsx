import { Suspense, lazy, useCallback } from 'react'
import { rankedDimensions } from '../../../../lib/ballpark/ballparkData.js'
import { resolveParkName, resolvePhoto, venueKey } from '../../../../lib/ballpark/ballparkArt.js'
import { isClerkEnabled } from '../../../../lib/clerkConfig.js'
import { useCopy } from '../../../../copy/copyContext.js'
import { BallparkDiagram } from '../../../../components/ballpark/BallparkDiagram.jsx'
import { Facts, RankGroup } from '../../../../components/ballpark/BallparkFacts.jsx'
import { fieldIds, useBallparkDraft, useFocalPick } from './useBallparkDraft.js'

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
// nothing for a park not on file, the same graceful-degrade convention as
// ballparkFor — which is every MiLB park.
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
function ParkPhoto({ park, photo, onPickFocus }) {
  const alt = photo.creditText
    ? `${park.name}. ${photo.creditText}`
    : `${park.name}, seen from the stands`
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

export function BallparkCard({ team }) {
  const { t } = useCopy()
  const venueName = team.venue?.name
  const park = venueName ? rankedDimensions(venueName) : null

  // Art is looked up by the park's CANONICAL name, never the raw feed string,
  // so a renamed venue resolves through its alias to the one shared record.
  // Computed before the early return below so the hooks under it always run —
  // an MiLB park with no record still has to call them, in the same order.
  const key = park ? venueKey(park.name) : ''
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

  if (!park) return null

  const distRows = park.rows.filter((r) => r.group === 'dist')
  const wallRows = park.rows.filter((r) => r.group === 'wall')

  // Empty until the owner writes one in /admin — most parks have no note, and a
  // card with an empty paragraph in it looks broken rather than unwritten.
  const note = t(`ballpark.${key}`)
  // What to paint: the saved values normally, the draft while editing (with a
  // local object URL standing in for an image not yet uploaded). One render
  // path either way, so there is no second layout only the owner ever sees.
  const shown = draft.shown
  const name = resolveParkName(park.name, { name: shown.name, wordmark: shown.wordmark })
  // The bundled photo, or the owner's replacement, with the crop and credit
  // that belong to whichever won. All of these come from the copy store already
  // pattern-validated (registry.js), so nothing here needs re-checking — except
  // a draft value, which has not been through sanitizeOverrides yet. That is
  // safe for the same reason a controlled input is: the value came from this
  // browser's own file picker as an object URL, and the moment it is SAVED it
  // goes through the registry's choke point like everything else.
  const photo = resolvePhoto(park.name, {
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
            <ParkPhoto park={park} photo={photo} onPickFocus={draft.editing ? pickFocus : null} />
          )}
          <div className="ballparkcard__title">
            {name.wordmark ? (
              <img className="ballparkcard__logo" src={name.wordmark} alt={name.text} loading="lazy" />
            ) : (
              <p className="ballparkcard__name">{name.text}</p>
            )}
          </div>
        </div>

        {draft.editing && (
          <Suspense fallback={null}>
            <BallparkEditFields draft={draft} defaultName={park.name} />
          </Suspense>
        )}

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
            {note && <p className="ballparkcard__note">{note}</p>}
            <div className="bpsheet__ranks">
              <RankGroup title="Outfield distances" rows={distRows} />
              <RankGroup title="Wall heights" rows={wallRows} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
