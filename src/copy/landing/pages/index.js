// The landing pages, in the order they appear at /learn.
//
// Order is editorial, not alphabetical: the pillar first, then the two
// references a scorer reaches for, then the pages that serve a particular way of
// following a game. The hub renders them in this order and the sitemap follows
// it, so a crawler meets the most important page first.
//
// ADDING A PAGE: write the module, import it here, and add it to the array.
// Everything else — the copy-registry fields, the admin editor, the sitemap
// entry, the hub listing, the invariant tests — derives from this list. There is
// deliberately no second place to register a page.
//
// REMOVING OR RENAMING A SLUG is a different matter and is not free. A slug is
// half of every copy-slot id for that page, so renaming one abandons every
// override written against it and silently reverts the page to shipped defaults.
// It is also a live URL that other sites and assistants may already cite.
// Rename only with a redirect, and expect to re-enter the copy.

import ballparkPassports from './ballparkPassports.js'
import chooseAScorebook from './chooseAScorebook.js'
import missedPlayScorekeeping from './missedPlayScorekeeping.js'
import penOrPencil from './penOrPencil.js'
import readABoxScore from './readABoxScore.js'
import scoreABaseballGame from './scoreABaseballGame.js'
import scoreAtTheBallpark from './scoreAtTheBallpark.js'
import scoreSubstitutions from './scoreSubstitutions.js'
import scorekeepingSymbols from './scorekeepingSymbols.js'
import statsGlossary from './statsGlossary.js'
import watchWithoutSpoilers from './watchWithoutSpoilers.js'

export const LANDING_PAGES = Object.freeze([
  scoreABaseballGame,
  scorekeepingSymbols,
  scoreSubstitutions,
  missedPlayScorekeeping,
  chooseAScorebook,
  penOrPencil,
  scoreAtTheBallpark,
  watchWithoutSpoilers,
  ballparkPassports,
  readABoxScore,
  statsGlossary,
])

const BY_SLUG = new Map(LANDING_PAGES.map((page) => [page.slug, page]))

export function pageBySlug(slug) {
  return BY_SLUG.get(slug) || null
}
