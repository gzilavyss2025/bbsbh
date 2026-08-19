import { Suspense, lazy, useMemo } from 'react'
import { fetchTeams } from '../../api/schedule.js'
import { resolveGameNotes } from '../../api/gameNotes.js'
import { ordinal } from '../../api/person.js'
import { SPORT_LABEL, treatmentTile, defaultHomeTreatmentFor } from '../../lib/teams.js'
import { milbTreatmentTile } from '../../lib/milbColors.js'
import { readableTextColor } from '../../lib/contrast.js'
import { teamPath } from '../../lib/route.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { LinkScope } from '../../lib/nav.jsx'
import { useNav } from '../../lib/nav.js'
import { identityVersion } from '../../lib/identity/overlay.js'
import { headerThemeFor, headerThemeClass, headerThemeStyle, themeKeyFor } from '../../lib/headerTheme.js'
import { humanDate } from '../../lib/dates.js'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { ManagerLink } from '../../components/team/ManagerLink.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsOfBanner } from '../../components/seal/AsOfBanner.jsx'
import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { TeamTabBar } from './TeamTabBar.jsx'
import { useIdentityDraft } from './modules/identity/useIdentityDraft.js'

// Both halves of the identity editor are lazy, for two different reasons — the
// same split BallparkCard makes.
//
// The BAR imports @clerk/clerk-react at its top level, whose hooks throw with no
// ClerkProvider ancestor, so it must not even be fetched on a deploy without
// Clerk. The DRAWER has no such constraint and is lazy anyway, because a form
// exactly one person in the world can open has no business in the chunk every
// visitor downloads — and it carries the field catalog, 62-identity-admin.css
// and (through the catalog) the WPA and stamp modules with it.
const IdentityAdminBar = lazy(() =>
  import('./modules/identity/IdentityAdminBar.jsx').then((m) => ({ default: m.IdentityAdminBar })),
)
const IdentityDrawer = lazy(() =>
  import('./modules/identity/IdentityDrawer.jsx').then((m) => ({ default: m.IdentityDrawer })),
)

const DASH = '—'

// The two ink choices the hero picks between when it wears a club's own tint
// — same pair, same reasoning, as JerseyCombos.jsx's identical "a tile's own
// color IS the surface now" case: readableTextColor needs a real hex to run
// WCAG math against, not a CSS var reference.
const INK_DARK = '#16222F'
const INK_LIGHT = '#FBF6E9'

const TAB_TITLE = {
  overview: null,
  roster: 'Roster',
  games: 'Games',
  numbers: 'Numbers',
  minors: 'Minors',
}

// The club's most recent official press-notes PDF — a direct link-out (never
// the What's Brewing in-app modal the lineup page's Game Notes button opens for
// calibrated clubs; the team hub always jumps straight to the PDF, since
// there's no single game's blurbs to parse). No gameDate, so resolveGameNotes
// falls through to the newest note on file rather than one tied to tonight's
// game. MLB only — see gameNotes.js.
function GameNotesLink({ teamId }) {
  const { data: notes } = useAsync(() => resolveGameNotes(teamId), [teamId])
  if (!notes?.url) return null
  return (
    <a
      className="notesbtn"
      href={notes.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${notes.title} — the club's official press notes (PDF), opens in a new tab`}
    >
      Game Notes
      <span className="notesbtn__ext" aria-hidden="true">↗</span>
    </a>
  )
}

// The chrome every team-hub tab renders inside: site bar, as-of banner, back
// button, the club identity header, the browse-other-clubs strip, and the tab
// bar. `children` is the tab's own body.
//
// It owns nothing a tab needs to know about, which is the point — a tab is then
// just "load my data, render it inside the shell", and the five tabs stay
// independent of each other. Its own data comes from loadTeamIdentity.js, which
// is deliberately three cheap requests, because every tab pays for it.
//
// `asOf` / `sportId` are the route's own query hints, threaded to TeamTabBar so
// a tab switch reproduces the address the visitor arrived on — see PRD
// non-negotiable 1 in .scratch/team-page-ia.
export function TeamHubShell({
  team,
  record,
  manager,
  asOf = null,
  sportId = null,
  active,
  hiddenTabs,
  datable = true,
  children,
}) {
  const navigate = useNav()
  const isMilb = (team.sport?.id ?? 1) !== 1
  const tabTitle = TAB_TITLE[active] ?? null
  useDocumentTitle(team.name ? [team.name, tabTitle].filter(Boolean).join(' · ') : null)

  // Called for every visitor, admin or not — it touches no Clerk API and holds
  // nothing but unsaved text, so it is safe with no provider mounted. Nothing
  // can set `editing` except the lazily-loaded bar above.
  const identity = useIdentityDraft(team.id)
  // Not tied to any one game, so the hub always wears the club's Main home
  // jersey (MLB) / Home side (MiLB) — the same triad the identity header's Main
  // treatment mark already renders. Null for a club with no curated triad,
  // which leaves every bar below on the app's default navy chrome — coverage is
  // partial by design (ADR-0030).
  //
  // `wearing` is normally that Main/Home jersey and nothing else. While the
  // owner has the identity drawer open it becomes the tile SELECTED in the
  // drawer's strip, so that tuning a club's City Connect repaints the header
  // in City Connect rather than leaving the edit invisible behind a Main hero.
  // That is what makes the claim in IdentityDrawer.jsx's header true: the page
  // is the preview, through this one render path, with no editor-only mock.
  const wearing = (identity.editing && identity.treatment) || (isMilb ? 'home' : null)
  // `identityVersion()` is a memo dep, not decoration: both memos below read
  // module-level identity tables that the overlay REFILLS IN PLACE when a save,
  // a keystroke in the drawer, or the hydrating fetch lands
  // (src/lib/identity/overlay.js). The re-render arrives — App subscribes for it
  // — but a useMemo whose other deps did not move would hand back the
  // pre-override tile, which is exactly the "live preview" that quietly is not
  // one. Same class of trap as ADR-0007.
  const identityAt = identityVersion()
  const theme = useMemo(
    () => headerThemeFor(team.id, themeKeyFor(team.id, wearing ?? 'home', wearing ?? 'main')),
    [team.id, wearing, identityAt],
  )
  // The hero row's own background: the club's curated DEFAULT HOME jersey
  // tile — Identity Lab's "Default home" pick (MLB), or the Home side
  // (MiLB, no treatment vocabulary to pick from). Deliberately a SEPARATE
  // lookup from `theme` above: that triad is tuned for text on a themed BAR
  // and covers a small, curated subset of clubs, while this is the same tile
  // color the logo box already wore (broader coverage, no bar involved) —
  // now sized to the whole row instead of a 128px box, so the ink has to be
  // picked fresh rather than assumed. Same `readableTextColor` call
  // JerseyCombos.jsx makes for the identical "tile color IS the surface" case.
  const headerTile = useMemo(() => {
    const tile = isMilb
      ? milbTreatmentTile(team.id, wearing ?? 'home')
      : treatmentTile(team.id, wearing ?? defaultHomeTreatmentFor(team.id) ?? 'main')
    const ink = tile.pinstripeColor
      ? INK_DARK
      : tile.tint
        ? readableTextColor(tile.tint, INK_LIGHT, INK_DARK)
        : null
    return { ...tile, ink }
  }, [team.id, isMilb, wearing, identityAt])
  const headerStyle = {
    '--tint': headerTile.tint || undefined,
    '--pinstripe-color': headerTile.pinstripeColor || undefined,
    '--pinstripe-bg': headerTile.pinstripeBg || undefined,
    '--ink': headerTile.ink || undefined,
  }
  // Same finger-scrollable nav strip GameSelect's slate header uses to jump
  // between clubs — sourced from this club's own level so it re-lists on every
  // level switch, same as there.
  const navSportId = team.sport?.id ?? sportId ?? null
  const levelTeams = useAsync(
    () => (navSportId ? fetchTeams(navSportId) : Promise.resolve([])),
    [navSportId],
  )
  const back = () => window.history.back()

  return (
    <LinkScope asOf={asOf} sportId={team.sport?.id ?? sportId ?? null}>
      <div
        className={`screen team-hub ${headerThemeClass(theme)}`.trim()}
        style={headerThemeStyle(theme)}
      >
        <SiteHeader />
        <BackBtn onClick={back} />

        <header
          className={`team-hub__id${headerTile.pinstripeColor ? ' team-hub__id--pinstripe' : ''}`}
          style={headerStyle}
        >
          {/* The club's default home mark, full size and unpositioned — no
              edge-bleed, no crop, no per-treatment x/y nudge. Those exist so a
              small tile reads as a patch printed on a jersey; here the tile's
              own color now fills the whole row (`--tint` above), so the mark
              just sits on it at its own natural proportions, same idea as
              JerseyCombos' deck cards (28-team-hub.css's
              .jerseydeck__logobox .teamlogo, `transform: none`). */}
          <div className="team-hub__logo">
            <TeamLogo teamId={team.id} name={team.name} variant={headerTile.logoVariant} size={104} />
          </div>
          <div>
            <div className="team-hub__namerow">
              <h1>{team.name}</h1>
              {isMilb && (
                <span className="team-hub__level">{SPORT_LABEL[team.sport?.id] ?? DASH}</span>
              )}
            </div>
            {record && (
              <p className="team-hub__rec">
                <span className="mono">{record.wins}–{record.losses}</span>
                {record.rank && record.div && (
                  <span className="team-hub__div">{ordinal(record.rank)} · {record.div}</span>
                )}
                {asOf && <em>· entering {humanDate(asOf)}</em>}
              </p>
            )}
            {manager && (
              <p className="team-hub__manager">
                Manager: <ManagerLink id={manager.personId}>{manager.name}</ManagerLink>
                {manager.interim && <span className="team-hub__manager-interim"> (interim)</span>}
              </p>
            )}
          </div>
          {/* The header's right-hand slot is an action CLUSTER rather than one
              control: the Affiliate chip on a MiLB club, the Game Notes link on
              an MLB one, and — for the site owner only — the identity gear,
              last. */}
          <div className="team-hub__actions">
            {isMilb && team.parentOrgId && (
              <TeamLink
                id={team.parentOrgId}
                className="team-hub__parent"
                ariaLabel={`Affiliate of ${team.parentOrgName ?? 'its MLB club'}`}
              >
                <span className="team-hub__parent-label">Affiliate</span>
                <TeamLogo teamId={team.parentOrgId} name={team.parentOrgName} size={34} />
              </TeamLink>
            )}
            {!isMilb && <GameNotesLink teamId={team.id} />}
            {isClerkEnabled && (
              <Suspense fallback={null}>
                <IdentityAdminBar teamId={team.id} isMilb={isMilb} draft={identity} />
              </Suspense>
            )}
          </div>
        </header>

        {/* Below the header, never over it — the header is themed from the data
            being edited, so it has to stay visible while the drawer is open. */}
        {identity.editing && (
          <Suspense fallback={null}>
            <IdentityDrawer
              teamId={team.id}
              isMilb={isMilb}
              name={team.name}
              abbreviation={team.abbreviation}
              venueName={team.venue?.name}
              draft={identity}
            />
          </Suspense>
        )}

        {/* Same finger-scrollable club-logo strip GameSelect's slate header uses
            to jump between teams — nothing here is ever "selected"
            (selectedTeamId null, nav styling), tapping a logo jumps straight to
            that club's team page, and centerTeamId lands on the club currently
            being viewed. */}
        {levelTeams.data?.length > 0 && (
          <TeamFilterStrip
            teams={levelTeams.data}
            selectedTeamId={null}
            onSelect={(navId) => navigate(teamPath(navId, { d: asOf, s: sportId }))}
            showMlbPin={false}
            showArrows
            centerTeamId={team.id}
            ariaLabel={`Browse ${SPORT_LABEL[team.sport?.id] ?? ''} teams`}
            className="teamfilterstrip--nav"
          />
        )}

        <TeamTabBar
          teamId={team.id}
          active={active}
          asOf={asOf}
          sportId={sportId}
          hidden={hiddenTabs}
        />

        {children}

        {/* `datable` is false for a tab whose data does not move with the
            cutoff. The Contracts tab is the one: a contract ledger is a
            SEASON's book, not a day's, so loadContracts.js is deliberately not
            keyed on `asOf` — and a banner reading "Stats entering July 15" over
            today's figures would be asserting something about the page that is
            not true of it. On a live visit the banner's other face is just as
            wrong: "View as of a date" invites the reader to date a page that
            will not date. Dating the ledger for real would need Cot's contract
            HISTORY, which the feed does not carry. */}
        {datable && <AsOfBanner asOf={asOf} sportId={sportId} />}
      </div>
    </LinkScope>
  )
}
