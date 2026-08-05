import { BUILD_COMMIT_SHORT, BUILD_COMMIT_URL } from '../../lib/buildInfo.js'

// The "· build 1234567" suffix on a footer's © line, linked to the commit on
// GitHub — lets you confirm you're looking at the version you just merged
// rather than a stale tab/cache. Shared by SiteFooter (the slate) and
// ReportFooter (every standalone report page), so both footers' legal blocks
// stay in sync without a second copy of this markup. Renders nothing when
// the commit couldn't be resolved at build time (see buildInfo.js).
export function BuildStamp() {
  if (!BUILD_COMMIT_SHORT) return null
  return (
    <>
      {' · '}
      {BUILD_COMMIT_URL ? (
        <a
          className="sitefooter__build-link"
          href={BUILD_COMMIT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          build {BUILD_COMMIT_SHORT}
        </a>
      ) : (
        `build ${BUILD_COMMIT_SHORT}`
      )}
    </>
  )
}
