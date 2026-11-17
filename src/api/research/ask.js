// THE ASK BAR's parser (#3138, Gary 2026-11-16): a plain-English question -> the query
// parseQuery returns. Rule-based, in the page: no model call, free, instant, offline.
//
// CLOSED VOCABULARY. A word is read only if it is a phrase below (chip options and their
// synonyms, clubs, the store's own player names, years, counts, question cues, game-mode
// totals and "how runs scored"), or a filler word (FILLER). Every other word is SKIPPED
// and returned, so the page can show it. The parser never guesses.
//
// MATCHING. Longest phrase first, left to right ("walk off" beats "walk", "double play"
// beats "double"). Context the phrase reads:
//   role   a hand, a player or a club after off / against / vs / facing is the pitching
//          side; the first lefty is the batter, the second the pitcher.
//   all    "all" (or "none") before a run phrase makes it a "How runs scored" condition:
//          "all of them came on solo home runs" -> how=solo.
//   game   a total ("6 runs"), a how phrase or "a game" puts the query in game mode
//          (games.js). In game mode a club after "allowed" / "gave up" is the Pitching
//          club, and a play-only card's words are skipped (GAME_CHIPS keeps the rest).
//
// SPOILER CLASSIFICATION: spoiler-free. Pure text -> query; it reads no game data.

import { FILTER_BY_KEY } from './filters.js'
import { GAME_CHIPS } from './games.js'
import { PITCH_TYPES } from '../../lib/pitch/pitchTypes.js'
import { ALL_MLB_TEAM_IDS, teamAbbr, teamClubName, teamLocationName } from '../../lib/teams.js'

// Words read and dropped: grammar, and the role words the context already reads.
const FILLER = new Set('a an the of off on in at by with when was were is are be been did does do has have had hit got get gets and or to for from against vs v versus facing his her their its it they them there that which ever came come where after before during player batter hitter pitcher guy someone somebody anyone team club me show find'.split(' '))
const ROLE_CUES = new Set(['off', 'against', 'vs', 'v', 'versus', 'facing'])
const ARTICLES = new Set(['a', 'an', 'the'])

const NUMBER_WORDS = { no: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20 }
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth']
const MONTHS = ['march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november']

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// The sentence -> tokens { w, start, end }: lowercase, accents and possessives off, a
// hyphen between letters splits ("opposite-field" -> two tokens on one span); a hyphen
// between digits stays ("0-2", "2015-2019"). Spans point into the original text.
export function tokenize(text) {
  const out = []
  for (const m of text.matchAll(/[\p{L}\p{N}'’+-]+/gu)) {
    const word = fold(m[0]).replace(/['’]s$/, '').replace(/['’]/g, '')
    for (const w of word.split(/(?<=\p{L})-|-(?=\p{L})/u)) if (w && w !== '-') out.push({ w, start: m.index, end: m.index + m[0].length })
  }
  return out
}

// A number token: digits or a word. null otherwise.
const num = (w) => (/^\d{1,3}$/.test(w) ? Number(w) : NUMBER_WORDS[w] ?? null)

// ---- The vocabulary. An entry: words (a phrase) and apply(ctx, m), m the match's tokens.

function chip(ctx, key, vals) {
  if (ctx.game && !GAME_CHIPS.includes(key)) return false
  const c = (ctx.q.chips[key] ??= { vals: [], inv: false })
  for (const v of vals) if (!c.vals.includes(v)) c.vals.push(v)
  return true
}
// A hand: the pitcher after a role cue or before "pitcher", else the batter, then the pitcher.
function hand(side) {
  return (ctx, m, next) => {
    const pitching = ctx.cue || next === 'pitcher' || next === 'starter' || next === 'reliever' || (ctx.q.chips.bh && !ctx.cue)
    return chip(ctx, pitching ? 'ph' : 'bh', [side])
  }
}
const set = (key, vals) => (ctx) => chip(ctx, key, vals)
const ask = (key) => (ctx) => {
  ctx.q.ask = key
  return true
}
const how = (key, fallback) => (ctx) => {
  if (ctx.all || ctx.none) {
    ctx.how.add(key)
    ctx.all = ctx.none = false
    return true
  }
  return fallback ? fallback(ctx) : false
}

const RISP = ['-2-', '--3', '12-', '1-3', '-23', '123']
const HR = ['home run', 'home runs', 'homer', 'homers', 'homered', 'homerun', 'homeruns', 'dinger', 'dingers', 'hr', 'hrs', 'long ball', 'jack', 'jacks']

// [phrases, apply]. A phrase is a space-separated string.
const BASE = [
  // The question.
  [['last time', 'the last time', 'the last', 'most recent', 'most recently', 'last', 'when'], ask('last')],
  [['how often', 'how many times', 'how many', 'how common', 'how frequently', 'often'], ask('often')],
  [['who', 'who most', 'who has the most', 'which player', 'which players', 'most'], ask('most')],
  [['what happens', 'what happened', 'what usually happens', 'what happens after', 'what happens with'], (ctx) => !ctx.game && ask('what')(ctx)],
  // PA result.
  [HR, how('hr', set('res', ['home_run']))],
  [['solo home run', 'solo home runs', 'solo homer', 'solo homers', 'solo shot', 'solo shots'], how('solo', (ctx) => chip(ctx, 'res', ['home_run']) && chip(ctx, 'run', ['---']))],
  [['triple', 'triples', 'tripled'], set('res', ['triple'])],
  [['double', 'doubles', 'doubled'], set('res', ['double'])],
  [['single', 'singles', 'singled'], set('res', ['single'])],
  [['walk', 'walks', 'walked', 'base on balls', 'bb'], set('res', ['walk'])],
  [['intentional walk', 'intentional walks', 'intentionally walked', 'ibb'], set('res', ['intent_walk'])],
  [['hit by pitch', 'hit by a pitch', 'hit by pitches', 'hbp', 'plunked'], set('res', ['hit_by_pitch'])],
  [['strikeout', 'strikeouts', 'struck out', 'strike out', 'k', 'ks', 'punchout', 'whiff'], set('res', ['strikeout'])],
  [['out in play'], set('res', ['field_out'])],
  [['gidp', 'grounded into a double play', 'ground into a double play', 'grounded into double play'], set('res', ['grounded_into_double_play'])],
  [['double play', 'double plays'], set('res', ['double_play'])],
  [['triple play', 'triple plays'], set('res', ['triple_play'])],
  [['force out', 'forceout'], set('res', ['force_out'])],
  [['fielders choice', 'fielder choice'], set('res', ['fielders_choice'])],
  [['reached on error', 'reached on an error', 'error', 'errors', 'an error'], how('err', (ctx) => (ctx.game ? (ctx.how.add('err'), true) : chip(ctx, 'res', ['field_error'])))],
  [['sac fly', 'sacrifice fly', 'sac flies'], set('res', ['sac_fly'])],
  [['sac bunt', 'sacrifice bunt', 'sacrifice'], set('res', ['sac_bunt'])],
  [['catcher interference', 'catchers interference'], set('res', ['catcher_interf'])],
  [['base hit', 'a hit', 'base hits', 'hits'], how('nohit', set('res', ['single', 'double', 'triple', 'home_run']))],
  [['extra base hit', 'extra base hits', 'xbh'], set('res', ['double', 'triple', 'home_run'])],
  // Hands.
  [['lefty', 'lefties', 'left', 'left handed', 'lefthanded', 'southpaw', 'southpaws', 'lh'], hand('L')],
  [['righty', 'righties', 'right', 'right handed', 'righthanded', 'rh'], hand('R')],
  [['lhb', 'left handed batter', 'left handed hitter'], set('bh', ['L'])],
  [['rhb', 'right handed batter', 'right handed hitter'], set('bh', ['R'])],
  [['lhp', 'left handed pitcher', 'left handed pitching'], set('ph', ['L'])],
  [['rhp', 'right handed pitcher', 'right handed pitching'], set('ph', ['R'])],
  // Batted ball location and type.
  [['oppo', 'opposite field', 'opp field', 'the other way', 'other way'], set('fld', ['oppo'])],
  [['pull', 'pulled', 'pull side'], set('fld', ['pull'])],
  [['center', 'center field', 'up the middle', 'dead center'], set('fld', ['center'])],
  [['ground ball', 'ground balls', 'grounder', 'grounders', 'groundball'], set('bb', ['ground_ball'])],
  [['line drive', 'line drives', 'liner', 'liners', 'lined'], set('bb', ['line_drive'])],
  [['fly ball', 'fly balls', 'flyball', 'flyballs', 'fly'], set('bb', ['fly_ball'])],
  [['popup', 'pop up', 'popups', 'pop ups', 'pop fly'], set('bb', ['popup'])],
  // Horizontal location.
  [['inner third', 'inside', 'inner'], set('loc', ['inner'])],
  [['middle third', 'middle', 'down the middle'], set('loc', ['middle'])],
  [['outer third', 'outside', 'outer'], set('loc', ['outer'])],
  // Pitch types: each name, and its common spoken forms.
  ...PITCH_TYPES.map((p) => [[fold(p.name), `${fold(p.name)}s`], set('pt', [p.code])]),
  [['four seamer', 'four seam fastball', 'four seamers', '4 seam', '4 seamer', 'heater', 'fastball', 'fastballs'], set('pt', ['FF'])],
  [['two seamer', 'two seam fastball', 'two seamers', 'sinkerball'], set('pt', ['SI'])],
  [['curve', 'curves', 'curveballs', 'hook', 'yakker'], set('pt', ['CU'])],
  [['change', 'changeups', 'change up', 'changeup'], set('pt', ['CH'])],
  [['splitty', 'split finger', 'splitfinger'], set('pt', ['FS'])],
  [['knuckler', 'knucklers'], set('pt', ['KN'])],
  [['cutters', 'cut fastball'], set('pt', ['FC'])],
  // Count.
  [['full count'], set('cnt', ['3-2'])],
  [['ahead in the count', 'batter ahead', 'hitters count', 'ahead in count'], set('cnt', ['ahead'])],
  [['behind in the count', 'batter behind', 'pitchers count', 'behind in count'], set('cnt', ['behind'])],
  [['even count', 'even in the count'], set('cnt', ['even'])],
  [['two strikes', 'two strike count', '2 strikes'], set('cnt', ['0-2', '1-2', '2-2', '3-2'])],
  // Outs (a number word or digit + out/outs, and "nobody out").
  [['nobody out', 'none out', 'no outs', 'no out'], set('out', ['0'])],
  // Runners.
  [['bases empty', 'nobody on', 'empty bases', 'no one on', 'none on'], set('run', ['---'])],
  [['runner on first', 'man on first', 'runner on 1st', 'man on 1st'], set('run', ['1--'])],
  [['runner on second', 'man on second', 'runner on 2nd', 'man on 2nd'], set('run', ['-2-'])],
  [['runner on third', 'man on third', 'runner on 3rd', 'man on 3rd'], set('run', ['--3'])],
  [['first and second', 'runners on first and second', '1st and 2nd'], set('run', ['12-'])],
  [['first and third', 'runners on first and third', 'corners', '1st and 3rd'], set('run', ['1-3'])],
  [['second and third', 'runners on second and third', '2nd and 3rd'], set('run', ['-23'])],
  [['bases loaded', 'bases full', 'bases juiced', 'loaded bases', 'bases are loaded'], set('run', ['123'])],
  [['risp', 'runners in scoring position', 'runner in scoring position', 'scoring position', 'men in scoring position'], set('run', RISP)],
  // Score and moment.
  [['tied', 'tie game', 'tied game', 'game tied', 'the game tied'], set('sc', ['tied'])],
  [['leading', 'ahead', 'with a lead', 'winning'], set('sc', ['ahead'])],
  [['trailing', 'behind', 'losing'], set('sc', ['behind'])],
  [['walk off', 'walkoff', 'walkoffs', 'walk offs', 'game ending', 'game winning'], set('mom', ['walkoff'])],
  [['go ahead', 'goahead', 'lead changing'], set('mom', ['ahead'])],
  [['game tying', 'tying'], set('mom', ['tie'])],
  [['first pa of the game', 'first batter of the game', 'first plate appearance of the game', 'leadoff of the game'], set('mom', ['first'])],
  [['last pa of the game', 'last batter of the game', 'last plate appearance of the game'], set('mom', ['last'])],
  // Batting slot.
  [['leadoff hitter', 'leadoff man', 'batting leadoff', 'leadoff batter', 'leadoff'], set('slot', ['1'])],
  [['cleanup', 'cleanup hitter', 'batting cleanup', 'clean up'], set('slot', ['4'])],
  // Home or road.
  [['at home', 'home team', 'home game', 'home games'], set('ha', ['H'])],
  [['on the road', 'road', 'away from home', 'road game', 'road games', 'away game', 'away games'], set('ha', ['R'])],
  // Game type and series game.
  [['postseason', 'october', 'post season'], set('gt', ['P'])],
  [['regular season'], set('gt', ['R'])],
  [['all star game', 'all star', 'asg'], set('gt', ['A'])],
  [['elimination game', 'potential elimination', 'facing elimination'], set('sg', ['elim'])],
  [['clinching game', 'potential clinch', 'clincher', 'clinching'], set('sg', ['clinch'])],
  [['sudden death', 'winner take all', 'winner takes all'], set('sg', ['sd'])],
  [['series deciding', 'deciding game', 'decider'], set('sg', ['last'])],
  // Innings.
  [['extra innings', 'extras', 'extra inning', 'in extras'], set('inn', ['x'])],
  [['late innings', 'late in the game'], set('inn', ['7', '8', '9', 'x'])],
  [['9th or later', 'ninth or later'], set('inn', ['9', 'x'])],
  // Game mode words.
  [['game', 'games', 'a game where', 'a game in which', 'game where'], (ctx) => ((ctx.game = true), true)],
  [['allowed', 'allow', 'allows', 'gave up', 'give up', 'gives up', 'surrendered', 'yielded'], (ctx) => ((ctx.side = 'pitch'), true)],
  [['scored', 'score', 'scores', 'scoring'], (ctx) => ((ctx.side = 'bat'), true)],
  [['all', 'all of them', 'every run', 'all the runs', 'all their runs', 'all runs'], (ctx) => ((ctx.all = true), true)],
  [['none', 'no runs', 'none of them'], (ctx) => ((ctx.none = true), true)],
  [['in one inning', 'one inning', 'a single inning', 'the same inning', 'same inning'], how('oneinn')],
  [['after the 7th', 'after the seventh', 'in the 8th or later', 'in the eighth or later'], how('late')],
  [['with two outs', 'two outs', '2 outs', 'two out', '2 out'], how('twoout', set('out', ['2']))],
  [['by one batter', 'one batter', 'driven in by one batter', 'by the same batter'], how('onebat')],
]
// Ordinal innings ("9th inning", "in the ninth"), slots ("batting 3rd") and months ("in may").
for (let i = 1; i <= 9; i++) {
  const ords = [ORDINALS[i - 1], `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'}`]
  BASE.push([ords.flatMap((o) => [`${o} inning`, `in the ${o}`, `the ${o} inning`, `in the ${o} inning`]), set('inn', [String(i)])])
  BASE.push([ords.map((o) => `batting ${o}`), set('slot', [String(i)])])
}
for (const [i, m] of MONTHS.entries()) BASE.push([m === 'may' ? ['in may'] : [m, `in ${m}`], set('mon', [String(i + 3).padStart(2, '0')])])
for (const c of FILTER_BY_KEY.cnt.options.map(([v]) => v).filter((v) => /^\d-\d$/.test(v))) BASE.push([[c, `${c} count`, `on ${c}`], set('cnt', [c])])

// The game totals: "<n> <unit>", "<n> or more <unit>", "at least <n> <unit>", "<n>+ <unit>".
const UNITS = { r: ['run', 'runs'], h: ['hit', 'hits'], hr: HR, bb: ['walk', 'walks'], so: ['strikeout', 'strikeouts', 'ks'], pi: ['pitch', 'pitches'] }

// The vocabulary with this page's clubs and people, indexed by first word.
function vocabulary(people) {
  const entries = []
  const add = (phrases, apply, kind) => {
    for (const p of phrases) entries.push({ words: p.split(' '), apply, kind })
  }
  for (const [phrases, apply] of BASE) add(phrases, apply)
  // Clubs: nickname ("brewers", "red sox"), and a city only one club has.
  const cities = {}
  for (const id of ALL_MLB_TEAM_IDS) cities[fold(teamLocationName(id) ?? '')] = (cities[fold(teamLocationName(id) ?? '')] ?? 0) + 1
  for (const id of ALL_MLB_TEAM_IDS) {
    const code = teamAbbr({ id })
    const nick = fold(teamClubName(id) ?? '')
    const city = fold(teamLocationName(id) ?? '')
    const names = [nick, nick.replace(/s$/, ''), cities[city] === 1 ? city : null].filter(Boolean)
    if (nick === 'diamondbacks') names.push('dbacks', 'd backs')
    if (nick === 'athletics') names.push('as')
    add([...new Set(names)], (ctx) => ctx.clubs.push({ code, cue: ctx.cue, at: ctx.at, next: ctx.next }), 'club')
  }
  // People: full name, and a last name only one person on file has.
  const last = {}
  const folded = Object.entries(people ?? {}).map(([id, n]) => [Number(id), tokenize(n).map((t) => t.w)])
  for (const [, ws] of folded) last[ws.at(-1)] = (last[ws.at(-1)] ?? 0) + 1
  for (const [id, ws] of folded) {
    if (!ws.length) continue
    // Game mode has no player picker, so a name there is skipped, not dropped.
    const person = (ctx) => !ctx.game && (ctx.people.push({ id, cue: ctx.cue }), true)
    add([ws.join(' ')], person, 'person')
    if (last[ws.at(-1)] === 1 && ws.length > 1) add([ws.at(-1)], person, 'person')
  }
  const byFirst = new Map()
  for (const e of entries) {
    if (!byFirst.has(e.words[0])) byFirst.set(e.words[0], [])
    byFirst.get(e.words[0]).push(e)
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.words.length - a.words.length)
  return byFirst
}
const vocabCache = new WeakMap()
const NO_PEOPLE = {}
const vocabFor = (people) => {
  const key = people ?? NO_PEOPLE
  if (!vocabCache.has(key)) vocabCache.set(key, vocabulary(key))
  return vocabCache.get(key)
}

// A game total at token i: { key, range, len } or null.
function totalAt(toks, i) {
  const w = (k) => toks[i + k]?.w
  let lo
  let hi
  let n
  let k = 0
  if ((w(0) === 'at' && w(1) === 'least') || (w(0) === 'more' && w(1) === 'than')) {
    n = num(w(2))
    if (n == null) return null
    ;[lo, hi, k] = [w(0) === 'more' ? n + 1 : n, null, 3]
  } else if ((w(0) === 'at' && w(1) === 'most') || (w(0) === 'no' && w(1) === 'more' && w(2) === 'than') || (w(0) === 'fewer' && w(1) === 'than')) {
    const at = w(0) === 'no' ? 3 : 2
    n = num(w(at))
    if (n == null) return null
    ;[lo, hi, k] = [null, w(0) === 'fewer' ? n - 1 : n, at + 1]
  } else {
    const plus = /^(\d{1,3})\+$/.exec(w(0) ?? '')
    n = plus ? Number(plus[1]) : num(w(0))
    if (n == null) return null
    k = 1
    if (plus) [lo, hi] = [n, null]
    else if (w(1) === 'or' && (w(2) === 'more' || w(2) === 'fewer' || w(2) === 'less')) {
      ;[lo, hi] = w(2) === 'more' ? [n, null] : [null, n]
      k = 3
    } else [lo, hi] = [n, n]
  }
  for (const [key, units] of Object.entries(UNITS)) {
    for (const u of units) {
      const uw = u.split(' ')
      if (uw.every((x, j) => toks[i + k + j]?.w === x)) {
        // "or more" after the unit: "6 runs or more".
        let len = k + uw.length
        if (lo === hi && toks[i + len]?.w === 'or' && ['more', 'fewer', 'less'].includes(toks[i + len + 1]?.w)) {
          ;[lo, hi] = toks[i + len + 1].w === 'more' ? [n, null] : [null, n]
          len += 2
        }
        return { key, range: [lo, hi], len }
      }
    }
  }
  return null
}

// Years at token i: "2019", "2015-2019", "2015 to 2019", "since 2015", "between 2015 and 2019".
function yearsAt(toks, i, latest) {
  const y = (w) => (/^(19[6-9]\d|20\d\d)$/.test(w ?? '') ? Number(w) : null)
  const w = (k) => toks[i + k]?.w
  const span = /^(\d{4})-(\d{4})$/.exec(w(0) ?? '')
  if (span && y(span[1]) && y(span[2])) return { years: [y(span[1]), y(span[2])].sort((a, b) => a - b), len: 1 }
  if ((w(0) === 'since' || w(0) === 'after') && y(w(1))) return { years: [y(w(1)) + (w(0) === 'after' ? 1 : 0), latest], len: 2 }
  if (w(0) === 'between' && y(w(1)) && w(2) === 'and' && y(w(3))) return { years: [y(w(1)), y(w(3))].sort((a, b) => a - b), len: 4 }
  if (y(w(0)) && (w(1) === 'to' || w(1) === 'through') && y(w(2))) return { years: [y(w(0)), y(w(2))].sort((a, b) => a - b), len: 3 }
  if (y(w(0))) return { years: [y(w(0)), y(w(0))], len: 1 }
  return null
}

// Outs: "<n> out(s)" (0-2) that no longer phrase claimed.
function outsAt(toks, i) {
  const n = num(toks[i]?.w)
  return n != null && n <= 2 && /^outs?$/.test(toks[i + 1]?.w ?? '') ? { n, len: 2 } : null
}

// THE PARSE. `people` ({ id: name }) and `latest` (the newest season, for "since 2015").
// Returns { q, read, skipped: [{ text, start, end }] }: q in parseQuery's shape; read, the
// count of phrases read; skipped, runs of unread words with their spans in `text`.
export function parseAsk(text, { people = {}, latest = new Date().getFullYear() } = {}) {
  const toks = tokenize(text ?? '')
  const vocab = vocabFor(people)
  const ctx = { q: { chips: {}, ask: 'last' }, how: new Set(), totals: {}, clubs: [], people: [], game: false, side: null, all: false, none: false, cue: false }
  // Game mode is decided before reading, so a play-only chip in a game question is skipped.
  for (let i = 0; i < toks.length; i++) {
    if (totalAt(toks, i)) ctx.game = true
    if (['game', 'games', 'allowed', 'allow', 'surrendered'].includes(toks[i].w)) ctx.game = true
    if (toks[i].w === 'gave' && toks[i + 1]?.w === 'up') ctx.game = true
  }
  const skipped = []
  let read = 0
  let years = null
  let lastSkip = -2
  for (let i = 0; i < toks.length; ) {
    let back = i - 1
    while (back >= 0 && ARTICLES.has(toks[back].w)) back--
    ctx.cue = back >= 0 && ROLE_CUES.has(toks[back].w)
    const total = ctx.game && totalAt(toks, i)
    if (total) {
      ctx.totals[total.key] = total.range
      i += total.len
      read++
      continue
    }
    const yr = yearsAt(toks, i, latest)
    if (yr) {
      years = yr.years
      i += yr.len
      read++
      continue
    }
    const outs = !ctx.all && outsAt(toks, i)
    if (outs) {
      if (!chip(ctx, 'out', [String(outs.n)])) {
        for (let k = 0; k < outs.len; k++) markSkip(i + k)
      } else read++
      i += outs.len
      continue
    }
    const hit = (vocab.get(toks[i].w) ?? []).find((e) => e.words.every((x, j) => toks[i + j]?.w === x))
    if (hit) {
      ctx.next = toks[i + hit.words.length]?.w
      ctx.at = back >= 0 && (toks[back].w === 'at' || toks[back].w === 'in')
      const ok = hit.apply(ctx, toks.slice(i, i + hit.words.length), ctx.next)
      if (ok === false) for (let k = 0; k < hit.words.length; k++) markSkip(i + k)
      else read++
      i += hit.words.length
      continue
    }
    if (!FILLER.has(toks[i].w)) markSkip(i)
    i++
  }
  function markSkip(k) {
    const t = toks[k]
    if (lastSkip === k - 1 && skipped.length) skipped.at(-1).end = t.end
    else skipped.push({ start: t.start, end: t.end })
    lastSkip = k
  }

  // People: after a role cue, the pitcher; otherwise the batter, then the pitcher.
  const q = ctx.q
  for (const p of ctx.people) {
    if (!p.cue && !q.batter) q.batter = p.id
    else q.pitcher ??= p.id
  }
  // Clubs: "at <club>" / "in <city>" is the park; after a cue, or "allowed" in game mode,
  // or before "pitching"/"pitchers", the Pitching club; else the Batting club.
  for (const c of ctx.clubs) {
    const pitching = c.cue || c.next === 'pitching' || c.next === 'pitchers' || c.next === 'pitcher' || c.next === 'staff' || (ctx.game && ctx.side === 'pitch' && !q.pitchTeam)
    if (c.at && !ctx.game) q.park ??= c.code
    else if (pitching && !q.pitchTeam) q.pitchTeam = c.code
    else if (!q.team) q.team = c.code
    else q.pitchTeam ??= c.code
  }
  if (years) q.years = years
  if (ctx.game) {
    q.mode = 'game'
    q.g = { totals: ctx.totals, how: [...ctx.how] }
    if (q.ask === 'what') q.ask = 'last'
  } else {
    q.mode = 'play'
    q.g = null
  }
  const full = { mode: q.mode, g: q.g, chips: q.chips, years: q.years ?? null, batter: q.batter ?? null, pitcher: q.pitcher ?? null, team: q.team ?? null, pitchTeam: q.pitchTeam ?? null, park: q.park ?? null, ask: q.ask, rank: 'count', min: 50 }
  return { q: full, read, skipped: skipped.map(({ start, end }) => ({ start, end, text: text.slice(start, end) })) }
}

// SUGGESTIONS while typing: phrases the parser reads that start with the last word typed.
// [{ text, label }], at most `limit`. A short list of the phrases people reach for; every
// one is in the vocabulary above.
const SUGGEST = [
  ...['last time', 'how often', 'who most', 'what happens after'].map((t) => [t, 'Question']),
  ...FILTER_BY_KEY.res.options.map(([, l]) => [fold(l), 'PA result']),
  ['off a lefty', 'Pitcher hand'], ['off a righty', 'Pitcher hand'], ['a lefty', 'Batter hand'], ['a righty', 'Batter hand'],
  ['opposite field', 'Batted ball location'], ['pulled', 'Batted ball location'],
  ['inner third', 'Location'], ['outer third', 'Location'],
  ...PITCH_TYPES.map((p) => [fold(p.name), 'Pitch type']),
  ['full count', 'Count'], ['0-2 count', 'Count'], ['3-0 count', 'Count'], ['two strikes', 'Count'],
  ['two outs', 'Outs'], ['nobody out', 'Outs'],
  ['bases loaded', 'Runners'], ['bases empty', 'Runners'], ['runners in scoring position', 'Runners'], ['runner on third', 'Runners'],
  ['walk off', 'Moment'], ['go ahead', 'Moment'], ['game tying', 'Moment'], ['tied game', 'Score'],
  ['ground ball', 'Batted ball type'], ['line drive', 'Batted ball type'], ['fly ball', 'Batted ball type'],
  ['leadoff hitter', 'Batting slot'], ['cleanup', 'Batting slot'],
  ['extra innings', 'Inning'], ['9th inning', 'Inning'], ['postseason', 'Game type'], ['on the road', 'Home or road'], ['at home', 'Home or road'],
  ['a game where', 'Games'], ['allowed', 'Games'], ['all on solo home runs', 'How runs scored'], ['all in one inning', 'How runs scored'], ['all with two outs', 'How runs scored'], ['none on a hit', 'How runs scored'],
  ['6 runs', 'Runs'], ['10 strikeouts', 'Strikeouts'], ['3 home runs', 'Home runs'], ['since 2015', 'Seasons'],
]
export function suggest(text, { clubs = [], limit = 4 } = {}) {
  const m = /([\p{L}\p{N}'’-]+)$/u.exec(text ?? '')
  if (!m || m[1].length < 2) return []
  const part = fold(m[1])
  const pool = [...SUGGEST, ...clubs.map((c) => [fold(c), 'Club'])]
  const seen = new Set()
  const out = []
  for (const [t, label] of pool) {
    if (out.length >= limit) break
    if (t.startsWith(part) && t !== part && !seen.has(t)) {
      seen.add(t)
      out.push({ text: t, label })
    }
  }
  return out
}

// Replace the last (partial) word of `text` with a suggestion.
export const applySuggestion = (text, s) => `${text.replace(/[\p{L}\p{N}'’-]+$/u, '')}${s}`
