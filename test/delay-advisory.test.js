// WHICH DELAY ADVISORIES EARN A CARD, and what the card says.
//
// The feed's in-game stoppages ("Injury Delay.", "On-field Delay.", the
// weather "Status Change - Delayed…" lines) all arrive as `game_advisory`
// playEvents, and most of them say nothing. Two independent sweeps — 41 Final
// MLB games (2026-08-16..18) and 53 more (2026-08-12..15) — carried 48 and 53
// of them, and 81% / 85% were a sub-minute stoppage with no substitution after
// it and nothing else to report.
//
// Worse than empty, they MISLEAD. The card lands beside whichever plate
// appearance the stoppage interrupted, and the advisory's own `player` field
// names the man in the batter's box rather than the subject:
//   gamePk 824319, bottom 7 — "Injury Delay." names the BATTER, Jake McCarthy,
//     when the injured man is the catcher Hunter Feduccia, replaced one event
//     later.
//   gamePk 823670, top 8 — names the batter, Alec Bohm, when the man who left
//     is the left fielder Austin Martin.
//   gamePk 824398, top 5 — names the batter, Christian Koss, when the man who
//     left is the home plate UMPIRE.
//
// So: a delay is carded only when it can say something — it names what became
// of somebody, or it reports a stoppage long enough to be worth a mark on its
// own — and the man it names is the one who LEFT. ADR-0060.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { delayHeadline } from '../src/api/playbyplay/notificationCards.js'

// Rewrite top 1's second plate appearance (batter #2) around one delay: a
// called strike, the advisory, whatever the delay produced, then the pitch that
// ends it. `player: { id: 2 }` on the advisory is the batter, exactly as the
// feed writes it — every assertion about who the note is ABOUT has to survive
// that being the wrong man.
function feedWithDelay(advisory, ...after) {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.matchup.batter.id === 2,
  )
  play.playEvents = [
    { isPitch: true, pitchNumber: 1, details: { call: { code: 'C' } } },
    { player: { id: 2 }, ...advisory, details: { eventType: 'game_advisory', ...advisory.details } },
    ...after,
    { isPitch: true, pitchNumber: 2, details: { call: { code: 'X' } } },
  ]
  return feed
}

const delayNote = (feed) =>
  computeHalfInningFeed(feed, 1, 'top', 'away').find((e) => e.eventType === 'game_advisory')

// The three substitutions the feed writes, in the shapes it writes them. Note
// which ones carry `replacedPlayer`: an offensive or defensive substitution
// always does (3 of 3 in the sweep), a pitching change never does (0 of 5) —
// its departing arm is named only in the prose.
const defensiveSub = {
  details: {
    eventType: 'defensive_substitution',
    description: 'Defensive Substitution: Tom Toro replaces left fielder Oli Ott.',
  },
  position: { abbreviation: 'LF' },
  player: { id: 20 },
  replacedPlayer: { id: 15 },
}
const pinchHitter = {
  details: {
    eventType: 'offensive_substitution',
    description: 'Offensive Substitution: Pinch-hitter Jim Judge replaces Dan Diaz.',
  },
  position: { abbreviation: 'PH' },
  player: { id: 10 },
  replacedPlayer: { id: 4 },
}
const pitchingChange = {
  details: {
    eventType: 'pitching_substitution',
    description: 'Pitching Change: Rob Reliever replaces Hank Starter.',
  },
  position: { abbreviation: 'P' },
  player: { id: 201 },
}

// --- dropped: the four in five that say nothing -----------------------------

test('an injury delay that came to nothing never reaches the feed', () => {
  assert.equal(delayNote(feedWithDelay({ details: { description: 'Injury Delay.' } })), undefined)
})

test('an on-field delay that came to nothing never reaches the feed', () => {
  assert.equal(delayNote(feedWithDelay({ details: { description: 'On-field Delay.' } })), undefined)
})

test('a brief stoppage is dropped even though the feed brackets it with times', () => {
  // 2 minutes — the shape 34 of the 39 measurable stoppages in the first sweep
  // had. A card reading "play stopped for 2 min" is noise dressed as detail.
  const note = delayNote(
    feedWithDelay({
      details: { description: 'On-field Delay.' },
      startTime: '2026-08-19T01:35:00.000Z',
      endTime: '2026-08-19T01:37:00.000Z',
    }),
  )
  assert.equal(note, undefined)
})

test('a substitution AFTER play resumed is not the delay’s doing', () => {
  // The window closes at the next pitch: play stopped, play restarted, and only
  // then did somebody change. Pinning this keeps the lookahead from reaching
  // across a resumed at-bat and claiming a change it had nothing to do with.
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.matchup.batter.id === 2,
  )
  play.playEvents = [
    { details: { eventType: 'game_advisory', description: 'Injury Delay.' }, player: { id: 2 } },
    { isPitch: true, pitchNumber: 1, details: { call: { code: 'C' } } },
    defensiveSub,
    { isPitch: true, pitchNumber: 2, details: { call: { code: 'X' } } },
  ]
  assert.equal(delayNote(feed), undefined)
  // …and the substitution itself is untouched by any of this.
  const entries = computeHalfInningFeed(feed, 1, 'top', 'away')
  assert.ok(entries.some((e) => e.eventType === 'defensive_substitution'))
})

test('a delay whose departing man cannot be resolved is dropped, not carded blank', () => {
  // The MiLB degrade (root CLAUDE.md): a thin feed names a substitute the
  // roster has never heard of, so there is no name to put on the card.
  const note = delayNote(
    feedWithDelay({ details: { description: 'Injury Delay.' } }, {
      details: {
        eventType: 'defensive_substitution',
        description: 'Defensive Substitution: A Stranger replaces left fielder Nobody Here.',
      },
      position: { abbreviation: 'LF' },
      player: { id: 9001 },
      replacedPlayer: { id: 9002 },
    }),
  )
  assert.equal(note, undefined)
})

test("the feed's lifecycle 'Status Change' advisories are still never carded", () => {
  for (const description of ['Status Change - Pre-Game', 'Status Change - Warmup', 'Status Change - In Progress']) {
    assert.equal(delayNote(feedWithDelay({ details: { description } }, defensiveSub)), undefined, description)
  }
})

// --- carded: the one in five that says something ----------------------------

test('a delay that took a fielder out names HIM, not the batter the feed names', () => {
  const note = delayNote(feedWithDelay({ details: { description: 'Injury Delay.' } }, defensiveSub))
  assert.ok(note, 'a delay that took a man out of the game must be carded')
  assert.equal(note.title, 'Injury delay')
  assert.equal(note.detail, 'Oli Ott leaves the game')
  // #15 is the man who left. #2 is the batter, which is what the advisory's own
  // `player` field says and what made these cards read as being about him.
  assert.equal(note.playerId, 15)
  assert.equal(note.subjectSide, 'pitching')
  assert.equal(note.minutes, null)
})

test('a delay that took a pinch-hitter’s predecessor out is carded to the batting side', () => {
  const note = delayNote(feedWithDelay({ details: { description: 'Injury Delay.' } }, pinchHitter))
  assert.ok(note)
  assert.equal(note.detail, 'Dan Diaz leaves the game')
  assert.equal(note.playerId, 4)
  assert.equal(note.subjectSide, 'batting')
})

test('a pitching change names the departing arm, which is only in the prose', () => {
  // `replacedPlayer` is absent on every pitching change the sweep saw, so the
  // man going out has to come off the description via the name index.
  const note = delayNote(feedWithDelay({ details: { description: 'Injury Delay.' } }, pitchingChange))
  assert.ok(note)
  assert.equal(note.playerId, 200, 'the departing pitcher, not the one coming in')
  assert.equal(note.detail, 'Hank Starter leaves the game')
  assert.equal(note.subjectSide, 'pitching')
})

test('an umpire change is carried by the delay card because nothing else carries it', () => {
  // `umpire_substitution` is not in STOPPAGE_EVENTS and gets no card of its
  // own, so without this a crew change mid-inning appears nowhere in the app.
  // gamePk 824398's top 5: the home plate umpire left, 11 minutes.
  const note = delayNote(
    feedWithDelay(
      {
        details: { description: 'On-field Delay.' },
        startTime: '2026-08-18T23:57:05.000Z',
        endTime: '2026-08-19T00:07:40.000Z',
      },
      { details: { eventType: 'umpire_substitution', description: 'Umpire Rob Drake moving to HP.' } },
    ),
  )
  assert.ok(note)
  assert.equal(note.detail, 'Umpire change')
  assert.equal(note.playerId, null, 'an umpire is not in gameData.players; no headshot to hang')
  assert.equal(note.subjectSide, null)
  assert.equal(note.minutes, 11)
})

test('a long stoppage is carded on its length alone, with nobody leaving', () => {
  // gamePk 824397's top 1: rain, 183 minutes, no substitution after it.
  const note = delayNote(
    feedWithDelay({
      details: { description: 'Status Change - Delayed Start: Rain' },
      startTime: '2026-08-18T22:00:00.000Z',
      endTime: '2026-08-19T01:03:00.000Z',
    }),
  )
  assert.ok(note)
  assert.equal(note.title, 'Rain delay')
  assert.equal(note.detail, '')
  assert.equal(note.minutes, 183)
})

test('a long stoppage that also changed the pitcher reports both', () => {
  // gamePk 823344's top 7: 152 minutes of rain, and the starter does not come
  // back out for the resumption.
  const note = delayNote(
    feedWithDelay(
      {
        details: { description: 'Status Change - Delayed: Rain' },
        startTime: '2026-08-19T00:00:00.000Z',
        endTime: '2026-08-19T02:32:00.000Z',
      },
      { details: { eventType: 'game_advisory', description: 'Status Change - In Progress' } },
      pitchingChange,
    ),
  )
  assert.ok(note, 'the lifecycle advisory in between must not break the lookahead')
  assert.equal(note.detail, 'Hank Starter leaves the game')
  assert.equal(note.minutes, 152)
})

// --- wording ---------------------------------------------------------------

test('delayHeadline turns the four shapes the feed writes into readable ones', () => {
  assert.equal(delayHeadline('Injury Delay.'), 'Injury delay')
  assert.equal(delayHeadline('On-field Delay.'), 'On-field delay')
  assert.equal(delayHeadline('Status Change - Delayed: Rain'), 'Rain delay')
  assert.equal(
    delayHeadline('Status Change - Delayed Start: Inclement Weather'),
    'Inclement weather delay',
  )
  // Anything else passes through with only the word "Delay" lowercased — a
  // description that names a person has to keep his capitals.
  assert.equal(delayHeadline('Coaching visit to mound.'), 'Coaching visit to mound')
  assert.equal(delayHeadline(''), '')
})
