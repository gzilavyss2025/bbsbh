import { lazy, Suspense, useMemo, useState } from 'react'
import { fetchStaticTeams } from '../../api/teams-static.js'
import { ClubSeal } from '../../components/profile/ClubSeal.jsx'
import { ScopeBadge } from '../../components/profile/ScopeBadge.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { useSyncStatusState } from '../../components/sync/SyncStatusProvider.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { usePreferences } from '../../hooks/preferences/usePreferences.js'
import { useRecentSearches } from '../../hooks/useRecentSearches.js'
import { useScoresUnlocked } from '../../hooks/useScoresUnlocked.js'
import { useStamps } from '../../hooks/useStamps.js'
import { countGamesInProgress } from '../../lib/account/localData.js'
import { browserStorage } from '../../lib/account/preferencesStorage.js'
import { normalizeSilentChannels } from '../../lib/account/syncStatus.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { formatResetTime } from '../../lib/scoresUnlocked.js'
import { allStamps } from '../../lib/stamps.js'
import { SPORT_IDS } from '../../lib/teams.js'
import { ClubSection } from './sections/ClubSection.jsx'
import { DataSection } from './sections/DataSection.jsx'
import { DeviceSection } from './sections/DeviceSection.jsx'
import { LedgerSection } from './sections/LedgerSection.jsx'

// ===========================================================================
// MY TALLY — /profile
// ===========================================================================
// The page that reports on YOU rather than on baseball: which club you follow,
// how this device behaves, what an account carries between your devices, and
// what you have consented to see.
//
//   >>> /profile renders no game data at all. <<<
//
// That is the rule the whole design rests on, and it is what makes this the one
// screen in the app that does not have to argue about seals, reveal marks or
// containment guards. It never loads a feed, never resolves a game fact, never
// imports a stamp component, and never prints a number that came out of a
// ballpark. Counts of your own things are the only numbers here. Keep it that
// way and the page stays cheap to reason about forever; break it once and it
// joins the list of surfaces that need a guard.
//
// Two mechanical consequences worth knowing before editing:
//   * `src/screens/profile/` and `src/components/profile/` are on
//     scripts/check-stamp-surfaces.mjs's forbidden list. No stamp ART may be
//     imported here. Counting your own collection is fine — a count is not a
//     score — and that is the only reason `useStamps` is allowed.
//   * The club list comes from `fetchStaticTeams()` (the same-origin
//     public/data/teams.json), NOT from the schedule module. This page issues
//     no request to statsapi at all, which is both cheaper and the thing an
//     invariant spec can actually assert.
//
// This component is Clerk-free at its top level. Everything that touches
// @clerk/clerk-react lives in ProfileAccount.jsx, dynamically imported and only
// when the deploy configures an account — the established pattern
// (AccountPitch, LogbookAccountGate, the four cloud-sync components). The page
// is NOT gated on being signed in: settings are settings, and every one of them
// works with no account at all.
const ProfileAccount = isClerkEnabled
  ? lazy(() =>
      import('../../components/profile/ProfileAccount.jsx').then((m) => ({
        default: m.ProfileAccount,
      })),
    )
  : null

// The status is normalized before it is read. `RevealCloudSync` mounts inside
// InningViewer, not app-wide, so on this page the `reveal` channel has never
// spoken — and `rollupSync` (worst channel wins) would read that silence as
// "This device." for a signed-in user whose sync is fine. `normalizeSilentChannels`
// is the shared fix; read its header in src/lib/account/syncStatus.js before
// touching the receipt, and use it anywhere else that reads the store.

export function ProfilePage() {
  useDocumentTitle('My Tally')

  const { club, level, keepAwake, motion, set } = usePreferences()
  const { stamps } = useStamps()
  const { spoiledDays, passActive, resetAt, disable } = useScoresUnlocked()
  const { recent, clear: clearRecent } = useRecentSearches()
  const rawStatus = useSyncStatusState()

  // The club list, from the same-origin static file — never statsapi. See the
  // header: this page issues no feed request of any kind.
  const clubs = useAsync(fetchStaticTeams, [])
  const teams = useMemo(
    () => clubs.data?.bySportId?.[String(SPORT_IDS.MLB)] ?? [],
    [clubs.data],
  )
  const clubName = useMemo(
    () => teams.find((team) => team.id === club)?.name ?? '',
    [teams, club],
  )

  const status = useMemo(() => normalizeSilentChannels(rawStatus), [rawStatus])
  const accountPhase = status.prefs.phase

  // Read once, at mount. This counts reveal KEY NAMES and never their values —
  // "how many games you have open" is a fact about you, and no half-index, let
  // alone a score, is read to produce it.
  const [gameCount] = useState(() => countGamesInProgress(browserStorage()))
  const stampCount = useMemo(() => allStamps(stamps).length, [stamps])
  const counts = useMemo(
    () => ({ stamps: stampCount, games: gameCount, days: spoiledDays.length }),
    [stampCount, gameCount, spoiledDays.length],
  )

  return (
    <div className="screen mytally">
      <SiteHeader />
      <main>
        <header className="mytally__masthead">
          <ClubSeal teamId={club} name={clubName} size={92} />
          <div className="mytally__identity">
            <h1 className="mytally__title">My Tally</h1>
            <p className="mytally__subtitle">Profile &amp; settings.</p>
            {/* Held at a fixed height whether or not the club list has landed,
                so the page never jumps as it resolves. */}
            <p className="mytally__club">{clubName || ' '}</p>
            <ScopeBadge phase={accountPhase} />
          </div>
        </header>

        <ClubSection
          teams={teams}
          club={club}
          level={level}
          onPickClub={(id) => set('club', id)}
          onPickLevel={(sportId) => set('level', sportId)}
        />

        <DeviceSection
          keepAwake={keepAwake}
          onKeepAwake={(value) => set('keepAwake', value)}
          motion={motion}
          onMotion={(value) => set('motion', value)}
          passActive={passActive}
          passResetLabel={formatResetTime(resetAt)}
          onReseal={disable}
          spoiledDayCount={spoiledDays.length}
        />

        <LedgerSection
          stampCount={stampCount}
          gameCount={gameCount}
          spoiledDayCount={spoiledDays.length}
        />

        <DataSection
          status={status}
          accountPhase={accountPhase}
          stamps={stamps}
          stampCount={stampCount}
          recentCount={recent.length}
          onClearRecent={clearRecent}
          accountEraseAvailable={accountPhase === 'synced' || accountPhase === 'pulling'}
        />

        {ProfileAccount && (
          // No fallback markup: the section renders its own held-height frame
          // while Clerk loads, so the page has one shape from first paint.
          <Suspense fallback={null}>
            <ProfileAccount status={status} counts={counts} clubName={clubName} />
          </Suspense>
        )}
      </main>
      <ReportFooter />
    </div>
  )
}
