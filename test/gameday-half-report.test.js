// PINS TODAY'S ENGINE REPORTS (#2747, row 1a). No product code changes here; row 1b lifts the code
// below into src/api/gameday/engine/halfReport.js and these sequences must pass UNCHANGED.
//
// Each half of two trimmed real games (824716, 823035) is replayed one tap at a time, the way
// InningViewer drives the hidden half page, and after every tap we record what PlayByPlay reports up:
//   - InningViewer.jsx:431-434 (revealNextAtBat): the first tap stores count 1, every later tap the
//     reported `nextCap`; screens/gameday/next/steps/subStep.js stepCapAt (:121) turns the count into
//     the cap PlayByPlay gets (sub-step 0, at-bat mode). halfInProgress false, windowed, newest step.
//   - PlayByPlay.jsx:114-126  rawEntries -> effectiveCap snap past the first at-bat -> entries rebuilt
//   - PlayByPlay.jsx:130      exhausted = stepCommitReady (the commit, reported once, then stepCap -> null)
//   - PlayByPlay.jsx:166-176  onStepComplete | onStepInfo { nextCap, isLastStep, lastAtBatIndex, atHalfEdge }
//   - PlayByPlay.jsx:157-158,191-193  wins = focusWindows -> steps; items = buildTrailItems
//   - PlayByPlay.jsx:215-219  stepTotals -> runs, hits
//   - PlayByPlay.jsx:225-233  liveCapFor + (rebuild at liveCap) + deriveLiveState
// A tap record reads: cap (stepCapAt) / eff (effectiveCap) | step report | runs/hits | steps [trail codes]
// | live: bases 1-2-3, outs, pitches since the last change, mid-half pitcher id, batter id, done?, last ab.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { halfReport } from '../src/api/gameday/engine/halfReport.js'
import { stepCapAt } from '../src/screens/gameday/next/steps/subStep.js'

const load = (pk) => JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url), 'utf8'))

// One render of PlayByPlay at `stepCap` (null once committed): the values its effects report.
// Row 1b: the arithmetic is the lifted halfReport; the line format below is unchanged.
function render(feed, inning, half, side, stepCap) {
  const stepping = stepCap != null
  const r = halfReport(feed, inning, half, side, stepCap, { halfInProgress: false, windowed: true, focusStep: null, codeOf: () => '' })
  const { effectiveCap, exhausted, nextCap, entries, runs, hits, items, live: l } = r
  const wins = { length: r.steps }
  const reporting = stepping && entries.length > 0 // PlayByPlay.jsx:167 returns early otherwise
  const report = exhausted
    ? 'COMMIT'
    : `next ${nextCap} last ${r.isLastStep ? 1 : 0} ab ${r.lastAtBatIndex} edge ${r.atHalfEdge ? 1 : 0}`
  const bases = [l.bases.first, l.bases.second, l.bases.third].map((b) => (b ? 1 : 0)).join('')
  return {
    exhausted, nextCap,
    line: `cap ${stepCap} eff ${effectiveCap} | ${reporting ? report : '-'} | ${stepping ? `${runs}/${hits}` : '-'} | ${wins.length} [${items.map((i) => `${i.name}:${i.code}${i.atBatIndex != null ? '#' + i.atBatIndex : ''}`).join(' ')}] | ${bases} o${l.outs} p${l.pitchesSoFar} m${l.midHalfPitcherId ?? '-'} b${l.batter?.id ?? '-'} ${l.batterDone ? 'done' : 'open'} l${l.last?.atBatIndex ?? '-'}`,
  }
}

function replay(feed, inning, half) {
  const side = half === 'top' ? 'away' : 'home'
  const lines = []
  let count = 1 // InningViewer.jsx:432: the half's first tap stores 1
  for (let guard = 0; guard < 60; guard++) {
    const r = render(feed, inning, half, side, stepCapAt(feed, inning, half, count, 0))
    lines.push(r.line)
    if (r.exhausted) break
    count = r.nextCap
  }
  lines.push(render(feed, inning, half, side, null).line) // after the commit: stepCap null, full half
  return lines
}

const halves = (feed) => [...new Set(feed.liveData.plays.allPlays.map((p) => `${p.about.inning}${p.about.halfInning}`))]
const EXPECTED = {
  824716: {
    '1top': [
      'cap 1 eff 1 | next 2 last 0 ab 0 edge 0 | 0/0 | 1 [Arozarena:6-3#0] | 000 o1 p3 m- b668227 done l0',
      'cap 2 eff 2 | next 3 last 0 ab 1 edge 0 | 1/1 | 2 [Arozarena:6-3#0 Canzone:HR#1] | 000 o1 p6 m- b686527 done l1',
      'cap 3 eff 3 | next 4 last 1 ab 2 edge 0 | 1/1 | 3 [Arozarena:6-3#0 Canzone:HR#1 Rodríguez:5-3#2] | 000 o2 p8 m- b677594 done l2',
      'cap 4 eff 4 | COMMIT | 1/1 | 4 [Arozarena:6-3#0 Canzone:HR#1 Rodríguez:5-3#2 Raleigh:1-3#3] | 000 o3 p11 m- b663728 done l3',
      'cap null eff null | - | - | 4 [Arozarena:6-3#0 Canzone:HR#1 Rodríguez:5-3#2 Raleigh:1-3#3] | 000 o3 p11 m- b663728 done l3',
    ],
    '1bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 4 edge 0 | 0/0 | 1 [Anthony:K#4] | 000 o1 p5 m- b701350 done l4',
      'cap 2 eff 2 | next 3 last 0 ab 5 edge 0 | 1/1 | 2 [Anthony:K#4 Gasper:HR#5] | 000 o1 p6 m- b681508 done l5',
      'cap 3 eff 3 | next 4 last 1 ab 6 edge 0 | 1/1 | 3 [Anthony:K#4 Gasper:HR#5 Rafaela:K#6] | 000 o2 p9 m- b678882 done l6',
      'cap 4 eff 4 | COMMIT | 1/1 | 4 [Anthony:K#4 Gasper:HR#5 Rafaela:K#6 Abreu:4-3#7] | 000 o3 p15 m- b677800 done l7',
      'cap null eff null | - | - | 4 [Anthony:K#4 Gasper:HR#5 Rafaela:K#6 Abreu:4-3#7] | 000 o3 p15 m- b677800 done l7',
    ],
    '2top': [
      'cap 1 eff 1 | next 2 last 0 ab 8 edge 0 | 0/1 | 1 [Naylor:2B#8] | 010 o0 p3 m- b647304 done l8',
      'cap 2 eff 2 | next 3 last 0 ab 9 edge 0 | 0/2 | 2 [Naylor:2B#8 Young:1B#9] | 101 o0 p5 m- b702284 done l9',
      'cap 3 eff 3 | next 4 last 0 ab 10 edge 0 | 0/2 | 3 [Naylor:2B#8 Young:1B#9 Montes:BB#10] | 111 o0 p10 m- b703155 done l10',
      'cap 4 eff 4 | next 6 last 0 ab 11 edge 0 | 1/2 | 4 [Naylor:2B#8 Young:1B#9 Montes:BB#10 Crawford:SF9#11] | 101 o1 p14 m- b641487 done l11',
      'cap 6 eff 6 | next 7 last 0 ab 12 edge 0 | 2/3 | 5 [Naylor:2B#8 Young:1B#9 Montes:BB#10 Crawford:SF9#11 Rodden:1B#12] | 110 o1 p18 m- b801126 done l12',
      'cap 7 eff 7 | next 8 last 0 ab 13 edge 0 | 5/4 | 6 [Naylor:2B#8 Young:1B#9 Montes:BB#10 Crawford:SF9#11 Rodden:1B#12 Arozarena:HR#13] | 000 o1 p22 m- b668227 done l13',
      'cap 8 eff 8 | next 9 last 1 ab 14 edge 0 | 5/4 | 7 [Naylor:2B#8 Young:1B#9 Montes:BB#10 Crawford:SF9#11 Rodden:1B#12 Arozarena:HR#13 Canzone:4-3#14] | 000 o2 p23 m- b686527 done l14',
      'cap 9 eff 9 | COMMIT | 5/4 | 8 [Naylor:2B#8 Young:1B#9 Montes:BB#10 Crawford:SF9#11 Rodden:1B#12 Arozarena:HR#13 Canzone:4-3#14 Rodríguez:K#15] | 000 o3 p28 m- b677594 done l15',
      'cap null eff null | - | - | 8 [Naylor:2B#8 Young:1B#9 Montes:BB#10 Crawford:SF9#11 Rodden:1B#12 Arozarena:HR#13 Canzone:4-3#14 Rodríguez:K#15] | 000 o3 p28 m- b677594 done l15',
    ],
    '2bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 16 edge 0 | 0/1 | 1 [Sogard:1B#16] | 100 o0 p4 m- b686765 done l16',
      'cap 2 eff 2 | next 3 last 0 ab 17 edge 0 | 0/1 | 2 [Sogard:1B#16 Durbin:FC#17] | 100 o1 p5 m- b702332 done l17',
      'cap 3 eff 3 | next 4 last 1 ab 18 edge 0 | 0/1 | 3 [Sogard:1B#16 Durbin:FC#17 Duran:K#18] | 100 o2 p9 m- b680776 done l18',
      'cap 4 eff 4 | COMMIT | 0/1 | 4 [Sogard:1B#16 Durbin:FC#17 Duran:K#18 Story:FP3#19] | 100 o3 p12 m- b596115 done l19',
      'cap null eff null | - | - | 4 [Sogard:1B#16 Durbin:FC#17 Duran:K#18 Story:FP3#19] | 100 o3 p12 m- b596115 done l19',
    ],
    '3top': [
      'cap 1 eff 1 | next 2 last 0 ab 20 edge 0 | 0/0 | 1 [Raleigh:4-3#20] | 000 o1 p4 m- b663728 done l20',
      'cap 2 eff 2 | next 3 last 0 ab 21 edge 0 | 0/1 | 2 [Raleigh:4-3#20 Naylor:1B#21] | 100 o1 p5 m- b647304 done l21',
      'cap 3 eff 3 | next 4 last 0 ab 22 edge 0 | 0/2 | 3 [Raleigh:4-3#20 Naylor:1B#21 Young:1B#22] | 101 o1 p7 m- b702284 done l22',
      'cap 4 eff 4 | next 6 last 0 ab 23 edge 0 | 1/3 | 4 [Raleigh:4-3#20 Naylor:1B#21 Young:1B#22 Montes:1B#23] | 110 o1 p11 m- b703155 done l23',
      'cap 6 eff 6 | next 7 last 0 ab 24 edge 0 | 1/3 | 5 [Raleigh:4-3#20 Naylor:1B#21 Young:1B#22 Montes:1B#23 Crawford:BB#24] | 111 o1 p17 m- b641487 done l24',
      'cap 7 eff 7 | next 8 last 1 ab 25 edge 0 | 1/3 | 6 [Raleigh:4-3#20 Naylor:1B#21 Young:1B#22 Montes:1B#23 Crawford:BB#24 Rodden:K#25] | 111 o2 p22 m- b801126 done l25',
      'cap 8 eff 8 | COMMIT | 1/3 | 7 [Raleigh:4-3#20 Naylor:1B#21 Young:1B#22 Montes:1B#23 Crawford:BB#24 Rodden:K#25 Arozarena:K#26] | 111 o3 p30 m- b668227 done l26',
      'cap null eff null | - | - | 7 [Raleigh:4-3#20 Naylor:1B#21 Young:1B#22 Montes:1B#23 Crawford:BB#24 Rodden:K#25 Arozarena:K#26] | 111 o3 p30 m- b668227 done l26',
    ],
    '3bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 27 edge 0 | 0/0 | 1 [Wong:F9#27] | 000 o1 p4 m- b657136 done l27',
      'cap 2 eff 2 | next 3 last 0 ab 28 edge 0 | 0/0 | 2 [Wong:F9#27 Anthony:3-1#28] | 000 o2 p7 m- b701350 done l28',
      'cap 3 eff 3 | next 4 last 1 ab 29 edge 0 | 0/0 | 3 [Wong:F9#27 Anthony:3-1#28 Gasper:BB#29] | 100 o2 p11 m- b681508 done l29',
      'cap 4 eff 4 | COMMIT | 0/0 | 4 [Wong:F9#27 Anthony:3-1#28 Gasper:BB#29 Rafaela:K#30] | 100 o3 p18 m- b678882 done l30',
      'cap null eff null | - | - | 4 [Wong:F9#27 Anthony:3-1#28 Gasper:BB#29 Rafaela:K#30] | 100 o3 p18 m- b678882 done l30',
    ],
    '4top': [
      'cap 1 eff 1 | next 2 last 0 ab 31 edge 0 | 0/0 | 1 [Canzone:3U#31] | 000 o1 p3 m- b686527 done l31',
      'cap 2 eff 2 | next 3 last 0 ab 32 edge 0 | 0/1 | 2 [Canzone:3U#31 Rodríguez:2B#32] | 010 o1 p8 m- b677594 done l32',
      'cap 3 eff 3 | next 6 last 0 ab 33 edge 0 | 1/2 | 3 [Canzone:3U#31 Rodríguez:2B#32 Raleigh:2B#33] | 010 o1 p9 m- b663728 done l33',
      'cap 5 eff 5 | next 7 last 1 ab 34 edge 0 | 1/2 | 4 [Canzone:3U#31 Rodríguez:2B#32 Raleigh:2B#33 Naylor:F8#34] | 010 o2 p18 m- b647304 done l34',
      'cap 7 eff 7 | COMMIT | 1/2 | 5 [Canzone:3U#31 Rodríguez:2B#32 Raleigh:2B#33 Naylor:F8#34 Young:K#35] | 010 o3 p7 m681544 b702284 done l35',
      'cap null eff null | - | - | 5 [Canzone:3U#31 Rodríguez:2B#32 Raleigh:2B#33 Naylor:F8#34 Young:K#35] | 010 o3 p7 m681544 b702284 done l35',
    ],
    '4bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 36 edge 0 | 0/1 | 1 [Abreu:1B#36] | 100 o0 p6 m- b677800 done l36',
      'cap 2 eff 2 | next 3 last 0 ab 37 edge 0 | 0/1 | 2 [Abreu:1B#36 Sogard:L5#37] | 100 o1 p12 m- b686765 done l37',
      'cap 3 eff 3 | next 4 last 1 ab 38 edge 0 | 0/1 | 3 [Abreu:1B#36 Sogard:L5#37 Durbin:FP3#38] | 100 o2 p15 m- b702332 done l38',
      'cap 4 eff 4 | COMMIT | 0/1 | 4 [Abreu:1B#36 Sogard:L5#37 Durbin:FP3#38 Duran:4-3#39] | 100 o3 p21 m- b680776 done l39',
      'cap null eff null | - | - | 4 [Abreu:1B#36 Sogard:L5#37 Durbin:FP3#38 Duran:4-3#39] | 100 o3 p21 m- b680776 done l39',
    ],
    '5top': [
      'cap 1 eff 1 | next 2 last 0 ab 40 edge 0 | 1/1 | 1 [Montes:HR#40] | 000 o0 p5 m- b703155 done l40',
      'cap 2 eff 2 | next 3 last 0 ab 41 edge 0 | 1/2 | 2 [Montes:HR#40 Crawford:2B#41] | 010 o0 p10 m- b641487 done l41',
      'cap 3 eff 3 | next 4 last 0 ab 42 edge 0 | 1/2 | 3 [Montes:HR#40 Crawford:2B#41 Rodden:BB#42] | 110 o0 p14 m- b801126 done l42',
      'cap 4 eff 4 | next 5 last 0 ab 43 edge 0 | 1/2 | 4 [Montes:HR#40 Crawford:2B#41 Rodden:BB#42 Arozarena:L4#43] | 110 o1 p17 m- b668227 done l43',
      'cap 5 eff 5 | next 6 last 1 ab 44 edge 0 | 1/2 | 5 [Montes:HR#40 Crawford:2B#41 Rodden:BB#42 Arozarena:L4#43 Canzone:K#44] | 110 o2 p22 m- b686527 done l44',
      'cap 6 eff 6 | COMMIT | 1/2 | 6 [Montes:HR#40 Crawford:2B#41 Rodden:BB#42 Arozarena:L4#43 Canzone:K#44 Rodríguez:P5#45] | 110 o3 p26 m- b677594 done l45',
      'cap null eff null | - | - | 6 [Montes:HR#40 Crawford:2B#41 Rodden:BB#42 Arozarena:L4#43 Canzone:K#44 Rodríguez:P5#45] | 110 o3 p26 m- b677594 done l45',
    ],
    '5bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 46 edge 0 | 0/1 | 1 [Story:2B#46] | 010 o0 p3 m- b596115 done l46',
      'cap 2 eff 2 | next 3 last 0 ab 47 edge 0 | 0/1 | 2 [Story:2B#46 Wong:K#47] | 010 o1 p7 m- b657136 done l47',
      'cap 3 eff 3 | next 4 last 1 ab 48 edge 0 | 0/1 | 3 [Story:2B#46 Wong:K#47 Anthony:L6#48] | 010 o2 p8 m- b701350 done l48',
      'cap 4 eff 4 | COMMIT | 0/1 | 4 [Story:2B#46 Wong:K#47 Anthony:L6#48 Gasper:K#49] | 010 o3 p12 m- b681508 done l49',
      'cap null eff null | - | - | 4 [Story:2B#46 Wong:K#47 Anthony:L6#48 Gasper:K#49] | 010 o3 p12 m- b681508 done l49',
    ],
    '6top': [
      'cap 1 eff 1 | next 2 last 0 ab 50 edge 0 | 0/0 | 1 [Raleigh:P2#50] | 000 o1 p6 m- b663728 done l50',
      'cap 2 eff 2 | next 3 last 1 ab 51 edge 0 | 0/0 | 2 [Raleigh:P2#50 Naylor:F7#51] | 000 o2 p12 m- b647304 done l51',
      'cap 3 eff 3 | COMMIT | 0/0 | 3 [Raleigh:P2#50 Naylor:F7#51 Young:F8#52] | 000 o3 p20 m- b702284 done l52',
      'cap null eff null | - | - | 3 [Raleigh:P2#50 Naylor:F7#51 Young:F8#52] | 000 o3 p20 m- b702284 done l52',
    ],
    '6bottom': [
      'cap 2 eff 2 | next 3 last 0 ab 53 edge 0 | 0/0 | 1 [Rafaela:P6#53] | 000 o1 p3 m- b678882 done l53',
      'cap 3 eff 3 | next 4 last 0 ab 54 edge 0 | 0/1 | 2 [Rafaela:P6#53 Abreu:2B#54] | 010 o1 p6 m- b677800 done l54',
      'cap 4 eff 4 | next 5 last 0 ab 55 edge 0 | 0/1 | 3 [Rafaela:P6#53 Abreu:2B#54 Sogard:K#55] | 010 o2 p12 m- b686765 done l55',
      'cap 5 eff 5 | next 8 last 1 ab 56 edge 0 | 1/1 | 4 [Rafaela:P6#53 Abreu:2B#54 Sogard:K#55 Durbin:E5#56] | 010 o2 p15 m- b702332 done l56',
      'cap 8 eff 8 | COMMIT | 1/1 | 5 [Rafaela:P6#53 Abreu:2B#54 Sogard:K#55 Durbin:E5#56 Duran:4-3#57] | 001 o3 p21 m- b680776 done l57',
      'cap null eff null | - | - | 5 [Rafaela:P6#53 Abreu:2B#54 Sogard:K#55 Durbin:E5#56 Duran:4-3#57] | 001 o3 p21 m- b680776 done l57',
    ],
    '7top': [
      'cap 3 eff 3 | next 4 last 0 ab 58 edge 0 | 0/0 | 1 [Montes:P5#58] | 000 o1 p1 m- b703155 done l58',
      'cap 4 eff 4 | next 5 last 0 ab 59 edge 0 | 0/1 | 2 [Montes:P5#58 Crawford:1B#59] | 100 o1 p6 m- b641487 done l59',
      'cap 5 eff 5 | next 6 last 0 ab 60 edge 0 | 0/1 | 3 [Montes:P5#58 Crawford:1B#59 Rodden:BB#60] | 110 o1 p11 m- b801126 done l60',
      'cap 6 eff 6 | next 7 last 1 ab 61 edge 0 | 0/1 | 4 [Montes:P5#58 Crawford:1B#59 Rodden:BB#60 Arozarena:K#61] | 110 o2 p14 m- b668227 done l61',
      'cap 7 eff 7 | COMMIT | 0/1 | 5 [Montes:P5#58 Crawford:1B#59 Rodden:BB#60 Arozarena:K#61 Canzone:F8#62] | 110 o3 p17 m- b686527 done l62',
      'cap null eff null | - | - | 5 [Montes:P5#58 Crawford:1B#59 Rodden:BB#60 Arozarena:K#61 Canzone:F8#62] | 110 o3 p17 m- b686527 done l62',
    ],
    '7bottom': [
      'cap 2 eff 2 | next 3 last 0 ab 63 edge 0 | 0/0 | 1 [Story:K#63] | 000 o1 p5 m- b596115 done l63',
      'cap 3 eff 3 | next 5 last 0 ab 64 edge 0 | 0/0 | 2 [Story:K#63 Wong:BB#64] | 100 o1 p9 m- b657136 done l64',
      'cap 5 eff 5 | next 6 last 0 ab 65 edge 0 | 0/1 | 3 [Story:K#63 Wong:BB#64 Anthony:1B#65] | 110 o1 p14 m- b701350 done l65',
      'cap 6 eff 6 | next 9 last 0 ab 66 edge 0 | 0/1 | 4 [Story:K#63 Wong:BB#64 Anthony:1B#65 Gasper:FC#66] | 101 o2 p18 m- b681508 done l66',
      'cap 8 eff 8 | next 10 last 1 ab 67 edge 0 | 2/2 | 5 [Story:K#63 Wong:BB#64 Anthony:1B#65 Gasper:FC#66 White:2B#67] | 010 o2 p20 m- b642201 done l67',
      'cap 10 eff 10 | COMMIT | 2/2 | 6 [Story:K#63 Wong:BB#64 Anthony:1B#65 Gasper:FC#66 White:2B#67 Abreu:L7#68] | 010 o3 p4 m678606 b677800 done l68',
      'cap null eff null | - | - | 6 [Story:K#63 Wong:BB#64 Anthony:1B#65 Gasper:FC#66 White:2B#67 Abreu:L7#68] | 010 o3 p4 m678606 b677800 done l68',
    ],
    '8top': [
      'cap 1 eff 1 | next 2 last 0 ab 69 edge 0 | 0/0 | 1 [Rodríguez:5-3#69] | 000 o1 p3 m- b677594 done l69',
      'cap 2 eff 2 | next 3 last 1 ab 70 edge 0 | 0/0 | 2 [Rodríguez:5-3#69 Raleigh:K#70] | 000 o2 p7 m- b663728 done l70',
      'cap 3 eff 3 | COMMIT | 0/0 | 3 [Rodríguez:5-3#69 Raleigh:K#70 Naylor:4-3#71] | 000 o3 p10 m- b647304 done l71',
      'cap null eff null | - | - | 3 [Rodríguez:5-3#69 Raleigh:K#70 Naylor:4-3#71] | 000 o3 p10 m- b647304 done l71',
    ],
    '8bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 72 edge 0 | 0/0 | 1 [Kiner-Falefa:FP2#72] | 000 o1 p4 m- b643396 done l72',
      'cap 2 eff 2 | next 3 last 0 ab 73 edge 0 | 0/0 | 2 [Kiner-Falefa:FP2#72 Durbin:K#73] | 000 o2 p8 m- b702332 done l73',
      'cap 3 eff 3 | next 5 last 0 ab 74 edge 0 | 0/1 | 3 [Kiner-Falefa:FP2#72 Durbin:K#73 Duran:1B#74] | 100 o2 p10 m- b680776 done l74',
      'cap 5 eff 5 | next 6 last 1 ab 75 edge 0 | 0/2 | 4 [Kiner-Falefa:FP2#72 Durbin:K#73 Duran:1B#74 Story:1B#75] | 110 o2 p12 m- b596115 done l75',
      'cap 6 eff 6 | COMMIT | 0/2 | 5 [Kiner-Falefa:FP2#72 Durbin:K#73 Duran:1B#74 Story:1B#75 Wong:FC#76] | 110 o3 p14 m- b657136 done l76',
      'cap null eff null | - | - | 5 [Kiner-Falefa:FP2#72 Durbin:K#73 Duran:1B#74 Story:1B#75 Wong:FC#76] | 110 o3 p14 m- b657136 done l76',
    ],
    '9top': [
      'cap 1 eff 1 | next 2 last 0 ab 77 edge 0 | 0/0 | 1 [Young:BB#77] | 100 o0 p7 m- b702284 done l77',
      'cap 2 eff 2 | next 3 last 0 ab 78 edge 0 | 0/0 | 2 [Young:BB#77 Montes:K#78] | 100 o1 p11 m- b703155 done l78',
      'cap 3 eff 3 | next 4 last 0 ab 79 edge 0 | 0/0 | 3 [Young:BB#77 Montes:K#78 Crawford:F8#79] | 100 o2 p14 m- b641487 done l79',
      'cap 4 eff 4 | next 5 last 1 ab 80 edge 0 | 0/1 | 4 [Young:BB#77 Montes:K#78 Crawford:F8#79 Rodden:1B#80] | 110 o2 p18 m- b801126 done l80',
      'cap 5 eff 5 | COMMIT | 0/1 | 5 [Young:BB#77 Montes:K#78 Crawford:F8#79 Rodden:1B#80 Robles:6-3#81] | 110 o3 p19 m- b645302 done l81',
      'cap null eff null | - | - | 5 [Young:BB#77 Montes:K#78 Crawford:F8#79 Rodden:1B#80 Robles:6-3#81] | 110 o3 p19 m- b645302 done l81',
    ],
    '9bottom': [
      'cap 1 eff 1 | next 3 last 0 ab 82 edge 0 | 0/1 | 1 [Anthony:1B#82] | 100 o0 p1 m- b701350 done l82',
      'cap 3 eff 3 | next 6 last 0 ab 83 edge 0 | 2/2 | 2 [Anthony:1B#82 Jones:HR#83] | 000 o0 p3 m- b663330 done l83',
      'cap 5 eff 5 | next 7 last 0 ab 84 edge 0 | 2/2 | 3 [Anthony:1B#82 Jones:HR#83 White:L1#84] | 000 o1 p7 m- b642201 done l84',
      'cap 7 eff 7 | next 8 last 1 ab 85 edge 0 | 2/2 | 4 [Anthony:1B#82 Jones:HR#83 White:L1#84 Abreu:K#85] | 000 o2 p3 m662253 b677800 done l85',
      'cap 8 eff 8 | COMMIT | 2/2 | 5 [Anthony:1B#82 Jones:HR#83 White:L1#84 Abreu:K#85 Kiner-Falefa:4-3#86] | 000 o3 p4 m662253 b643396 done l86',
      'cap null eff null | - | - | 5 [Anthony:1B#82 Jones:HR#83 White:L1#84 Abreu:K#85 Kiner-Falefa:4-3#86] | 000 o3 p4 m662253 b643396 done l86',
    ],
  },
  823035: {
    '1top': [
      'cap 1 eff 1 | next 2 last 0 ab 0 edge 0 | 0/0 | 1 [Yelich:6-3#0] | 000 o1 p8 m- b592885 done l0',
      'cap 2 eff 2 | next 3 last 0 ab 1 edge 0 | 0/0 | 2 [Yelich:6-3#0 Lara:6-3#1] | 000 o2 p15 m- b800325 done l1',
      'cap 3 eff 3 | next 4 last 1 ab 2 edge 0 | 0/1 | 3 [Yelich:6-3#0 Lara:6-3#1 Turang:2B#2] | 010 o2 p18 m- b668930 done l2',
      'cap 4 eff 4 | COMMIT | 0/1 | 4 [Yelich:6-3#0 Lara:6-3#1 Turang:2B#2 Vaughn:K#3] | 010 o3 p24 m- b683734 done l3',
      'cap null eff null | - | - | 4 [Yelich:6-3#0 Lara:6-3#1 Turang:2B#2 Vaughn:K#3] | 010 o3 p24 m- b683734 done l3',
    ],
    '1bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 4 edge 0 | 0/0 | 1 [Wetherholt:5-3#4] | 000 o1 p6 m- b802139 done l4',
      'cap 2 eff 2 | next 3 last 0 ab 5 edge 0 | 0/0 | 2 [Wetherholt:5-3#4 Herrera:FP3#5] | 000 o2 p10 m- b671056 done l5',
      'cap 3 eff 3 | next 4 last 1 ab 6 edge 0 | 0/1 | 3 [Wetherholt:5-3#4 Herrera:FP3#5 Walker:1B#6] | 100 o2 p11 m- b691023 done l6',
      'cap 4 eff 4 | COMMIT | 0/1 | 4 [Wetherholt:5-3#4 Herrera:FP3#5 Walker:1B#6 Velázquez:F4#7] | 100 o3 p12 m- b676369 done l7',
      'cap null eff null | - | - | 4 [Wetherholt:5-3#4 Herrera:FP3#5 Walker:1B#6 Velázquez:F4#7] | 100 o3 p12 m- b676369 done l7',
    ],
    '2top': [
      'cap 1 eff 1 | next 2 last 0 ab 8 edge 0 | 0/0 | 1 [Bauers:F6#8] | 000 o1 p1 m- b641343 done l8',
      'cap 2 eff 2 | next 3 last 1 ab 9 edge 0 | 0/0 | 2 [Bauers:F6#8 Sánchez:L8#9] | 000 o2 p5 m- b596142 done l9',
      'cap 3 eff 3 | COMMIT | 0/0 | 3 [Bauers:F6#8 Sánchez:L8#9 Frelick:L9#10] | 000 o3 p8 m- b686217 done l10',
      'cap null eff null | - | - | 3 [Bauers:F6#8 Sánchez:L8#9 Frelick:L9#10] | 000 o3 p8 m- b686217 done l10',
    ],
    '2bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 11 edge 0 | 0/0 | 1 [Burleson:K#11] | 000 o1 p4 m- b676475 done l11',
      'cap 2 eff 2 | next 3 last 0 ab 12 edge 0 | 0/0 | 2 [Burleson:K#11 Winn:L9#12] | 000 o2 p5 m- b691026 done l12',
      'cap 3 eff 3 | next 4 last 1 ab 13 edge 0 | 0/1 | 3 [Burleson:K#11 Winn:L9#12 Fermín:1B#13] | 100 o2 p7 m- b665877 done l13',
      'cap 4 eff 4 | COMMIT | 0/1 | 4 [Burleson:K#11 Winn:L9#12 Fermín:1B#13 Jordan:FC#14] | 100 o3 p10 m- b691458 done l14',
      'cap null eff null | - | - | 4 [Burleson:K#11 Winn:L9#12 Fermín:1B#13 Jordan:FC#14] | 100 o3 p10 m- b691458 done l14',
    ],
    '3top': [
      'cap 1 eff 1 | next 2 last 0 ab 15 edge 0 | 0/1 | 1 [Pratt:3B#15] | 001 o0 p4 m- b806198 done l15',
      'cap 2 eff 2 | next 3 last 0 ab 16 edge 0 | 0/1 | 2 [Pratt:3B#15 Ortiz:K#16] | 001 o1 p8 m- b687401 done l16',
      'cap 3 eff 3 | next 4 last 1 ab 17 edge 0 | 1/1 | 3 [Pratt:3B#15 Ortiz:K#16 Yelich:6-3#17] | 000 o2 p11 m- b592885 done l17',
      'cap 4 eff 4 | COMMIT | 1/1 | 4 [Pratt:3B#15 Ortiz:K#16 Yelich:6-3#17 Lara:L9#18] | 000 o3 p12 m- b800325 done l18',
      'cap null eff null | - | - | 4 [Pratt:3B#15 Ortiz:K#16 Yelich:6-3#17 Lara:L9#18] | 000 o3 p12 m- b800325 done l18',
    ],
    '3bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 19 edge 0 | 0/0 | 1 [Church:L9#19] | 000 o1 p3 m- b701675 done l19',
      'cap 2 eff 2 | next 3 last 0 ab 20 edge 0 | 0/0 | 2 [Church:L9#19 Wetherholt:L9#20] | 000 o2 p6 m- b802139 done l20',
      'cap 3 eff 3 | next 4 last 1 ab 21 edge 0 | 0/0 | 3 [Church:L9#19 Wetherholt:L9#20 Herrera:BB#21] | 100 o2 p11 m- b671056 done l21',
      'cap 4 eff 4 | COMMIT | 0/0 | 4 [Church:L9#19 Wetherholt:L9#20 Herrera:BB#21 Walker:5-3#22] | 100 o3 p13 m- b691023 done l22',
      'cap null eff null | - | - | 4 [Church:L9#19 Wetherholt:L9#20 Herrera:BB#21 Walker:5-3#22] | 100 o3 p13 m- b691023 done l22',
    ],
    '4top': [
      'cap 1 eff 1 | next 2 last 0 ab 23 edge 0 | 0/0 | 1 [Turang:4-3#23] | 000 o1 p5 m- b668930 done l23',
      'cap 2 eff 2 | next 3 last 1 ab 24 edge 0 | 0/0 | 2 [Turang:4-3#23 Vaughn:F7#24] | 000 o2 p9 m- b683734 done l24',
      'cap 3 eff 3 | COMMIT | 0/0 | 3 [Turang:4-3#23 Vaughn:F7#24 Bauers:K#25] | 000 o3 p13 m- b641343 done l25',
      'cap null eff null | - | - | 3 [Turang:4-3#23 Vaughn:F7#24 Bauers:K#25] | 000 o3 p13 m- b641343 done l25',
    ],
    '4bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 26 edge 0 | 0/0 | 1 [Velázquez:F4#26] | 000 o1 p2 m- b676369 done l26',
      'cap 2 eff 2 | next 3 last 1 ab 27 edge 0 | 0/0 | 2 [Velázquez:F4#26 Burleson:4-3#27] | 000 o2 p3 m- b676475 done l27',
      'cap 3 eff 3 | COMMIT | 0/0 | 3 [Velázquez:F4#26 Burleson:4-3#27 Winn:K#28] | 000 o3 p7 m- b691026 done l28',
      'cap null eff null | - | - | 3 [Velázquez:F4#26 Burleson:4-3#27 Winn:K#28] | 000 o3 p7 m- b691026 done l28',
    ],
    '5top': [
      'cap 1 eff 1 | next 2 last 0 ab 29 edge 0 | 0/0 | 1 [Sánchez:BB#29] | 100 o0 p5 m- b596142 done l29',
      'cap 2 eff 2 | next 3 last 0 ab 30 edge 0 | 0/0 | 2 [Sánchez:BB#29 Frelick:F8#30] | 100 o1 p9 m- b686217 done l30',
      'cap 3 eff 3 | next 4 last 0 ab 31 edge 0 | 0/0 | 3 [Sánchez:BB#29 Frelick:F8#30 Pratt:BB#31] | 110 o1 p15 m- b806198 done l31',
      'cap 4 eff 4 | next 5 last 0 ab 32 edge 0 | 0/1 | 4 [Sánchez:BB#29 Frelick:F8#30 Pratt:BB#31 Ortiz:1B#32] | 111 o1 p17 m- b687401 done l32',
      'cap 5 eff 5 | next 6 last 0 ab 33 edge 0 | 0/1 | 5 [Sánchez:BB#29 Frelick:F8#30 Pratt:BB#31 Ortiz:1B#32 Yelich:K#33] | 111 o2 p23 m- b592885 done l33',
      'cap 6 eff 6 | next 7 last 1 ab 34 edge 0 | 2/2 | 6 [Sánchez:BB#29 Frelick:F8#30 Pratt:BB#31 Ortiz:1B#32 Yelich:K#33 Lara:1B#34] | 011 o2 p28 m- b800325 done l34',
      'cap 7 eff 7 | COMMIT | 2/2 | 7 [Sánchez:BB#29 Frelick:F8#30 Pratt:BB#31 Ortiz:1B#32 Yelich:K#33 Lara:1B#34 Turang:F8#35] | 011 o3 p30 m- b668930 done l35',
      'cap null eff null | - | - | 7 [Sánchez:BB#29 Frelick:F8#30 Pratt:BB#31 Ortiz:1B#32 Yelich:K#33 Lara:1B#34 Turang:F8#35] | 011 o3 p30 m- b668930 done l35',
    ],
    '5bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 36 edge 0 | 0/0 | 1 [Fermín:P1#36] | 000 o1 p4 m- b665877 done l36',
      'cap 2 eff 2 | next 3 last 1 ab 37 edge 0 | 0/0 | 2 [Fermín:P1#36 Jordan:L3#37] | 000 o2 p5 m- b691458 done l37',
      'cap 3 eff 3 | COMMIT | 0/0 | 3 [Fermín:P1#36 Jordan:L3#37 Church:K#38] | 000 o3 p9 m- b701675 done l38',
      'cap null eff null | - | - | 3 [Fermín:P1#36 Jordan:L3#37 Church:K#38] | 000 o3 p9 m- b701675 done l38',
    ],
    '6top': [
      'cap 2 eff 2 | next 4 last 0 ab 39 edge 0 | 0/0 | 1 [Vaughn:BB#39] | 100 o0 p5 m- b683734 done l39',
      'cap 4 eff 4 | next 7 last 0 ab 40 edge 0 | 0/0 | 2 [Vaughn:BB#39 Bauers:BB#40] | 110 o0 p6 m694363 b641343 done l40',
      'cap 6 eff 6 | next 8 last 0 ab 41 edge 0 | 0/0 | 3 [Vaughn:BB#39 Bauers:BB#40 Sánchez:K#41] | 110 o1 p10 m694363 b596142 done l41',
      'cap 8 eff 8 | next 9 last 1 ab 42 edge 0 | 0/0 | 4 [Vaughn:BB#39 Bauers:BB#40 Sánchez:K#41 Chourio:F8#42] | 110 o2 p11 m694363 b694192 done l42',
      'cap 9 eff 9 | COMMIT | 0/0 | 5 [Vaughn:BB#39 Bauers:BB#40 Sánchez:K#41 Chourio:F8#42 Pratt:FC#43] | 110 o3 p15 m694363 b806198 done l43',
      'cap null eff null | - | - | 5 [Vaughn:BB#39 Bauers:BB#40 Sánchez:K#41 Chourio:F8#42 Pratt:FC#43] | 110 o3 p15 m694363 b806198 done l43',
    ],
    '6bottom': [
      'cap 3 eff 3 | next 4 last 0 ab 44 edge 0 | 0/0 | 1 [Wetherholt:4-3#44] | 000 o1 p4 m- b802139 done l44',
      'cap 4 eff 4 | next 5 last 0 ab 45 edge 0 | 0/0 | 2 [Wetherholt:4-3#44 Herrera:F8#45] | 000 o2 p6 m- b671056 done l45',
      'cap 5 eff 5 | next 6 last 0 ab 46 edge 0 | 0/1 | 3 [Wetherholt:4-3#44 Herrera:F8#45 Walker:1B#46] | 100 o2 p8 m- b691023 done l46',
      'cap 6 eff 6 | next 7 last 1 ab 47 edge 0 | 2/2 | 4 [Wetherholt:4-3#44 Herrera:F8#45 Walker:1B#46 Velázquez:HR#47] | 000 o2 p12 m- b676369 done l47',
      'cap 7 eff 7 | COMMIT | 2/2 | 5 [Wetherholt:4-3#44 Herrera:F8#45 Walker:1B#46 Velázquez:HR#47 Burleson:1-3#48] | 000 o3 p21 m- b676475 done l48',
      'cap null eff null | - | - | 5 [Wetherholt:4-3#44 Herrera:F8#45 Walker:1B#46 Velázquez:HR#47 Burleson:1-3#48] | 000 o3 p21 m- b676475 done l48',
    ],
    '7top': [
      'cap 1 eff 1 | next 2 last 0 ab 49 edge 0 | 1/1 | 1 [Ortiz:HR#49] | 000 o0 p2 m- b687401 done l49',
      'cap 2 eff 2 | next 3 last 0 ab 50 edge 0 | 1/1 | 2 [Ortiz:HR#49 Yelich:K#50] | 000 o1 p9 m- b592885 done l50',
      'cap 3 eff 3 | next 4 last 0 ab 51 edge 0 | 1/1 | 3 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51] | 100 o1 p15 m- b800325 done l51',
      'cap 4 eff 4 | next 5 last 0 ab 52 edge 0 | 2/2 | 4 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52] | 010 o1 p17 m- b668930 done l52',
      'cap 5 eff 5 | next 8 last 0 ab 53 edge 0 | 2/3 | 5 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53] | 101 o1 p24 m- b683734 done l53',
      'cap 7 eff 7 | next 9 last 0 ab 54 edge 0 | 2/3 | 6 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53 Bauers:BB#54] | 111 o1 p31 m- b641343 done l54',
      'cap 9 eff 9 | next 13 last 0 ab 55 edge 0 | 4/4 | 7 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53 Bauers:BB#54 Sánchez:1B#55] | 101 o1 p34 m- b596142 done l55',
      'cap 12 eff 12 | next 14 last 0 ab 56 edge 0 | 5/5 | 8 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53 Bauers:BB#54 Sánchez:1B#55 Chourio:1B#56] | 110 o1 p39 m- b694192 done l56',
      'cap 14 eff 14 | next 15 last 0 ab 57 edge 0 | 7/6 | 9 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53 Bauers:BB#54 Sánchez:1B#55 Chourio:1B#56 Pratt:2B#57] | 010 o1 p4 m700669 b806198 done l57',
      'cap 15 eff 15 | next 16 last 1 ab 58 edge 0 | 7/6 | 10 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53 Bauers:BB#54 Sánchez:1B#55 Chourio:1B#56 Pratt:2B#57 Ortiz:L6#58] | 010 o2 p7 m700669 b687401 done l58',
      'cap 16 eff 16 | COMMIT | 7/6 | 11 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53 Bauers:BB#54 Sánchez:1B#55 Chourio:1B#56 Pratt:2B#57 Ortiz:L6#58 Yelich:6-3#59] | 010 o3 p13 m700669 b592885 done l59',
      'cap null eff null | - | - | 11 [Ortiz:HR#49 Yelich:K#50 Lara:BB#51 Turang:2B#52 Vaughn:1B#53 Bauers:BB#54 Sánchez:1B#55 Chourio:1B#56 Pratt:2B#57 Ortiz:L6#58 Yelich:6-3#59] | 010 o3 p13 m700669 b592885 done l59',
    ],
    '7bottom': [
      'cap 3 eff 3 | next 4 last 0 ab 60 edge 0 | 0/0 | 1 [Winn:5-3#60] | 000 o1 p3 m- b691026 done l60',
      'cap 4 eff 4 | next 5 last 1 ab 61 edge 0 | 0/0 | 2 [Winn:5-3#60 Fermín:F6#61] | 000 o2 p9 m- b665877 done l61',
      'cap 5 eff 5 | COMMIT | 0/0 | 3 [Winn:5-3#60 Fermín:F6#61 Jordan:L7#62] | 000 o3 p14 m- b691458 done l62',
      'cap null eff null | - | - | 3 [Winn:5-3#60 Fermín:F6#61 Jordan:L7#62] | 000 o3 p14 m- b691458 done l62',
    ],
    '8top': [
      'cap 5 eff 5 | next 6 last 0 ab 63 edge 0 | 0/0 | 1 [Lara:F9#63] | 000 o1 p2 m- b800325 done l63',
      'cap 6 eff 6 | next 7 last 0 ab 64 edge 0 | 0/0 | 2 [Lara:F9#63 Turang:L3#64] | 000 o2 p4 m- b668930 done l64',
      'cap 7 eff 7 | next 8 last 1 ab 65 edge 0 | 0/1 | 3 [Lara:F9#63 Turang:L3#64 Vaughn:1B#65] | 100 o2 p6 m- b683734 done l65',
      'cap 8 eff 8 | COMMIT | 0/1 | 4 [Lara:F9#63 Turang:L3#64 Vaughn:1B#65 Mitchell:L4#66] | 100 o3 p8 m- b669003 done l66',
      'cap null eff null | - | - | 4 [Lara:F9#63 Turang:L3#64 Vaughn:1B#65 Mitchell:L4#66] | 100 o3 p8 m- b669003 done l66',
    ],
    '8bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 67 edge 0 | 0/0 | 1 [Church:K#67] | 000 o1 p5 m- b701675 done l67',
      'cap 2 eff 2 | next 6 last 0 ab 68 edge 0 | 0/0 | 2 [Church:K#67 Wetherholt:F7#68] | 000 o2 p6 m- b802139 done l68',
      'cap 5 eff 5 | next 7 last 1 ab 69 edge 0 | 0/0 | 3 [Church:K#67 Wetherholt:F7#68 Crooks:HBP#69] | 100 o2 p8 m- b699625 done l69',
      'cap 7 eff 7 | COMMIT | 0/0 | 4 [Church:K#67 Wetherholt:F7#68 Crooks:HBP#69 Walker:L3#70] | 100 o3 p2 m684974 b691023 done l70',
      'cap null eff null | - | - | 4 [Church:K#67 Wetherholt:F7#68 Crooks:HBP#69 Walker:L3#70] | 100 o3 p2 m684974 b691023 done l70',
    ],
    '9top': [
      'cap 4 eff 4 | next 5 last 0 ab 71 edge 0 | 0/0 | 1 [Sánchez:BB#71] | 100 o0 p5 m- b596142 done l71',
      'cap 5 eff 5 | next 6 last 0 ab 72 edge 0 | 0/0 | 2 [Sánchez:BB#71 Chourio:F8#72] | 100 o1 p6 m- b694192 done l72',
      'cap 6 eff 6 | next 7 last 1 ab 73 edge 0 | 0/0 | 3 [Sánchez:BB#71 Chourio:F8#72 Pratt:L6#73] | 100 o2 p8 m- b806198 done l73',
      'cap 7 eff 7 | COMMIT | 0/0 | 4 [Sánchez:BB#71 Chourio:F8#72 Pratt:L6#73 Ortiz:F9#74] | 100 o3 p10 m- b687401 done l74',
      'cap null eff null | - | - | 4 [Sánchez:BB#71 Chourio:F8#72 Pratt:L6#73 Ortiz:F9#74] | 100 o3 p10 m- b687401 done l74',
    ],
    '9bottom': [
      'cap 1 eff 1 | next 2 last 0 ab 75 edge 0 | 0/0 | 1 [Velázquez:L7#75] | 000 o1 p3 m- b676369 done l75',
      'cap 2 eff 2 | next 3 last 1 ab 76 edge 0 | 0/0 | 2 [Velázquez:L7#75 Torres:K#76] | 000 o2 p7 m- b663494 done l76',
      'cap 3 eff 3 | COMMIT | 0/0 | 3 [Velázquez:L7#75 Torres:K#76 Winn:F9#77] | 000 o3 p8 m- b691026 done l77',
      'cap null eff null | - | - | 3 [Velázquez:L7#75 Torres:K#76 Winn:F9#77] | 000 o3 p8 m- b691026 done l77',
    ],
  },
}

for (const pk of [824716, 823035]) {
  const feed = load(pk)
  test(`${pk}: every half's tap-by-tap engine reports are unchanged`, () => {
    const got = Object.fromEntries(halves(feed).map((h) => [h, replay(feed, parseInt(h, 10), h.replace(/\d+/, ''))]))
    assert.deepEqual(got, EXPECTED[pk])
  })

  test(`${pk}: the commit is reported exactly once per half, on the last tap`, () => {
    for (const h of halves(feed)) {
      const lines = replay(feed, parseInt(h, 10), h.replace(/\d+/, ''))
      assert.equal(lines.filter((l) => l.includes('COMMIT')).length, 1, h)
      assert.ok(lines[lines.length - 2].includes('COMMIT'), h)
    }
  })
}
