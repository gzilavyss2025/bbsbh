// Rebuild src/lib/data/logo-art.json — the coverage manifest for the curated
// club marks under public/team-logos/ (PRD 4.3).
//
// The /__dev/team-logo upload endpoint rewrites this file itself after every
// successful drop, so in normal use this script never has to run. It exists for
// the two cases the endpoint can't cover: the first build of the manifest, and
// a file added or deleted by hand. test/logo-upload.test.js compares the
// committed manifest against what is actually on disk and fails when the two
// disagree, so "run this" is the fix that test points at.
//
// Unlike the other gen-* scripts this fetches nothing — the source of truth is
// the working tree. See scripts/CLAUDE.md.

import { LOGO_MANIFEST_FILE, writeLogoManifest } from './lib/dev-logo-upload.mjs'

const manifest = await writeLogoManifest()
const files = Object.values(manifest).reduce((n, dir) => n + Object.keys(dir).length, 0)
console.log(
  `gen-logo-art: wrote ${LOGO_MANIFEST_FILE} — ${files} files across ${Object.keys(manifest).length} treatment directories.`,
)
