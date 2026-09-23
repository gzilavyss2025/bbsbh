// The pages the screenshot suite covers (issue #1177), and how each one is shot.
//
// WHY THESE PAGES. The issue asks for /design-lab plus about ten routes that
// carry the most shared parts, picked from the card and pill census
// (.scratch/design-system/inventory.md and pill-collapse/map.md). Where it fit,
// the list also covers every page that #1131's slices 3 to 5 change:
//   - the player page's contract card (`.contractcard__regime`, slice 3);
//   - the slate's result filter chips (`.slate-filterbar__chip`, slice 4);
//   - the themed team hub whose Standings card shows "Postseason odds"
//     (`.psodds-pill`, slice 5), and /situational-records (`.trrank__*`, 4 + 5).
//
// THE SPOILER RULE. Every shot is of a SEALED page. The baselines are committed
// images, and a committed image must never hold a score from a sealed surface.
// The game pages (lineup, innings, box score) are shot with nothing revealed.
// The one shot that needs a revealed state, the filter chips, is an ELEMENT
// shot of the chip bar alone: the chips are storyline labels, and the cards
// that hold the scores are not in the image. The team hub, player pages,
// standings and reports are outside the spoiler scope (CLAUDE.md, ADR-0034).
//
// THE DATE. The pinned anchor game (docs/test-games.md: 823035, MIL@STL game 2,
// 2026-07-07) supplies the game pages. The frozen clock below is the moment the
// HARs were recorded, so a page that reads "today" reads the same day each run.

import { expect } from '../fixtures.js'

// 2026-09-23, 11:00 in Chicago (the config's timezone). Re-record the HARs if
// you move it: a page asks statsapi for dates computed from this clock.
export const FROZEN_NOW = '2026-09-23T11:00:00-05:00'

const ANCHOR = '/07072026/milstl-2'

// Parts of a page that move on their own, painted over in every shot: the
// loading ball and the cold-load loader, whose linescore cycles its digits on a
// timer (the design lab draws one as a specimen), and highlight-clip posters (a
// clip's poster frame is chosen by MLB and can change under the same URL).
export const MASKS = ['.skel__ball', '.loader__scoreboard', '.hlclip__poster', 'video']

// Each route: `name` (the baseline file name), `path`, and `shots`. A shot with
// no `selector` is the full page; with one, it is that element alone. `ready` is
// a selector the page draws once its data has arrived. `prepare` runs after the
// page settles and before the shots. `offShot` names requests that only feed
// parts of the page no shot shows, so the HAR not holding one is not a failure.
export const ROUTES = [
  {
    // The catalog, in its four bands plus the page head. Split because the
    // whole page is ~43,000px tall at 390px, and one band per image gives a
    // readable diff.
    name: 'design-lab',
    path: '/design-lab',
    ready: '#pills',
    shots: [
      { name: 'head', selector: '.dlab__verdictbox' },
      { name: 'tokens', selector: '#tokens' },
      { name: 'components', selector: '#components' },
      { name: 'cards', selector: '#cards' },
      { name: 'pills', selector: '#pills' },
    ],
  },
  {
    // The anchor date's slate, every card sealed.
    name: 'slate',
    path: '/07072026',
    ready: '.gamecard',
    shots: [{ name: 'page' }],
  },
  {
    // The result filter chips exist only after "Reveal all results" (they are
    // gated on the revealed day, GameSelect.jsx ResultFilterBar). So this is
    // the chip bar ALONE — the flipped cards with their scores are never in
    // the image.
    name: 'slate-chips',
    path: '/07072026',
    ready: '.daystate__chip--reveal',
    // Retried: under load the slate can re-render between the click and the
    // reveal, and the click is then lost.
    prepare: async (page) => {
      const reveal = page.locator('.daystate__chip--reveal')
      const bar = page.locator('.slate-filterbar')
      await expect(async () => {
        if (await reveal.isVisible()) await reveal.click()
        await expect(bar).toBeVisible({ timeout: 5_000 })
      }).toPass({ timeout: 60_000 })
    },
    shots: [{ name: 'bar', selector: '.slate-filterbar' }],
    // The flipped cards' photos. They are outside the shot, and whether a face
    // asks for one depends on a race between two fetches (BoxScoreSkeleton.jsx
    // describes it), so the HAR cannot promise to hold them. Not holding one is
    // not a failure here.
    offShot: /^https:\/\/img\.mlbstatic\.com\//,
  },
  { name: 'lineup', path: `${ANCHOR}/lineup1`, ready: '.lineup', shots: [{ name: 'page' }] },
  { name: 'innings', path: `${ANCHOR}/top1`, ready: '.pagenav--innings', shots: [{ name: 'page' }] },
  { name: 'boxscore', path: `${ANCHOR}/boxscore`, ready: '.sealbox:visible', shots: [{ name: 'page' }] },
  {
    // Overview: the club band and the Standings card with "Postseason odds".
    name: 'team-overview',
    path: '/team/milwaukee-brewers-158',
    ready: '.psodds-pill',
    shots: [{ name: 'page' }],
  },
  {
    name: 'team-numbers',
    path: '/team/milwaukee-brewers-158/numbers',
    ready: '.thub-card',
    shots: [{ name: 'page' }],
  },
  {
    // A hitter, with the contract card.
    name: 'player-hitter',
    path: '/player/christian-yelich-592885',
    ready: '.contractcard',
    shots: [{ name: 'page' }],
  },
  {
    name: 'player-pitcher',
    path: '/player/freddy-peralta-642547',
    ready: '.contractcard',
    shots: [{ name: 'page' }],
  },
  { name: 'salaries', path: '/salaries', shots: [{ name: 'page' }] },
  { name: 'standings', path: '/standings', shots: [{ name: 'page' }] },
  {
    // The report page: the postseason race, whose `.seedcard` is one of the
    // tight-sheet cards #1113 merges.
    name: 'postseason-race',
    path: '/postseason-race',
    shots: [{ name: 'page' }],
  },
  { name: 'situational-records', path: '/situational-records', shots: [{ name: 'page' }] },
]
