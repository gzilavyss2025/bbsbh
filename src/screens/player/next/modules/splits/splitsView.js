// The Splits card's pure view (#1886, boards Splits and PitcherSplits). Every table row is one
// "line": the figures as the board prints them, the delta against the table's baseline, the
// best / weak / thin flags and the bar. The reads come from `splitReads` (api/person/stats.js)
// for OPS, and from `eraReads` below for the pitcher's ERA doors. A bat's best is its highest
// OPS; an arm's best is the lowest OPS against, or the lowest ERA.
import { situationalSplitsView, splitReads, splitsView } from '../../../../../api/person/stats.js'
import { doorCells } from '../../../../../api/boxlines/careerSplits.js'
import { FAMILIES, FOLD_FROM, SECTIONS } from '../../../../../api/boxlines/cardFacets.js'
import { ipToOuts } from '../../../../../lib/math/innings.js'

const DASH = '—'
// The bar's full width, in the unit each metric is read in.
const AXIS = { ops: 1.25, era: 8 }
const THIN_OUTS = 60

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : n)
const fixed = (x, digits) => Math.round(x * 10 ** digits) / 10 ** digits
const signed = (x, base, digits) => {
  const gap = Math.abs(x - base).toFixed(digits)
  return Number(gap) === 0 ? gap : `${x > base ? '+' : '−'}${gap}`
}

// The last four seasons from the season prop, none before his debut, then the career.
export function seasonChoices(season, debutYear) {
  const years = [0, 1, 2, 3].map((i) => Number(season) - i).filter((y) => !debutYear || y >= debutYear)
  return [...years.map(String), 'career']
}

export function scopeText(pick, scope) {
  const career = pick === 'career'
  const base = scope === 'P' ? 'Postseason' : scope === 'A' ? 'All games' : career ? 'Career' : 'Season'
  const span =
    scope === 'P'
      ? 'postseason'
      : scope === 'A'
        ? career ? 'regular + postseason' : 'season + postseason'
        : career ? 'regular season' : 'full season'
  return { base, tag: `${career ? 'Career' : pick} · ${span}` }
}

// The bar: how far it fills, and its colour kind.
function fillOf(kind, value, metric) {
  return { kind, scale: value == null ? 0 : fixed(Math.min(1, value / AXIS[metric]), 4) }
}
const tickOf = (base, metric) => (base == null ? null : fixed((base / AXIS[metric]) * 100, 2))
const kindOf = (value, base, thin, pitching) =>
  value == null ? 'none' : thin ? 'thin' : (pitching ? value <= base : value >= base) ? 'pos' : 'neg'

// ---- hand and situational rows (a splitSide of api/person/stats.js) ----

function sideLine(key, label, side, extra) {
  const [avg, ...rest] = String(side.slash).split('/')
  return {
    key, label, ...extra,
    count: fmt(side.count),
    avg,
    rest: rest.length ? `/${rest.join('/')}` : '',
    ops: side.ops,
    hr: String(side.hr),
    k: side.soPct,
    bb: side.bbPct,
  }
}

function sideTable(baseLabel, all, rows, group) {
  const pitching = group === 'pitching'
  const reads = splitReads(rows, all, group)
  const tick = tickOf(all?.opsNum, 'ops')
  return {
    base: all && { ...sideLine('all', baseLabel, all), delta: 'base', fill: fillOf('base', all.opsNum, 'ops'), tick },
    rows: rows.map((r, i) => ({
      ...sideLine(r.key, r.label, r.side, { nested: Boolean(r.nested) }),
      delta: reads[i].delta,
      read: reads[i].read,
      thin: reads[i].thin,
      best: reads[i].flag === 'best',
      weak: reads[i].flag === 'weak',
      fill: fillOf(kindOf(r.side.opsNum, all?.opsNum, reads[i].thin, pitching), r.side.opsNum, 'ops'),
      tick,
    })),
  }
}

export function handTable(raw, group, baseLabel) {
  const v = splitsView(raw, group)
  if (!v) return null
  const pitching = group === 'pitching'
  const rows = [
    { key: 'vl', label: pitching ? 'vs LHB' : 'vs LHP', side: v.left },
    { key: 'vr', label: pitching ? 'vs RHB' : 'vs RHP', side: v.right },
  ]
  return { baseSide: v.all, ...sideTable(baseLabel, v.all, rows, group) }
}

const FAMILY_TITLE = { base: 'Base state', count: 'Count' }

// `baseSide` is the hand table's baseline (vs L + vs R), so both tables read against one line;
// without it the table falls back to its own sum (bases empty + runners on).
export function sitTable(raw, group, baseLabel, baseSide, minRows) {
  const v = situationalSplitsView(raw, group, { minRows })
  if (!v) return null
  const all = baseSide ?? v.all
  const groups = ['base', 'count']
    .map((family) => ({
      family,
      title: FAMILY_TITLE[family],
      rows: v.rows.filter((r) => r.family === family).map((r) => ({ key: r.code, label: r.label, side: r.side, nested: r.sub })),
    }))
    .filter((g) => g.rows.length)
    .map((g) => ({ ...g, rows: sideTable('', all, g.rows, group).rows }))
  return { base: sideTable(baseLabel, all, [], group).base, groups }
}

// ---- door, vs-team and game-line rows (the five or nine cells of doorCells) ----

// One line from a statsapi stat. A games-only door (Started, Substitution) keeps its G and no bar.
export function figLine(key, label, stat, group, entry) {
  const cells = doorCells(entry, stat, group, { wide: group !== 'pitching' })
  if (!cells) return null
  if (entry?.lineKind === 'games') return { key, label, g: cells[0], none: true }
  if (group === 'pitching') {
    const [g, ip, era, k, bb] = cells
    const n = Number.parseFloat(era)
    return { key, label, g, ip, era, k, bb, num: Number.isFinite(n) ? n : null, size: ipToOuts(ip) }
  }
  const [g, pa, avg, hr, ops, obp, slg, k, bb] = cells
  const n = Number.parseFloat(ops)
  return {
    key, label, g, avg, hr, ops,
    count: fmt(Number(pa)),
    rest: `/${obp ?? DASH}/${slg ?? DASH}`,
    k: k ?? DASH,
    bb: bb ?? DASH,
    num: Number.isFinite(n) ? n : null,
    size: Number(pa),
  }
}

// A pitcher's ERA doors: the lowest ERA among rows of 20 IP or more is best.
function eraReads(lines, base) {
  const sound = lines.filter((l) => l.num != null && l.size >= THIN_OUTS).map((l) => l.num)
  const hi = Math.max(...sound)
  const lo = Math.min(...sound)
  return lines.map((l) => {
    const thin = l.num != null && l.size < THIN_OUTS
    const ranked = sound.length > 1 && hi !== lo && l.num != null && !thin
    const delta = base?.num == null || l.num == null ? '' : signed(l.num, base.num, 2)
    return {
      delta,
      thin,
      best: ranked && l.num === lo,
      weak: ranked && l.num === hi,
      read: `${l.label}: ${l.era} ERA${delta ? `, ${delta} against ${base.era} career` : ''}${thin ? ' · under 20 IP' : ''}`,
    }
  })
}

// The baseline row of a door table: its own bar and the tick every other row reads against.
export function asBase(line) {
  const metric = line.era ? 'era' : 'ops'
  return { ...line, delta: 'base', fill: fillOf('base', line.num, metric), tick: tickOf(line.num, metric) }
}

// The lines of ONE group read against the baseline line (best and weak rank inside the group).
export function readFigs(base, lines, group) {
  const pitching = group === 'pitching'
  const metric = pitching ? 'era' : 'ops'
  const ranked = lines.filter((l) => !l.none)
  const reads = pitching
    ? eraReads(ranked, base)
    : splitReads(
        ranked.map((l) => ({ label: l.label, side: { opsNum: l.num, count: l.size, ops: l.ops } })),
        { opsNum: base?.num, ops: base?.ops },
        group,
      ).map((r) => ({ ...r, best: r.flag === 'best', weak: r.flag === 'weak' }))
  const tick = tickOf(base?.num, metric)
  return lines.map((l) => {
    if (l.none) return l
    const r = reads[ranked.indexOf(l)]
    return { ...l, delta: r.delta, read: r.read, thin: r.thin, best: r.best, weak: r.weak, fill: fillOf(kindOf(l.num, base?.num, r.thin, pitching), l.num, metric), tick }
  })
}

// One vs-team line from the shard's career row. A shard written before the generator kept
// OBP, SLG and strikeouts has none: those cells read a dash, never 0%.
export function vsTeamLine(car, label, group) {
  const stat =
    group === 'pitching'
      ? { gamesPlayed: car.g, inningsPitched: car.ip, era: car.era, strikeOuts: car.k, baseOnBalls: car.bb }
      : { gamesPlayed: car.g, plateAppearances: car.pa, avg: car.avg, obp: car.obp, slg: car.slg, ops: car.ops, homeRuns: car.hr, strikeOuts: car.so, baseOnBalls: car.bb }
  const line = figLine('vs', label, stat, group)
  return group === 'pitching' || car.so != null ? line : { ...line, k: DASH }
}

// One club of the strip: its career figure under the logo.
export function clubChip(team, entry, group) {
  const car = entry?.car
  const faced = Boolean(team.has && car)
  const pitching = group === 'pitching'
  const size = !faced ? 0 : pitching ? ipToOuts(car.ip) : Number(car.pa)
  const text = faced ? (pitching ? car.era : car.ops) : DASH
  return {
    id: team.id,
    abbr: team.abbr,
    text,
    faced,
    thin: faced && size < (pitching ? THIN_OUTS : 100),
    aria: faced
      ? `${team.name}, career ${text} ${pitching ? 'ERA' : 'OPS'} in ${pitching ? `${car.ip} IP` : `${car.pa} PA`}`
      : `${team.name}, not faced yet`,
  }
}

// The Game lines sections from the registry (`rows`, cardFacetsFor) and the door labels (a Map
// keyed by door): a door with no games behind it does not exist; a list door stands without a
// figure. Doors sit in their SECTION and a family long enough folds. Best and weak rank inside a
// section's loose doors and inside each folded family. Null without a career line to read against,
// or with no figure door at all (`baseStat` is the career total).
export function gameLinesView({ rows, labels }, baseStat, group) {
  const doors = rows
    .map((row) => ({ row, stat: labels.get(row.key) }))
    .filter(({ row, stat }) => row.list || (stat && Number(stat.gamesPlayed) > 0))
  if (!doors.some(({ row }) => !row.list)) return null
  const baseLine = figLine('career', 'Career', baseStat, group)
  if (!baseLine) return null
  const base = asBase(baseLine)
  const toLine = ({ row, stat }) => (row.list ? { key: row.key, label: row.label, list: true, row } : { ...figLine(row.key, row.label, stat, group, row), row })
  const read = (members) => readFigs(base, members.map(toLine), group)
  const preview = (lines) => {
    const pick = (flag) => {
      const l = lines.find((x) => x[flag])
      return l ? `${l.label.slice(0, 3)} ${l.ops ?? l.era}` : ''
    }
    return { best: pick('best'), weak: pick('weak') }
  }
  const sections = SECTIONS.map((section) => {
    const mine = doors.filter(({ row }) => row.section === section.key)
    const folded = FAMILIES.map((fam) => ({ fam, members: mine.filter(({ row }) => row.family === fam.key) })).filter(({ members }) => members.length >= FOLD_FROM)
    const foldedKeys = new Set(folded.map(({ fam }) => fam.key))
    const loose = mine.filter(({ row }) => !row.family || !foldedKeys.has(row.family))
    const lines = [
      ...readLoose(loose, toLine, base, group),
      ...folded.map(({ fam, members }) => {
        const inside = read(members)
        return { fold: { key: fam.key, title: fam.title, count: inside.length, ...preview(inside), lines: inside } }
      }),
    ]
    return { key: section.key, title: section.title, items: lines }
  }).filter((s) => s.items.length)
  return { base, sections }
}

// The loose doors keep the registry's order; a list door stands unread.
function readLoose(loose, toLine, base, group) {
  const lines = loose.map(toLine)
  const read = readFigs(base, lines.filter((l) => !l.list), group)
  let i = 0
  return lines.map((l) => (l.list ? l : read[i++]))
}

// "7/5" for the season prop's year, "7/5/24" for an earlier one, so a stale meeting reads as old.
export function meetingDate(iso, season) {
  const [y, m, d] = (iso || '').split('-')
  if (!y) return ''
  const md = `${Number(m)}/${Number(d)}`
  return Number(y) === Number(season) ? md : `${md}/${y.slice(2)}`
}
