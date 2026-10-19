import { fetchGameFeed } from '../../../../../api/game.js'
import { classifyHighlight, fetchHighlights, formatClipDuration, highlightForPlay, highlightPlaybacks, isEligibleForPositiveFilter } from '../../../../../api/highlights.js'
import { HIT_EVENT_TYPES, WHIFF_CODES, pitchCallCode } from '../../../../../api/playbyplay/eventTypes.js'

// The game detail view's data (#1851): his pitches, strikeouts and big plays from the game's
// feed, and the clips from its content items. Fetched only when the view opens.
// The score and the decision are NOT read here: they come from the log row (resultOf). Plays are
// open on this page (ADR-0110, retired by ADR-0117).
// A ROW WITH NO RESULT GETS NO CLIPS: a headline says "in win" or "records the save", and a video
// carries the broadcast scorebug. A held row (row.result null: a game still on) gets no clip of any
// kind, and its content is never fetched.

// Every path below verified live on gamePk 823787 (2026-10-13). `fields=` is name-based: a
// name missing here arrives undefined.
const FIELDS =
  'liveData,plays,allPlays,about,inning,isScoringPlay,matchup,pitcher,batter,id,fullName,result,eventType,event,description,rbi,playEvents,isPitch,playId,details,call,code,type,pitchData,startSpeed'

export async function loadStart({ gamePk, result }) {
  const [feed, items] = await Promise.all([fetchGameFeed(gamePk, { fields: FIELDS }).catch(() => null), result ? fetchHighlights(gamePk) : []])
  return { feed, items }
}

const DAY = 864e5
// An MLB clip's button, or null with no playable source.
function watch(item) {
  const { mp4, hls } = highlightPlaybacks(item)
  return item && (mp4 || hls) ? { label: `Watch ${formatClipDuration(item.duration)}`.trim(), href: mp4 ?? hls } : null
}
// A whiff as Savant counts it, foul tips ('T') in, as scripts/lib/pitch/hitter-grid.mjs does: the
// approved design's numbers (cutter 5 on 5/23) are Savant's. The scoring surfaces count a tip as a foul.
const isWhiff = (call) => call === 'T' || WHIFF_CODES.has(call)
const lastPitch = (play) => play.playEvents?.findLast((e) => e.isPitch) ?? null

// The clip for one play: MLB's highlight, joined on the last pitch's playId (highlights.js),
// else the Baseball Savant single-pitch clip of that pitch. Savant has none before 2016
// (expresslane/clipIndex.js) or for an untracked pitch, so no button then.
export function clipFor(play, items, day) {
  const last = lastPitch(play)
  const clip = watch(highlightForPlay(items, last?.playId))
  if (clip) return clip
  if (day >= '2016' && last?.playId && last.pitchData?.startSpeed != null) return { label: 'Pitch clip', href: `https://baseballsavant.mlb.com/sporty-videos?playId=${last.playId}` }
  return null
}

const line = (play, items, day, result, event) => ({
  key: lastPitch(play)?.playId ?? null,
  inning: play.about?.inning ?? null,
  batter: play.matchup?.batter?.fullName ?? '',
  event,
  text: play.result?.description ?? '',
  clip: result ? clipFor(play, items, day) : null,
})

// `{ feed, items }` (loadStart) for pitcher `id` and his log row -> the parts.
export function startDetail({ feed, items }, id, { day, result }) {
  const plays = (feed?.liveData?.plays?.allPlays ?? []).filter((p) => p.matchup?.pitcher?.id === id)
  const by = new Map()
  for (const e of plays.flatMap((p) => p.playEvents ?? [])) {
    const code = e.isPitch && e.details?.type?.code
    if (!code) continue
    const t = by.get(code) ?? { code, n: 0, mphSum: 0, mphN: 0, whiffs: 0 }
    t.n += 1
    if (e.pitchData?.startSpeed != null) {
      t.mphSum += e.pitchData.startSpeed
      t.mphN += 1
    }
    if (isWhiff(pitchCallCode(e))) t.whiffs += 1
    by.set(code, t)
  }
  const total = [...by.values()].reduce((s, t) => s + t.n, 0)
  const pitches = [...by.values()]
    .sort((a, b) => b.n - a.n)
    .map((t) => ({ code: t.code, n: t.n, pct: Math.round((100 * t.n) / total), mph: t.mphN ? (t.mphSum / t.mphN).toFixed(1) : null, whiffs: t.whiffs }))

  const strikeouts = plays.filter((p) => p.result?.eventType?.startsWith('strikeout')).map((p) => line(p, items, day, result))
  const bigPlays = plays
    .filter((p) => HIT_EVENT_TYPES.has(p.result?.eventType) || p.about?.isScoringPlay || p.result?.rbi > 0)
    .map((p) => line(p, items, day, result, p.result?.rbi > 0 ? `${p.result.event}, ${p.result.rbi} RBI` : p.result?.event ?? ''))

  // Clips about his outing: his id on the clip, not joined to one of his plays, and published
  // within two days of the game (a game's content can list clips of other games).
  const joined = new Set(plays.map((p) => lastPitch(p)?.playId).filter(Boolean))
  const clips = (result ? items ?? [] : [])
    .filter(
      (i) =>
        isEligibleForPositiveFilter(classifyHighlight(i)) &&
        i.keywordsAll?.some((k) => k.type === 'player_id' && Number(k.value) === id) &&
        !joined.has(i.guid) &&
        Math.abs(Date.parse(i.date) - Date.parse(day)) < 2 * DAY,
    )
    .map((i) => ({ key: i.guid ?? i.id ?? i.headline, title: i.headline ?? '', ...watch(i) }))
    .filter((c) => c.href)

  return { pitches, strikeouts, bigPlays, clips }
}

const DEC = { W: (n) => `${n} gets the win.`, L: (n) => `${n} takes the loss.`, SV: (n) => `${n} gets the save.`, ND: (n) => `No decision for ${n}.` }

// The result strip, from the log row (the guarded score and decision): null for a game with no
// final score on file. `last` is his last name.
export function resultOf(row, last) {
  if (!row.result) return null
  return {
    label: `${row.clubAbbr} ${{ W: 'win', L: 'lose', T: 'tie' }[row.result]}`,
    score: `${row.clubAbbr} ${row.runs}, ${row.oppAbbr} ${row.oppRuns}`,
    dec: DEC[row.dec]?.(last) ?? null,
  }
}
