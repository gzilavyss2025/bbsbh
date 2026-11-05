// The commit this build was made from. vite.config.js's buildCommitMeta puts
// it in index.html as <meta name="build-commit">, never in the JS, so a deploy
// that changes only data renames no chunk (#2873). Empty when the tag is
// missing (no DOM in the node test suite, or neither Vercel nor git could
// identify the commit): degrade rather than throw, same convention as MiLB.
const COMMIT =
  (typeof document !== 'undefined' &&
    document.querySelector('meta[name="build-commit"]')?.getAttribute('content')) ||
  ''

export const BUILD_COMMIT_SHORT = COMMIT.slice(0, 7)
export const BUILD_COMMIT_URL = COMMIT
  ? `https://github.com/gzilavyss2025/bbsbh/commit/${COMMIT}`
  : ''
