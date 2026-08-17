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

// The hub is a task map, not a flat archive. Each guide has one primary job and
// appears in one group. LANDING_PAGES stays the flat source for the registry,
// sitemap, and slug lookup, derived here so those consumers cannot drift from
// the visible information architecture.
export const LANDING_GROUPS = Object.freeze([
  {
    id: 'start',
    heading: 'Start keeping score',
    description: 'Learn the grid, the common notation and its variations, and how to stay with the game when it gets complicated.',
    pages: [scoreABaseballGame, scorekeepingSymbols, scoreSubstitutions, missedPlayScorekeeping],
  },
  {
    id: 'tools',
    heading: 'Choose your paper setup',
    description: 'Pick a scorebook and writing tool that fit the detail you want to keep.',
    pages: [chooseAScorebook, penOrPencil],
  },
  {
    id: 'ballpark',
    heading: 'Take the book to the ballpark',
    description: 'Score from the stands and keep a record of the parks and games you saw.',
    pages: [scoreAtTheBallpark, ballparkPassports],
  },
  {
    id: 'read',
    heading: 'Read and follow the game',
    description: 'Read a line score and box score, put statistics in context, or follow a game without seeing ahead.',
    pages: [readABoxScore, statsGlossary, watchWithoutSpoilers],
  },
])

export const LANDING_PAGES = Object.freeze(LANDING_GROUPS.flatMap((group) => group.pages))

const BY_SLUG = new Map(LANDING_PAGES.map((page) => [page.slug, page]))

export function pageBySlug(slug) {
  return BY_SLUG.get(slug) || null
}
