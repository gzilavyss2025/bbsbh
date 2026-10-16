// Slice 2 of the notification cards (ADR-0113): the tab names the event, the club is a logo,
// the code chips are gone. Source-text pins for the markup, plain asserts for the copy.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { headshotSources, coachHeadshotUrl } from '../src/lib/teams.js'
import { playerClubId, TABS, fielderTab, firstLast, forLine, delayTab, delaySentence, moundPips, ejectedClub } from '../src/components/playbyplay/cardCopy.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const code = (rel) => src(rel).replace(/^\s*\/\/.*$/gm, '')
const fmt = (m) => `${m} min`

test('tabs name the event and never the club', () => {
  assert.deepEqual(Object.values(TABS), [
    'Now batting', 'Now pitching', 'Pitching', 'Pinch running', 'Departing', 'Final line for', 'Mound visit', 'Ejection',
  ])
  assert.equal(fielderTab('third base'), 'Now playing third base')
  assert.equal(fielderTab(''), 'Now playing')
  for (const f of ['PitcherNotice', 'BatterNotice', 'FielderNotice', 'PinchRunNotice']) {
    assert.doesNotMatch(code(`components/playbyplay/${f}.jsx`), /for the \$\{/, `${f} drops the team name from the tab`)
  }
})

test('delay tab is the headline; the sentence is the man who left, else the stoppage', () => {
  assert.equal(delayTab('Injury delay'), 'Injury delay')
  assert.equal(delayTab(''), 'Delay')
  assert.equal(delaySentence({ detail: 'Cal Quantrill leaves the game', minutes: 12 }, fmt), 'Cal Quantrill leaves the game.')
  assert.equal(delaySentence({ detail: '', minutes: 107 }, (m) => (m === 107 ? '1 hr 47 min' : '')), 'Play stopped for 1 hr 47 min.')
  assert.equal(delaySentence({ detail: '', minutes: null }, fmt), '')
})

test('the pinch runner line reads First Last, not Last, First', () => {
  assert.equal(firstLast('Vaughn, Andrew'), 'Andrew Vaughn')
  assert.equal(firstLast('Acuña Jr., Ronald'), 'Ronald Acuña Jr.')
  assert.equal(firstLast('Ohtani'), 'Ohtani')
  assert.equal(forLine('Vaughn, Andrew', 1), 'For Andrew Vaughn at 1st base')
  assert.equal(forLine('Vaughn, Andrew', null), 'For Andrew Vaughn')
})

test('mound visit pips: used count, tag, and none for the trip that pulled the pitcher', () => {
  assert.deepEqual(moundPips({ remaining: 3, allowed: 5 }), { used: 2, total: 5, tag: '3 left', label: '2 of 5 mound visits used, 3 left' })
  assert.equal(moundPips({ remaining: 0, allowed: 5 }).used, 5)
  assert.equal(moundPips({ remaining: 4, allowed: 6 }).total, 6, 'extra innings add a visit')
  assert.equal(moundPips({ remaining: null, allowed: 5 }), null)
})

test('the ejection card shows the ejected person from entry.playerId (coach rung); no photo shows nothing', () => {
  const plays = code('components/playbyplay/PlayByPlay.jsx')
  assert.match(plays, /<EjectionBar[^>]*playerId=\{entry\.playerId\}/)
  const ej = code('components/playbyplay/EventCards.jsx')
  assert.match(ej, /export function EjectionBar\(\{[^}]*playerId/)
  // A manager has no silo photo; every chain PitcherPhoto walks ends on the coach rung.
  assert.equal(headshotSources(123, { mlb: true }).at(-1), coachHeadshotUrl(123))
  assert.deepEqual(headshotSources(123, { coach: true }), [coachHeadshotUrl(123)])
  assert.match(code('components/playbyplay/PitcherNotice.jsx'), /if \(bare\) return null/, 'bare: no monogram or logo box')
  const clubs = [{ id: 1, name: 'Brewers' }, { id: 2, name: 'Athletics' }]
  assert.equal(ejectedClub('Athletics manager Mark Kotsay ejected by HP umpire Stu Scheurwater.', clubs).id, 2)
  assert.equal(ejectedClub('Umpire Joe Smith ejected someone.', clubs), null)
  // A player's club comes from the feed, even when the sentence names no club; a manager is in no list.
  const feed = { gameData: { teams: { away: { id: 2 }, home: { id: 1 } } }, liveData: { boxscore: { teams: { away: { players: {} }, home: { players: { ID9: {} } } } } } }
  assert.equal(ejectedClub('Joe Player ejected by HP umpire X.', clubs, feed, 9).id, 1)
  assert.equal(ejectedClub('Athletics manager Mark Kotsay ejected.', clubs, feed, 117276).id, 2)
  assert.equal(playerClubId(feed, 9), 1)
  assert.equal(playerClubId(feed, 117276), null)
})

test('no code chips: SB, CS, WP, PB, BK, DELAY and EJ are not drawn; EVENT_CODES stays', () => {
  const cards = code('components/playbyplay/EventCards.jsx')
  assert.doesNotMatch(cards, /change__code/)
  assert.doesNotMatch(cards, /code = 'EJ'|>DELAY</)
  assert.match(cards, /export const EVENT_CODES/)
})

test('club logo ends the row; the pitch label rides the count tag', () => {
  const cards = code('components/playbyplay/EventCards.jsx')
  assert.match(cards, /<TeamLogo[^>]*size=\{36\}/)
  assert.match(cards, /<TeamLogo[^>]*size=\{32\}/, 'baserunning cards are 32')
  assert.match(cards, /playerClubId\(feed, runnerId\) \?\? clubId/, 'the logo is the photo person\'s club')
  assert.match(cards, /card__count/)
  assert.doesNotMatch(cards, /change__pitchno/)
})
