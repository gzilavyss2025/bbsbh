import { splitDisplayName } from '../../api/person.js'
import { leagueLogoUrl, isMlbTeamId } from '../../lib/teams.js'
import { headerThemeFor, headerThemeClass, headerThemeStyle, themeKeyFor } from '../../lib/headerTheme.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { LinkScope } from '../../lib/nav.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsOfBanner } from '../../components/seal/AsOfBanner.jsx'
import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { PlayerTabBar } from './PlayerTabBar.jsx'
import { monthDay } from './parts.jsx'

const TAB_TITLE = {
  overview: null,
  stats: 'Stats',
  analytics: 'Analytics',
  history: 'History',
}

// The chrome every player-hub tab renders inside: site bar, the four status
// banners, back button, the hero, the tab bar, and — under the tab's own body —
// the as-of caveat and the date control. `children` is the tab's body.
//
// It owns nothing a tab needs to know about, which is the point — a tab is then
// just "load my data, render it inside the shell", and the four tabs stay
// independent of each other. Its own data comes from api/player/core.js, which
// is deliberately cheap, because every tab pays for it. Same shape, same
// reasoning, as the team hub's TeamHubShell (ADR-0034).
//
// `asOf` / `sportId` are the route's own query hints, threaded to PlayerTabBar so
// a tab switch reproduces the address the visitor arrived on.
export function PlayerHubShell({ core, asOf = null, sportId = null, active, children }) {
  const { bio } = core
  const tabTitle = TAB_TITLE[active] ?? null
  useDocumentTitle(bio.fullName ? [bio.fullName, tabTitle].filter(Boolean).join(' · ') : null)

  const back = () => window.history.back()

  // A free agent / retired / released player (see api/person.js's
  // rosterStatusView). `bio.team` is still populated for him — the API points a
  // player with no club at the last one he had — so everything club-shaped on
  // this hero reads through `club` instead, which goes null the moment he is on
  // nobody's roster. He gets the league mark and the status word in place of a
  // club he isn't on.
  const status = core.rosterStatus
  const club = status ? null : bio.team
  // Not tied to any one game, so the player page always wears the club's
  // Main/Home triad — the same identity-only theme TeamHubShell resolves for
  // its own hub header. Null (no curated triad for this club, or no club at
  // all) leaves the page on the app's default navy chrome, same fallback
  // headerTheme.js guarantees everywhere else.
  const theme = headerThemeFor(club?.id, themeKeyFor(club?.id, 'home', 'main'))
  const pitchRole = core.heroRole ?? ''
  const heroPos = bio.twoWay ? 'DH/P' : (bio.isPitcher && pitchRole) || bio.posAbbr || ''
  const hand = bio.isPitcher && !bio.twoWay
    ? bio.throws ? `Throws ${bio.throws}` : ''
    : [bio.bats && `Bats ${bio.bats}`, bio.throws && `Throws ${bio.throws}`].filter(Boolean).join(' / ')
  const { first: firstName, last: lastName } = splitDisplayName(bio.fullName)
  // What actually has to fit on the hero's one line is surname + jersey
  // number ("Contreras" alone fits; "Contreras #24" doesn't), so the
  // long-name step-down keys on their combined length — see
  // .player__name-last--long. Eleven units is where the base size starts
  // ellipsizing at phone width.
  const nameUnits = lastName.length + (bio.number ? String(bio.number).length + 1 : 0)

  return (
    <LinkScope asOf={asOf} sportId={core.sportId ?? sportId ?? null}>
      <div className={`screen player ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
        <SiteHeader />
        {core.isAllStar && (
          <div className="allstar-banner" role="note">
            <span className="allstar-banner__star" aria-hidden="true">★</span>
            <span className="allstar-banner__text">{core.currentYear} All-Star</span>
            <span className="allstar-banner__star" aria-hidden="true">★</span>
          </div>
        )}
        {/* startingToday: he's announced as TODAY's probable starter for the
            club that has him on rehab/the IL — MLB posts that days before it
            files the activation transaction the banners are otherwise keyed
            on, so showing "Rehab Assignment"/"Injured List" the day he's
            about to take the mound would be stale on its face. See
            api/player/core.js. */}
        {core.onRehab && !core.startingToday && (
          <div className="rehab-banner" role="note">
            <span className="rehab-banner__mark" aria-hidden="true">✚</span>
            <span className="rehab-banner__text">
              Rehab Assignment{core.rehab?.name ? ` · ${core.rehab.name}` : ''}
            </span>
          </div>
        )}
        {core.onIL && !core.startingToday && (
          <div className="il-banner" role="note">
            <span className="il-banner__mark" aria-hidden="true">✚</span>
            <span className="il-banner__text">
              Injured List{core.il?.days ? ` · ${core.il.days}-Day` : ''}
            </span>
          </div>
        )}
        {core.lastPlayedYear && (
          <div className="lastplayed-banner" role="note">
            <span className="lastplayed-banner__text">Last played in {core.lastPlayedYear}</span>
          </div>
        )}
        <BackBtn onClick={back} />

        <header className="player__hero">
          {/* No club, no club-colored wash behind the face — and `isMlb` is
              passed explicitly because it normally derives from the teamId
              that just went null, and a debuted player must keep skipping the
              stale `milb` prospect-photo rung (see Headshot). */}
          <Headshot
            personId={bio.id}
            name={bio.fullName}
            teamId={club?.parentOrgId ?? club?.id}
            isMlb={isMlbTeamId(club?.id) || Boolean(status && bio.debut)}
          />
          <div className="player__ident">
            <h1 className="player__name">
              {firstName && <span className="player__name-first">{firstName}</span>}
              {/* A long surname-plus-number would ellipsize at phone width —
                  step the display size down instead of truncating the man's
                  own name on his own page. */}
              <span className={`player__name-last${nameUnits >= 11 ? ' player__name-last--long' : ''}`}>
                {lastName}
                {bio.number && <span className="player__num">#{bio.number}</span>}
              </span>
            </h1>
            {/* Two lines, not one run-on list. The old single line ran
                position · hand · club · pill through mid-dots and wrapped
                wherever it ran out of room, which stranded a separator at the
                end of line one ("SP · THROWS R ·") and dropped the club into
                the position of an afterthought. The club is the identity half
                of a player's card, so it gets its own line under the
                attributes — and the wrap can no longer split a dot from what
                it separates, because line one is the only line with dots. */}
            <p className="player__meta">
              {heroPos && <span className="player__pos">{heroPos}</span>}
              {hand && <> <span className="sep">·</span> <span className="player__hand">{hand}</span></>}
            </p>
            {(club || status || core.prospectRank || core.orgProspectRank) && (
              <p className="player__clubline">
                {club && (
                  <TeamLink id={club.id} className="player__team">{club.name}</TeamLink>
                )}
                {status && <span className="player__status">{status.label}</span>}
                {core.prospectRank && (
                  <span className="prospectpill">
                    <img src={leagueLogoUrl()} alt="" className="prospectpill__logo" />
                    #{core.prospectRank} PROSPECT
                  </span>
                )}
                {core.orgProspectRank && (
                  <span className="prospectpill">
                    <TeamLogo
                      teamId={club?.parentOrgId ?? club?.id}
                      name={club?.parentOrgName ?? club?.name}
                      size={12}
                    />
                    #{core.orgProspectRank} PROSPECT
                  </span>
                )}
              </p>
            )}
          </div>
          {club && (
            <TeamLink id={club.id} className="player__herologo" ariaLabel={club.name}>
              <TeamLogo teamId={club.id} name={club.name} size={56} />
              {club.parentOrgId && (
                <TeamLogo
                  teamId={club.parentOrgId}
                  name={club.parentOrgName}
                  variant="wordmark"
                  size={20}
                  className="player__herologo-affiliate"
                />
              )}
            </TeamLink>
          )}
          {/* The league mark stands in for the club crest — the slot has to hold
              something or the hero's third column collapses and the name jumps
              right, and MLB's own mark is the honest answer for a player who
              belongs to no club. Not a link: there's no club page to open. */}
          {status && (
            <span className="player__herologo player__herologo--league">
              <img src={leagueLogoUrl()} alt="" className="player__leaguemark" />
            </span>
          )}
        </header>

        <PlayerTabBar
          playerId={bio.id}
          name={bio.fullName}
          active={active}
          asOf={asOf}
          sportId={sportId}
        />

        {children}

        {/* The caveat and the date control ride EVERY tab, not just the one that
            happens to show tiles: `?d=` dates the whole hub, so a reader who
            switched tabs must still be told what the page is frozen to and still
            have the way back to live (ADR-0034's "The gap gets a way in"). */}
        {asOf && (
          <p className="hint hint--prose player__caveat">
            Season tiles, game log and past-year rows are frozen to “entering {monthDay(asOf)}.”
            The current-year row, the splits and the Advanced rates are full-season figures.
          </p>
        )}

        <AsOfBanner asOf={asOf} sportId={sportId} />
      </div>
    </LinkScope>
  )
}
