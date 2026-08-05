// The commit this build was made from — see vite.config.js's
// resolveBuildCommit for how it lands in import.meta.env. Empty in an
// environment neither Vercel nor git could identify (never expected in
// practice, but degrade rather than throw, same convention as MiLB fields).
const COMMIT = import.meta.env.VITE_BUILD_COMMIT || ''

export const BUILD_COMMIT_SHORT = COMMIT.slice(0, 7)
export const BUILD_COMMIT_URL = COMMIT
  ? `https://github.com/gzilavyss2025/bbsbh/commit/${COMMIT}`
  : ''
