import { Suspense, lazy, useCallback, useState } from 'react'
import { rankedDimensions } from '../../../../lib/ballpark/ballparkData.js'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { parkKey } from '../../../../lib/ballpark/parkKeys.js'
import { ordinal } from '../../../../lib/format.js'
import {
  fieldIds,
  resolveParkName,
  resolvePhoto,
  withoutBrokenArt,
} from '../../../../lib/ballpark/ballparkArt.js'
import { isClerkEnabled } from '../../../../lib/clerkConfig.js'
import { useCopy } from '../../../../copy/copyContext.js'
import { BallparkDiagram } from '../../../../components/ballpark/BallparkDiagram.jsx'
import { managerFact } from '../../../../components/team/ManagerFact.jsx'
import { EmptyState } from '../../../../components/ui/state/EmptyState.jsx'
import { FactGrid } from '../../../../components/ui/frame/FactGrid.jsx'
import { Facts, RankGroup } from '../../../../components/ballpark/BallparkFacts.jsx'
import { useBallparkDraft, useFocalPick } from './useBallparkDraft.js'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'

// The Overview's Ballpark card. Two stacked rows: a HERO (a photograph of the
// place beside its name) over the DETAILS (the field diagram beside the facts,
// the note, and the ranked dimensions). Both rows collapse to a single column
// below 740px — the app's one responsive breakpoint (src/tokens/layout.css).
//
// Same underlying content as the lineup page's BallparkModal, laid out inline
// rather than behind a tap: this IS the full detail view here, not a preview.
//
// No game data the whole way down. Park geometry carries no score, the
// photo is a building, and the note is admin-typed prose about that building —
// nothing here is derived from a game. `team.venue.name` comes from the weekly
// static snapshot (gen-teams.mjs), so there is no live fetch either. Renders
// nothing when there is no venue name at all — a lean feed row, same graceful
// degrade every MiLB selector uses.
//
// `attendance` (season avg/high/low/total, sellouts and three league ranks,
// MLB only) is the one piece
// of this card built from completed games rather than hand-authored geometry —
// still open (a season aggregate over Final games, same footing as
// WAR), precomputed by the nightly gen-attendance.mjs (src/api/attendance.js).
// null for MiLB or a club with no home games ingested yet; the Facts rows
// simply don't render.
//
// LEAGUE RANKS ARE MLB-ONLY; THE DRAWING AND THE PHOTO/NAME HALF ARE NOT.
// `ballparkData.js`'s BALLPARKS table (facts, league ranks) covers the MLB
// parks only, so `rankedDimensions` finds nothing for a minor-league park. The
// drawing comes from the layout registry instead (`resolveBallparkLayout`),
// which also covers the minor-league parks it could draw from their posted
// distances (#1859); a park it cannot draw resolves to null and the
// `ballparkcard__layout` half simply does not render. The hero (photo + name)
// and the owner's gear are NOT gated on either lookup: they key off the venue's
// own name either way (its canonical, alias-resolved name for an MLB park,
// the raw feed name for anything else — MiLB has no alias table to resolve
// through), so every park on file in `milb-ballparks.json`
// (`scripts/gen-milb-ballparks.mjs`) gets the same photo/name/logo editor.
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
// A module-level constant so the initial state is not a fresh Set on every
// render of every card.
const EMPTY_SET = new Set()

function ParkPhoto({ name, photo, onPickFocus, onBroken }) {
  const alt = photo.creditText ? `${name}. ${photo.creditText}` : `${name}, seen from the stands`
  const img = (
    <img
      className="ballparkcard__photo"
      src={photo.src}
      alt={alt}
      style={{ objectPosition: photo.focus }}
      loading="lazy"
      decoding="async"
      // Only an OVERRIDE is worth reporting. A bundled photo that failed has
      // nothing further to fall back to, and reporting it would re-render the
      // card to the same src -- a loop rather than a recovery.
      onError={photo.isOverride ? () => onBroken(photo.src) : undefined}
    />
  )
  if (onPickFocus) {
    return (
      <button
        type="button"
        className="ballparkcard__photoWrap bpadmin__focusTarget"
        onClick={onPickFocus}
        aria-label="Tap the part of the photo to keep when it is cropped"
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
// One cell of the page's fact strip (the player page's .fact parts).
function ParkFact({ label, value, note }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">
        {value || '—'}
        {note && <span className="fact__note">{note}</span>}
      </dd>
    </div>
  )
}

function AttendanceFacts({ attendance, skipAvg }) {
  const { rank, of, total, totalRank, totalOf, sellouts, selloutOf, selloutPct } = attendance
  const { fill, fillRank, fillOf } = attendance
  return (
    <>
      <dl className="bpsheet__facts">
        {!skipAvg && (
          <Facts
            label="Avg attendance"
            value={attendance.avg.toLocaleString()}
            note={rank ? `${ordinal(rank)} of ${of}` : null}
          />
        )}
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

// `cardProps` is the one-scroll page's stamped frame and name tab (props for Card). With it the
// card is laid out for that page: the park's facts and the manager in a strip under the photo
// and name, and a plain empty state for a park with nothing drawn. `manager` shows only there.
export function BallparkCard({ team, attendance, cardProps, manager }) {
  const { t } = useCopy()
  const venueName = team.venue?.name
  const park = venueName ? rankedDimensions(venueName, team.venue?.id) : null
  // The team's home park today: no date, so the current configuration (#1859).
  const layout = venueName ? resolveBallparkLayout({ venueId: team.venue?.id, venueName }) : null

  // The park's CANONICAL name, never the raw feed string, when we have one —
  // so a renamed MLB venue resolves through its alias to the one shared
  // record. A MiLB park has no alias table to resolve through, so the raw
  // feed name IS canonical for it. `name` is what a bare-text card prints.
  // The copy fields and the bundled photo are keyed by the venue's PINNED key
  // instead (lib/ballpark/parkKeys.js), found by venue id first, so a
  // sponsor rename keeps every photo and note an admin saved for the park.
  const name = park ? park.name : venueName
  // Computed before the early return below so the hooks under it always run —
  // a park with no venue name at all still has to call them, in the same order.
  const key = name ? parkKey(venueName, team.venue?.id) : ''
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

  // Every override image this card has watched fail to load. Held BY URL rather
  // than as a flag, so a fresh upload -- which always gets a fresh URL, see
  // api/ballpark-photo.js -- is tried on its own instead of staying fallen back
  // for the rest of the session.
  const [brokenArt, setBrokenArt] = useState(EMPTY_SET)
  const noteBroken = useCallback((url) => {
    setBrokenArt((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))
  }, [])
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
  const shown = withoutBrokenArt(draft.shown, brokenArt)
  const title = resolveParkName(name, { name: shown.name, wordmark: shown.wordmark })
  // The bundled photo, or the owner's replacement, with the crop and credit
  // that belong to whichever won. All of these come from the copy store already
  // pattern-validated (registry.js), so nothing here needs re-checking — except
  // a draft value, which has not been through sanitizeOverrides yet. That is
  // safe for the same reason a controlled input is: the value came from this
  // browser's own file picker as an object URL, and the moment it is SAVED it
  // goes through the registry's choke point like everything else.
  const photo = resolvePhoto(key, {
    photo: shown.photo,
    credit: shown.credit,
    focus: shown.focus,
  })

  const admin = isClerkEnabled && (
    <Suspense fallback={null}>
      <BallparkAdminBar parkKey={key} draft={draft} saved={saved} />
    </Suspense>
  )
  const drawn = Boolean(park || layout)
  const facts = [
    park && <ParkFact key="o" label="Opened" value={park.built} />,
    park && <ParkFact key="r" label="Roof" value={park.roof} />,
    park?.capacity && <ParkFact key="c" label="Capacity" value={park.capacity.toLocaleString()} />,
    attendance && (
      <ParkFact
        key="a"
        label="Avg crowd"
        value={attendance.avg.toLocaleString()}
        note={attendance.rank ? `${ordinal(attendance.rank)} of ${attendance.of}` : null}
      />
    ),
    manager && <ParkFact key="m" label="Manager" value={managerFact(manager)} />,
  ].filter(Boolean)
  return (
    <Card
      {...(cardProps ?? {
        head: (
          <SectionHead look="band" club action={admin}>
            Ballpark
          </SectionHead>
        ),
      })}
    >
      <div className="ballparkcard__hero">
        {photo && (
          <ParkPhoto
            name={name}
            photo={photo}
            onPickFocus={draft.editing ? pickFocus : null}
            onBroken={noteBroken}
          />
        )}
        <div className="ballparkcard__title">
          {title.wordmark ? (
            // Unguarded, unlike the photo: `text` is always behind a wordmark
            // (resolveParkName), so a wordmark that fails falls back to the
            // typeset name, and it cannot loop.
            <img
              className="ballparkcard__logo"
              src={title.wordmark}
              alt={title.text}
              loading="lazy"
              onError={() => noteBroken(title.wordmark)}
            />
          ) : (
            <p className="ballparkcard__name">{title.text}</p>
          )}
        </div>
      </div>

      {cardProps && admin}
      {cardProps && facts.length > 0 && (
        <FactGrid look="strip" className={`tnext__parkfacts tnext__parkfacts--${facts.length}`}>
          {facts}
        </FactGrid>
      )}

      {draft.editing && (
        <Suspense fallback={null}>
          <BallparkEditFields draft={draft} defaultName={name} />
        </Suspense>
      )}

      {/* The diagram/dimensions half. An MLB park draws its wall and ranks its
          dimensions against the league. A minor-league park the layout
          registry can draw (#1859) gets the drawing alone: its posted
          distances label it, and there is no league to rank it in. A park
          with neither ends at the hero + gear above. */}
      {cardProps && !drawn && (
        <EmptyState size="compact">No dimensions on file for this park.</EmptyState>
      )}
      {drawn && (
        <div className="ballparkcard__layout">
          {layout && <BallparkDiagram className="ballparkcard__diagram" layout={layout} />}
          <div className="ballparkcard__details">
            {park && !cardProps && (
              <dl className="bpsheet__facts">
                <Facts label="Opened" value={park.built} />
                <Facts label="Roof" value={park.roof} />
                <Facts label="Capacity" value={park.capacity?.toLocaleString()} />
              </dl>
            )}
            {attendance && <AttendanceFacts attendance={attendance} skipAvg={Boolean(cardProps)} />}
            {note && <p className="ballparkcard__note">{note}</p>}
            {park && (
              <Stack gap="loose" className="bpsheet__ranks">
                <RankGroup
                  title="Outfield distances"
                  rows={park.rows.filter((r) => r.group === 'dist')}
                />
                <RankGroup title="Wall heights" rows={park.rows.filter((r) => r.group === 'wall')} />
              </Stack>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
