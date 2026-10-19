// The World Series scouting report's regular-season meetings (#2316): the games the two
// finalists played against each other, each with the detail a scouting card shows.
//
// SPOILER FOOTING (ADR-0087, ADR-0088, ADR-0117). Every game here is a Final regular-season
// game dated BEFORE the slate date: the request ends the day before, and
// `selectMeetings` drops any other row. A past game's box score opens by its date, so its
// score, decisions and lines are open. Today's game, and every Series game, never get a
// feed read. Nothing here writes a `bbsbh:boxreveal:*` key.
//
// Field paths checked against live statsapi on 2026-10-19, gamePks 823775, 823774, 823772
// (CLE @ MIL) and 823809, 823807, 823806 (TB @ MIL): gameData.{datetime.officialDate,
// venue.name, teams.*.{id,abbreviation}, players.ID*.{boxscoreName,pitchHand.code}};
// liveData.{linescore.teams.*.{runs,hits,errors}, decisions.{winner,loser,save}.fullName,
// boxscore.officials[officialType 'Home Plate'].official.fullName, boxscore.teams.*.
// {pitchers[0], battingOrder, players.ID*.{person, position.abbreviation,
// stats.pitching.{inningsPitched,hits,earnedRuns,baseOnBalls,strikeOuts,numberOfPitches}}},
// plays.{scoringPlays (indexes), allPlays[].{about.{inning,isTopInning}, result.description,
// matchup.pitcher.id, playEvents[].{isPitch, details.type.code}}}.
// Missing fields fall back: text to '', numbers to null, lists to [], the pitch mix to {}.
//
// Card: { gamePk, date, venue, ump, decisions: { w, l, s },
//   away|home: { id, abbr, runs, hits, errors,
//     starter: { id, name, hand, ip, h, er, bb, k, pitches, mix: { [pitchCode]: count } },
//     lineup: [{ id, name, pos }] },
//   scoring: [{ inning: 'T1' | 'B6', text }] }
import { selectMeetings } from '../../lib/postseason/worldseries/meetings.js'
import { getJson } from '../statsapi.js'
import { dayBefore, keptGames } from './fetch.js'

const FIELDS = 'dates,date,games,gamePk,gameType,officialDate,status,abstractGameState,teams,away,home,team,id'

export function meetingsUrl(clubA, clubB, slateDate) {
  return (
    `/api/v1/schedule?sportId=1&teamId=${clubA}&opponentId=${clubB}&gameType=R` +
    `&season=${slateDate.slice(0, 4)}&startDate=${slateDate.slice(0, 4)}-01-01&endDate=${dayBefore(slateDate)}&fields=${FIELDS}`
  )
}

const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null)

function side(feed, s) {
  const { gameData: gd, liveData: ld } = feed ?? {}
  const box = ld?.boxscore?.teams?.[s]
  const sp = box?.pitchers?.[0] ?? null
  const st = box?.players?.[`ID${sp}`]?.stats?.pitching
  const mix = {}
  for (const play of ld?.plays?.allPlays ?? []) {
    if (play.matchup?.pitcher?.id !== sp) continue
    for (const ev of play.playEvents ?? []) {
      const code = ev.isPitch && ev.details?.type?.code
      if (code) mix[code] = (mix[code] ?? 0) + 1
    }
  }
  const line = ld?.linescore?.teams?.[s]
  return {
    id: gd?.teams?.[s]?.id ?? null,
    abbr: gd?.teams?.[s]?.abbreviation ?? '',
    runs: num(line?.runs),
    hits: num(line?.hits),
    errors: num(line?.errors),
    starter: {
      id: sp,
      name: box?.players?.[`ID${sp}`]?.person?.fullName ?? '',
      hand: gd?.players?.[`ID${sp}`]?.pitchHand?.code ?? '',
      ip: st?.inningsPitched ?? null,
      h: num(st?.hits),
      er: num(st?.earnedRuns),
      bb: num(st?.baseOnBalls),
      k: num(st?.strikeOuts),
      pitches: num(st?.numberOfPitches),
      mix,
    },
    lineup: (box?.battingOrder ?? []).map((id) => ({
      id,
      name: gd?.players?.[`ID${id}`]?.boxscoreName ?? box.players?.[`ID${id}`]?.person?.fullName ?? '',
      pos: box.players?.[`ID${id}`]?.position?.abbreviation ?? '',
    })),
  }
}

// One game's card from its live feed. Never throws: a thin or missing feed is the empty card.
export function meetingCard(feed, gamePk) {
  const { gameData: gd, liveData: ld } = feed ?? {}
  const plays = ld?.plays?.allPlays ?? []
  const dec = ld?.decisions
  return {
    gamePk,
    date: gd?.datetime?.officialDate ?? '',
    venue: gd?.venue?.name ?? '',
    ump: (ld?.boxscore?.officials ?? []).find((o) => o.officialType === 'Home Plate')?.official?.fullName ?? '',
    decisions: { w: dec?.winner?.fullName ?? '', l: dec?.loser?.fullName ?? '', s: dec?.save?.fullName ?? '' },
    away: side(feed, 'away'),
    home: side(feed, 'home'),
    scoring: (ld?.plays?.scoringPlays ?? [])
      .map((i) => plays[i])
      .filter(Boolean)
      .map((p) => ({ inning: `${p.about?.isTopInning ? 'T' : 'B'}${p.about?.inning ?? ''}`, text: p.result?.description ?? '' })),
  }
}

// The cards of the clubs' Final regular-season games before the slate date, oldest
// first. [] on a failed schedule read; a game whose feed fails is the empty card.
export async function fetchMeetings({ clubA, clubB, slateDate }, { signal } = {}) {
  let rows
  try {
    rows = keptGames(await getJson(meetingsUrl(clubA, clubB, slateDate), { signal }))
  } catch {
    return []
  }
  return Promise.all(
    selectMeetings(rows, { clubA, clubB, slateDate }).map(async (g) => {
      const feed = await getJson(`/api/v1.1/game/${g.gamePk}/feed/live`, { signal }).catch(() => null)
      const card = meetingCard(feed, g.gamePk)
      return { ...card, date: card.date || g.officialDate }
    }),
  )
}
