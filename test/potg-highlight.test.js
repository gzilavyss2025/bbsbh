// Coverage for the box score's Play of the Game "Watch" affordance
// (.scratch/highlights-cascade/issues/02-box-score-potg-watch.md): the
// `playId` computePlayOfTheGame now resolves for its picked play, and the gate
// that decides whether the matched clip may anchor the card.
//
// The playId join is the fragile half. It reads the win-prob entry's
// `about.atBatIndex` and cross-references the live feed's `allPlays` —
// deliberately NOT the win-prob entry's own `playEvents`, which WIN_PROB_FIELDS
// prunes out of the fetch (re-adding it measured +70% on the pruned payload).
// That means the join silently depends on a field the win-prob allowlist DOES
// carry and on feed shape the box-score path DOES have, and it must degrade to
// null — never throw, never guess — anywhere either is absent.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computePlayOfTheGame } from '../src/api/boxscore.js'
import { WIN_PROB_FIELDS } from '../src/api/game.js'
import { eligibleHighlightForPlay } from '../src/api/highlights.js'

// One /winProbability row, shaped like the real endpoint's (see winprob.test.js).
// `homeTeamWinProbabilityAdded` is the per-play DELTA the ranking sorts on.
const wpRow = ({ added, inning, isTopInning, atBatIndex, desc, captivatingIndex = 0, batter = 111 }) => ({
  homeTeamWinProbabilityAdded: added,
  about: { inning, isTopInning, atBatIndex, captivatingIndex },
  matchup: { batter: { id: batter } },
  result: { description: desc, awayScore: 1, homeScore: 4 },
})

// A feed carrying just the two things the join walks: allPlays keyed by
// atBatIndex, each with its pitch-by-pitch playEvents.
const feedWithPlays = (plays) => ({
  gameData: { players: {}, teams: {} },
  liveData: { boxscore: { teams: {} }, plays: { allPlays: plays } },
})

const play = (atBatIndex, events) => ({ about: { atBatIndex }, playEvents: events })

test('computePlayOfTheGame resolves the picked play’s terminal pitch playId', () => {
  // The bottom-8th swing is the biggest mover, so it's the picked play — and
  // its playId must be the LAST pitch of that at-bat, not the first.
  const winProb = [
    wpRow({ added: 2.1, inning: 1, isTopInning: true, atBatIndex: 0, desc: 'Flyout' }),
    wpRow({ added: 31.4, inning: 8, isTopInning: false, atBatIndex: 61, desc: 'Grand slam' }),
    wpRow({ added: 1.2, inning: 9, isTopInning: true, atBatIndex: 70, desc: 'Groundout' }),
  ]
  const feed = feedWithPlays([
    play(0, [{ isPitch: true, playId: 'first-play-pitch' }]),
    play(61, [
      { isPitch: true, playId: 'slam-pitch-1' },
      { isPitch: false, playId: 'a-stepoff-not-a-pitch' },
      { isPitch: true, playId: 'slam-terminal-pitch' },
    ]),
    play(70, [{ isPitch: true, playId: 'last-play-pitch' }]),
  ])
  const potg = computePlayOfTheGame(winProb, feed)
  assert.equal(potg.desc, 'Grand slam')
  assert.equal(potg.playId, 'slam-terminal-pitch')
})

test('playId is null, not a throw, when the feed can’t supply one', () => {
  const winProb = [wpRow({ added: 30, inning: 8, isTopInning: false, atBatIndex: 61, desc: 'Grand slam' })]

  // The past-game "signals" path prunes the feed through PAST_GAME_FEED_FIELDS,
  // which lists neither playEvents nor playId — the slate flip-card renders the
  // description with no Watch button, so a null here is correct, not a bug.
  const pruned = feedWithPlays([play(61, undefined)])
  assert.equal(computePlayOfTheGame(winProb, pruned).playId, null)

  // No matching play in the feed at all.
  const mismatched = feedWithPlays([play(999, [{ isPitch: true, playId: 'other' }])])
  assert.equal(computePlayOfTheGame(winProb, mismatched).playId, null)

  // A play whose events carry no pitch (a pure baserunning play).
  const noPitch = feedWithPlays([play(61, [{ isPitch: false, playId: 'pickoff-throw' }])])
  assert.equal(computePlayOfTheGame(winProb, noPitch).playId, null)

  // Untracked park: pitch events present, but no playId on them.
  const noId = feedWithPlays([play(61, [{ isPitch: true }])])
  assert.equal(computePlayOfTheGame(winProb, noId).playId, null)

  // No feed at all.
  assert.equal(computePlayOfTheGame(winProb, null).playId, null)
})

test('a win-prob entry with no atBatIndex can’t be joined and yields null', () => {
  // atBatIndex is the whole join key. If it ever falls out of WIN_PROB_FIELDS
  // the button silently disappears league-wide rather than misfiring — but the
  // allowlist guard below is what actually keeps that from happening.
  const winProb = [{
    homeTeamWinProbabilityAdded: 30,
    about: { inning: 8, isTopInning: false, captivatingIndex: 0 },
    matchup: { batter: { id: 111 } },
    result: { description: 'Grand slam', awayScore: 1, homeScore: 4 },
  }]
  const feed = feedWithPlays([play(0, [{ isPitch: true, playId: 'x' }])])
  assert.equal(computePlayOfTheGame(winProb, feed).playId, null)
})

test('WIN_PROB_FIELDS still carries the join key', () => {
  // Same class of regression guard as winprob.test.js's: a pruned-away field
  // arrives `undefined` and the feature dies quietly. `about.atBatIndex` needs
  // both names present, since `fields=` matches key names at any depth.
  assert.ok(WIN_PROB_FIELDS.includes('about'), 'about must survive the prune')
  assert.ok(WIN_PROB_FIELDS.includes('atBatIndex'), 'atBatIndex is the playId join key')
})

// --- the eligibility gate --------------------------------------------------

const clip = (guid, taxonomy) => ({
  guid,
  id: `slug-${guid}`,
  keywordsAll: [
    { type: 'player_id', value: '687401' },
    { type: 'team_id', value: '158' },
    ...taxonomy.map((value) => ({ type: 'taxonomy', value })),
  ],
})

test('eligibleHighlightForPlay matches a clip by guid and passes ordinary highlights', () => {
  const items = [clip('aaa', ['highlight', 'hitting']), clip('bbb', ['highlight', 'pitching'])]
  assert.equal(eligibleHighlightForPlay(items, 'bbb').guid, 'bbb')
})

test('a matched clip with NO significance tag is eligible', () => {
  // Decided 2026-08-06, then reversed the same day after measurement: requiring
  // one of SIGNIFICANCE_TAGS on top of the WPA pick suppressed the button on
  // 57% of sampled games (25 of 44) that had a real, correctly-matched clip.
  // The card's "best play" claim comes from this app's own WPA ranking, not
  // from MLB's tagging, so their tag is not a precondition. Pinned here because
  // it's a deliberate reversal that reads like an omission.
  const items = [clip('aaa', ['highlight', 'hitting'])]
  assert.ok(eligibleHighlightForPlay(items, 'aaa'))
})

test('an abs/challenge clip may not anchor the card', () => {
  // The PRD's locked exclusion: these are tagged by whose plate appearance it
  // was, not by who benefited, so the sign is unrecoverable. Unlike
  // PlayByPlay's per-play button, which shows ANY clip for a revealed play,
  // this card is claiming the play was the best one.
  assert.equal(eligibleHighlightForPlay([clip('aaa', ['highlight', 'abs'])], 'aaa'), null)
  assert.equal(eligibleHighlightForPlay([clip('bbb', ['highlight', 'challenge'])], 'bbb'), null)
})

test('non-play content matched to the play is excluded too', () => {
  assert.equal(eligibleHighlightForPlay([clip('aaa', ['highlight', 'interview'])], 'aaa'), null)
  assert.equal(eligibleHighlightForPlay([clip('bbb', ['highlight', 'injury'])], 'bbb'), null)
  // No `highlight` tag at all — the positive gate.
  assert.equal(eligibleHighlightForPlay([clip('ccc', ['hitting'])], 'ccc'), null)
})

test('eligibleHighlightForPlay degrades quietly on every absent input', () => {
  const items = [clip('aaa', ['highlight', 'hitting'])]
  assert.equal(eligibleHighlightForPlay(items, null), null, 'no playId resolved')
  assert.equal(eligibleHighlightForPlay(items, 'zzz'), null, 'no clip for this play')
  assert.equal(eligibleHighlightForPlay([], 'aaa'), null, 'off-MLB: no clips at all')
  assert.equal(eligibleHighlightForPlay(null, 'aaa'), null, 'highlights not fetched yet')
  // 54% of content items carry no guid (see classifyHighlight's header) — one
  // must never match a null playId by accident.
  assert.equal(eligibleHighlightForPlay([{ id: 'guidless', keywordsAll: [] }], null), null)
})
