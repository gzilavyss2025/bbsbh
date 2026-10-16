// The World Series' "last time" notes: wsLastTime (play card), wsLastTimeGame (Final roll-up)
// and wsWtaTrailing9 (pre-half strip, entering the top of the 9th of a winner-take-all game).
// What a tag MEANS is lib/worldSeries/classify.js, the code that built events.json (one
// definition); every lookup is cut strictly before tonight's date by lastBefore (ADR-0087).
// The history is events.json plus bundle.wsEvents (the current Series, written by the nightly
// shard); an older shard without the key just leaves the second half empty.
//
// Tense (ADR-0014): the play-card builder reads only the revealed play (the feed supplies the
// earlier plays, and "last play" only once the game is Final); the roll-up builder is
// reveal-only; the 9th-inning builder reads tonight's score, so prehalf-callouts.js calls it
// only once the 8th is at or under the reveal mark, the same gate as buildAfterInningNote.
import { lastBefore } from '../../lib/worldSeries/lastBefore.js'
import * as C from '../../lib/worldSeries/classify.js'
import { SCORE_BASE, clampScore, magnitudeOf, skewBonus, gameResult } from './shared.js'

export const WS_MIN_GAP_SEASONS = 3
const GAP_FULL = 25 // seasons for the full magnitude bonus

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
const dateText = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`

// Every row before tonight can come from here; null while the file is not loaded, so a slow
// fetch never reads as "the first in history".
const rowsOf = (history, bundle) =>
  history?.events ? [...history.events, ...(bundle?.wsEvents?.events ?? [])] : null

// The last earlier row of `tag`, and whether the gap clears the floor. null = stay quiet.
function lastTime(rows, gameDate, tag, filter) {
  const [prev] = lastBefore(rows, { before: gameDate, tag, filter })
  const gap = prev ? Number(gameDate.slice(0, 4)) - prev.season : GAP_FULL
  return gap >= WS_MIN_GAP_SEASONS ? { prev, bonus: magnitudeOf(gap, GAP_FULL) } : null
}

// --- play card -----------------------------------------------------------------------------
// Most specific first: the first tag that fires is the one note.
const PLAY_NOUN = {
  walkOffGrandSlam: 'walk-off grand slam',
  pinchHitGrandSlam: 'pinch-hit grand slam',
  walkOffHr: 'walk-off home run',
  openingHrPair: 'game to open with two home runs',
  pinchHitHr: 'pinch-hit home run',
  grandSlam: 'grand slam',
  extraInningHr: 'extra-inning home run',
  multiHrGame: `game with ${C.WS_MULTI_HR} home runs by one batter`,
  pitcherHit: 'hit by a pitcher in a winner-take-all game',
  triplePlay: 'triple play',
  gameEndingDp: 'game-ending double play',
}

// What the world series ctx a play card needs; null for any game that is not a World Series
// game or while events.json has not loaded.
export function wsPlayCtx(feed, bundle, history) {
  const gameDate = feed?.gameData?.datetime?.officialDate
  const rows = rowsOf(history, bundle)
  if (feed?.gameData?.game?.type !== 'W' || !rows || !gameDate) return null
  return {
    rows, gameDate, final: gameResult(feed).final, wta: Boolean(bundle?.wsEvents?.wta),
    plays: C.orderedPlays(feed.liveData?.plays),
    // The lineup's starters (known before the first pitch); a batter who starts is a pitcher from play one.
    starters: ['away', 'home'].map((s) => feed.liveData?.boxscore?.teams?.[s]?.pitchers?.[0]).filter(Boolean),
  }
}

function playTags(play, ws) {
  const { plays, final, wta, starters = [] } = ws
  const i = plays.findIndex((p) => p.about.atBatIndex === play.about.atBatIndex)
  if (i < 0) return {}
  const gameEnds = final && i === plays.length - 1
  const slam = C.isGrandSlam(play)
  const pinch = C.isPinchHitHr(play)
  const walkOff = gameEnds && C.isWalkOffHr(play, C.finalScore(plays))
  const hrs = plays.slice(0, i + 1).filter((p) => C.isHr(p) && C.batterId(p) === C.batterId(play)).length
  return {
    walkOffGrandSlam: walkOff && slam,
    pinchHitGrandSlam: pinch && slam,
    walkOffHr: walkOff,
    openingHrPair: i === 1 && C.isOpeningHrPair(plays),
    pinchHitHr: pinch,
    grandSlam: slam,
    extraInningHr: C.isExtraInningHr(play),
    multiHrGame: C.isHr(play) && hrs === C.WS_MULTI_HR,
    pitcherHit: wta && C.isPitcherHitAt(plays, i, starters),
    triplePlay: C.isTriplePlay(play),
    gameEndingDp: gameEnds && C.isGameEndingDp(play),
  }
}

export function buildWsLastTimeNotes(entry, ws, side = null) {
  const play = ws?.plays.find((p) => p.about.atBatIndex === entry.atBatIndex)
  if (!play) return []
  const hit = playTags(play, ws)
  for (const [tag, noun] of Object.entries(PLAY_NOUN)) {
    if (!hit[tag]) continue
    const t = lastTime(ws.rows, ws.gameDate, tag)
    if (!t) continue
    return [{
      text: t.prev ? `The last World Series ${noun} came on ${dateText(t.prev.date)}.` : `The first ${noun} in World Series history.`,
      personId: entry.batterId ?? null,
      side,
      kind: 'wsLastTime',
      dedupeKey: `wsLastTime-${tag}-${entry.atBatIndex}`,
      score: clampScore(SCORE_BASE.wsLastTime + t.bonus),
    }]
  }
  return []
}

// --- Final roll-up (reveal-only) ---------------------------------------------------------------
const GAME_NOUN = {
  extraInnings: (v) => `game of ${v} or more innings`,
  shutout: () => 'shutout',
  bigScore: (v) => `game with a team scoring ${v} or more runs`,
  bigComeback: (v) => `comeback from a deficit of ${v} or more runs`,
  reachedBase: (v) => `game with a batter reaching base ${v} or more times`,
}

export function buildWsLastTimeGameNotes(feed, bundle, history) {
  const rows = rowsOf(history, bundle)
  const date = feed?.gameData?.datetime?.officialDate
  if (feed?.gameData?.game?.type !== 'W' || !rows || !date || !gameResult(feed).final || !bundle?.away) return []
  const events = C.classifyGame(feed.liveData.plays, {
    innings: feed.liveData.linescore?.innings?.length,
    clubs: { away: bundle.away.teamId, home: bundle.home.teamId },
  })
  const out = []
  for (const [tag, noun] of Object.entries(GAME_NOUN)) {
    // The biggest instance of the tag in this game (bigScore can hold both clubs).
    const ev = events.filter((e) => e.tag === tag).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
    if (!ev) continue
    const same = tag === 'shutout' ? undefined : (r) => r.value >= ev.value
    const t = lastTime(rows, date, tag, same)
    if (!t) continue
    const what = noun(ev.value)
    const side = ['away', 'home'].find((s) => bundle[s].teamId === ev.club) ?? null
    out.push({
      text: t.prev ? `The first World Series ${what} since ${dateText(t.prev.date)}.` : `The first ${what} in World Series history.`,
      personId: null, side, kind: 'wsLastTimeGame', dedupeKey: `wsLastTimeGame-${tag}`,
      score: clampScore(SCORE_BASE.wsLastTimeGame + t.bonus),
    })
  }
  return out
}

// --- pre-half strip, top of the 9th ------------------------------------------------------------
// `row` is cumulativeInnings' row for the 8th: the caller has checked the 8th is revealed.
export function buildWsWtaTrailing9Note({ row, inning, half, bundle, history, gameDate, gameType }) {
  const rows = rowsOf(history, bundle)
  if (gameType !== 'W' || !rows || !bundle?.wsEvents?.wta || inning !== 9 || half !== 'top' || row?.inning !== 8) return null
  if (row.cumAway === row.cumHome) return null
  const past = lastBefore(rows, { before: gameDate, tag: 'wtaTrailing9' })
  if (!past.length) return null
  const w = past.filter((r) => r.value === 1).length
  const l = past.length - w
  return {
    text: `Teams trailing entering the 9th of a winner-take-all game are ${w}-${l}.`,
    personId: null,
    side: row.cumAway < row.cumHome ? 'away' : 'home',
    kind: 'wsWtaTrailing9',
    dedupeKey: 'wsWtaTrailing9',
    score: clampScore(SCORE_BASE.wsWtaTrailing9 + skewBonus(w, l)),
  }
}
