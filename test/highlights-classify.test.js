// Coverage for the highlights CASCADE's pure classification layer
// (src/api/highlights.js): the keywordsAll extraction, the eligibility gate
// that decides what counts as a per-play action highlight, and the poster
// resolver. This is the filter policy the generator writes into
// public/data/highlights/{teamId}.json — the rails downstream do no filtering
// of their own, so a regression here ships straight to a team page.
//
// Every fixture below is shaped from a REAL live `content` item (gamePks
// 823035 / 824087 / the 2026-07-28..30 sweep) — see the module header.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NON_PLAY_TAXONOMY,
  classifyHighlight,
  highlightPoster,
  isEligibleForPositiveFilter,
} from '../src/api/highlights.js'

const kw = ({ player, team, taxonomy = [] }) => [
  ...(player ? [{ type: 'player_id', value: String(player) }] : []),
  ...(team ? [{ type: 'team_id', value: String(team) }] : []),
  ...taxonomy.map((value) => ({ type: 'taxonomy', value })),
]

// A real per-play clip: "Joey Ortiz's solo home run (3)", gamePk 823035.
const homeRun = {
  guid: 'b56343f6-bf3c-3724-8282-84d89b1ed137',
  id: 'jared-shuster-in-play-run-s-to-joey-ortiz',
  keywordsAll: kw({
    player: 687401,
    team: 158,
    taxonomy: ['hitting', 'highlight', 'in-game-highlight', 'game-story-highlight', 'home-run', 'featured'],
  }),
}

// --------------------------------------------------------------------------
// classifyHighlight
// --------------------------------------------------------------------------
test('classifyHighlight pulls ids, category and significance off keywordsAll', () => {
  const c = classifyHighlight(homeRun)
  assert.equal(c.playerId, 687401)
  assert.equal(c.teamId, 158)
  assert.equal(c.category, 'hitting')
  assert.equal(c.significance, 'featured')
  assert.equal(c.guid, 'b56343f6-bf3c-3724-8282-84d89b1ed137')
})

test('classifyHighlight coerces the id strings to numbers — keywordsAll values are strings', () => {
  const c = classifyHighlight(homeRun)
  assert.equal(typeof c.playerId, 'number')
  assert.equal(typeof c.teamId, 'number')
})

test('clipId prefers guid but falls back to the id slug — 54% of live items carry no guid', () => {
  assert.equal(classifyHighlight(homeRun).clipId, homeRun.guid)
  const noGuid = { id: 'reid-detmers-strikes-out-nine-vs-astros', keywordsAll: kw({ team: 108 }) }
  assert.equal(classifyHighlight(noGuid).clipId, 'reid-detmers-strikes-out-nine-vs-astros')
  assert.equal(classifyHighlight(noGuid).guid, null)
})

test('classifyHighlight resolves the highlight-reel FAMILY to the real tag, not the prefix', () => {
  // The live values are -offense/-pitching/-starting-pitching/-relief-pitching/
  // -team; the PRD's `highlight-reel-*` is a family, and shipping the bare
  // `highlight-reel-` marker as a clip's significance was a real bug.
  const reel = { guid: 'g', keywordsAll: kw({ team: 158, taxonomy: ['highlight', 'highlight-reel-offense'] }) }
  assert.equal(classifyHighlight(reel).significance, 'highlight-reel-offense')
})

test('classifyHighlight ranks significance by the priority list, not by taxonomy order', () => {
  const both = {
    guid: 'g',
    keywordsAll: kw({ team: 158, taxonomy: ['milestone', 'highlight', 'wow'] }),
  }
  assert.equal(classifyHighlight(both).significance, 'wow') // wow outranks milestone
})

test('classifyHighlight nulls every field it cannot find rather than guessing', () => {
  const bare = classifyHighlight({ keywordsAll: [] })
  assert.deepEqual(bare, {
    guid: null,
    clipId: null,
    playerId: null,
    teamId: null,
    category: null,
    significance: null,
    taxonomy: [],
  })
  assert.equal(classifyHighlight(null).teamId, null)
  assert.equal(classifyHighlight(undefined).significance, null)
})

// --------------------------------------------------------------------------
// isEligibleForPositiveFilter — the gate that keeps interviews and injury
// clips off a team's rail. Fixtures are real headlines from the live sweep.
// --------------------------------------------------------------------------
test('a per-play action clip passes the gate', () => {
  assert.equal(isEligibleForPositiveFilter(classifyHighlight(homeRun)), true)
})

test('a clip with no hitting/pitching/defense category still passes if it is tagged `highlight`', () => {
  // "Gavin Williams strikes out 12 against Reds" — MLB tags the category
  // inconsistently, so requiring one would drop real marquee clips.
  const noCategory = { guid: 'g', keywordsAll: kw({ player: 668909, team: 114, taxonomy: ['highlight', 'in-game-highlight'] }) }
  assert.equal(isEligibleForPositiveFilter(classifyHighlight(noCategory)), true)
})

test('abs/challenge clips are excluded — the team_id sign is unrecoverable for them', () => {
  for (const tag of ['abs', 'challenge']) {
    const clip = { guid: 'g', keywordsAll: kw({ team: 137, taxonomy: ['highlight', 'in-game-highlight', 'hitting', tag] }) }
    assert.equal(isEligibleForPositiveFilter(classifyHighlight(clip)), false, `${tag} should be excluded`)
  }
})

test('non-play content is excluded even when MLB tags it `highlight`', () => {
  // Each of these is a real item from the 3-day sweep that carried `highlight`.
  const cases = [
    ['interview', "Kyle Stowers discusses Sandy Alcantara's pitching"],
    ['injury', 'Jose Franco leaves game with right elbow discomfort'],
    ['cut-4', "Busch Stadium's hot dog promotion"],
    ['team-featured', 'Elly De La Cruz hosts underprivileged kids at game'],
    ['manager-postgame', "Terry Francona on Chase Burns, plan for Game 2"],
  ]
  for (const [tag, why] of cases) {
    const clip = { guid: 'g', keywordsAll: kw({ team: 113, taxonomy: ['highlight', 'in-game-highlight', tag] }) }
    assert.equal(isEligibleForPositiveFilter(classifyHighlight(clip)), false, `${tag} (${why}) should be excluded`)
  }
})

test('an item with no `highlight` tag is excluded — recaps, condensed games, Data Viz', () => {
  const recap = { keywordsAll: kw({ team: 158, taxonomy: ['game-recap'] }) }
  const dataViz = { keywordsAll: kw({ team: 118, taxonomy: ['data-visualization', 'analysis'] }) }
  assert.equal(isEligibleForPositiveFilter(classifyHighlight(recap)), false)
  assert.equal(isEligibleForPositiveFilter(classifyHighlight(dataViz)), false)
})

test('isEligibleForPositiveFilter degrades to false on a missing/empty classification', () => {
  assert.equal(isEligibleForPositiveFilter(null), false)
  assert.equal(isEligibleForPositiveFilter({}), false)
  assert.equal(isEligibleForPositiveFilter({ taxonomy: [] }), false)
})

test('the two PRD-locked exclusions are actually in the exclusion set', () => {
  // Guards against a future tidy-up quietly dropping the one rule the PRD
  // locked after finding real counterexamples.
  assert.ok(NON_PLAY_TAXONOMY.has('abs'))
  assert.ok(NON_PLAY_TAXONOMY.has('challenge'))
})

// --------------------------------------------------------------------------
// highlightPoster
// --------------------------------------------------------------------------
const cuts = (widths) =>
  widths.map((w) => ({ aspectRatio: '16:9', width: w, height: Math.round((w * 9) / 16), src: `s${w}.jpg` }))

test('highlightPoster picks the smallest 16:9 cut at or above the minimum width', () => {
  const item = { image: { cuts: cuts([1920, 1280, 960, 640, 480, 124]) } }
  assert.equal(highlightPoster(item), 's640.jpg')
  assert.equal(highlightPoster(item, 1000), 's1280.jpg')
})

test('highlightPoster falls back to the widest cut when none meets the minimum', () => {
  assert.equal(highlightPoster({ image: { cuts: cuts([480, 124]) } }), 's480.jpg')
})

test('highlightPoster ignores non-16:9 cuts and degrades to null with no image', () => {
  const mixed = { image: { cuts: [{ aspectRatio: '4:3', width: 1200, src: 'square.jpg' }] } }
  assert.equal(highlightPoster(mixed), null)
  assert.equal(highlightPoster({}), null)
  assert.equal(highlightPoster(null), null)
})
