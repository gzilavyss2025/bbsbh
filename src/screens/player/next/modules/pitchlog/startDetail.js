import { fetchGameFeed } from '../../../../../api/game.js'
import { classifyHighlight, fetchHighlights, formatClipDuration, highlightForPlay, highlightPlaybacks, isEligibleForPositiveFilter } from '../../../../../api/highlights.js'
import { HIT_EVENT_TYPES, WHIFF_CODES, pitchCallCode } from '../../../../../api/playbyplay/eventTypes.js'

// The game detail view's data (#1851): his pitches, strikeouts and big plays from the game's
// feed, and the clips from its content items. Fetched only when the view opens.
// The score and the decision are NOT read here: they come from the log row (resultOf), so the
// ADR-0110 guard on that row covers this view too. Plays are open on this page (ADR-0110).

// Every path below verified live on gamePk 823787 (2026-10-13). `fields=` is name-based: a
// name missing here arrives undefined.
const FIELDS =
  'gameData,teams,away,home,id,teamName,abbreviation,liveData,plays,allPlays,about,inning,isScoringPlay,matchup,pitcher,batter,fullName,result,eventType,event,description,rbi,playEvents,isPitch,playId,details,call,code,type,pitchData,startSpeed'

export async function loadStart(gamePk) {
  const [feed, items] = await Promise.all([fetchGameFeed(gamePk, { fields: FIELDS }).catch(() => null), fetchHighlights(gamePk)])
  return { feed, items }
}

const DAY = 864e5
// A whiff as Savant counts it, foul tips ('T') in, as scripts/lib/pitch/hitter-grid.mjs does: the
// approved design's numbers (cutter 5 on 5/23) are Savant's. The scoring surfaces count a tip as a foul.
const isWhiff = (call) => call === 'T' || WHIFF_CODES.has(call)
const lastPitch = (play) => play.playEvents?.findLast((e) => e.isPitch) ?? null

// The clip for one play: MLB's highlight, joined on the last pitch's playId (highlights.js),
// else the Baseball Savant single-pitch clip of that pitch. A pitch with no tracking (before
// Statcast) has no Savant clip, so no button.
export function clipFor(play, items) {
  const last = lastPitch(play)
  const item = highlightForPlay(items, last?.playId)
  const { mp4, hls } = highlightPlaybacks(item)
  if (item && (mp4 || hls)) return { label: `Watch ${formatClipDuration(item.duration)}`.trim(), href: mp4 ?? hls }
  if (last?.playId && last.pitchData?.startSpeed != null) return { label: 'Pitch clip', href: `https://baseballsavant.mlb.com/sporty-videos?playId=${last.playId}` }
  return null
}

const line = (play, items, event) => ({
  key: lastPitch(play)?.playId ?? `${play.about?.inning}-${play.matchup?.batter?.id}`,
  inning: play.about?.inning ?? null,
  batter: play.matchup?.batter?.fullName ?? '',
  event,
  text: play.result?.description ?? '',
  clip: clipFor(play, items),
})

// `{ feed, items }` (loadStart) for pitcher `id` and his log row -> the parts. `club` is his
// club's name ("Brewers") for the result strip, or null with no feed.
export function startDetail({ feed, items }, id, { day, home }) {
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

  const strikeouts = plays.filter((p) => p.result?.eventType?.startsWith('strikeout')).map((p) => line(p, items))
  const bigPlays = plays
    .filter((p) => HIT_EVENT_TYPES.has(p.result?.eventType) || p.about?.isScoringPlay || p.result?.rbi > 0)
    .map((p) => line(p, items, p.result?.rbi > 0 ? `${p.result.event}, ${p.result.rbi} RBI` : p.result?.event ?? ''))

  // Clips about his outing: his id on the clip, not joined to one of his plays, and published
  // within two days of the game (a game's content can list clips of other games).
  const joined = new Set(plays.map((p) => lastPitch(p)?.playId).filter(Boolean))
  const clips = (items ?? [])
    .filter(
      (i) =>
        isEligibleForPositiveFilter(classifyHighlight(i)) &&
        i.keywordsAll?.some((k) => k.type === 'player_id' && Number(k.value) === id) &&
        !joined.has(i.guid) &&
        Math.abs(Date.parse(i.date) - Date.parse(day)) < 2 * DAY,
    )
    .flatMap((i) => {
      const { mp4, hls } = highlightPlaybacks(i)
      return mp4 || hls ? [{ key: i.guid ?? i.id ?? i.headline, title: i.headline ?? '', label: `Watch ${formatClipDuration(i.duration)}`.trim(), href: mp4 ?? hls }] : []
    })

  const club = feed?.gameData?.teams?.[home ? 'home' : 'away']?.teamName ?? null
  return { pitches, strikeouts, bigPlays, clips, club }
}

const DEC = { W: (n) => `${n} gets the win.`, L: (n) => `${n} takes the loss.`, SV: (n) => `${n} gets the save.`, ND: (n) => `No decision for ${n}.` }

// The result strip, from the log row (the guarded score and decision): null for a game with no
// final score on file. `club` is his club's name ("Brewers"), `last` his last name.
export function resultOf(row, club, last) {
  if (!row.result) return null
  return {
    label: `${club} ${{ W: 'win', L: 'lose', T: 'tie' }[row.result]}`,
    score: `${club} ${row.runs}, ${row.oppAbbr} ${row.oppRuns}`,
    dec: DEC[row.dec]?.(last) ?? null,
  }
}
