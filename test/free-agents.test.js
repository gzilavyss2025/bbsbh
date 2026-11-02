// THE FREE-AGENT CLASS PAGE (#2509): the feed-row mapping, the filters, the
// WAR sort and the header summary. Row shapes are copied from the live
// /api/v1/people/freeAgents?season=2026 response (2026-11-02).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapFreeAgent,
  filterFreeAgents,
  sortFreeAgents,
  summarizeFreeAgents,
  statLine,
  statsByPerson,
  cleanNote,
  positionGroup,
} from '../src/api/free-agents/freeAgents.js'

const WAR = { bat: { 677800: 5.5, 600: 0.4 }, pit: { 669373: 5.2, 600: 0.3 } }

const unsigned = {
  player: { id: 677800, fullName: 'Randy Arozarena' },
  originalTeam: { id: 136, name: 'Seattle Mariners' },
  newTeam: { link: '/api/v1/teams/null' },
  dateDeclared: '2026-10-29',
  position: { abbreviation: 'LF' },
}
const signed = {
  player: { id: 691907, fullName: 'Tsung-Che Cheng' },
  originalTeam: { id: 111, name: 'Boston Red Sox' },
  newTeam: { id: 116, name: 'Detroit Tigers' },
  dateDeclared: '2026-10-05',
  dateSigned: '2026-10-30',
  notes: 'Traded for cash considerations.',
  position: { abbreviation: 'IF' },
}
const minor = {
  player: { id: 1, fullName: 'Minor Leaguer' },
  originalTeam: { id: 158, name: 'Milwaukee Brewers' },
  newTeam: {},
  notes: 'Minor League Free Agent',
  position: { abbreviation: 'RP' },
}
const declined = {
  player: { id: 669373, fullName: 'Tarik Skubal' },
  originalTeam: { id: 119, name: 'Los Angeles Dodgers' },
  newTeam: {},
  notes: 'Club Option Declined',
  position: { abbreviation: 'P' },
}

test('maps an unsigned row with WAR summed from bat and pit', () => {
  const r = mapFreeAgent(unsigned, { war: WAR })
  assert.equal(r.id, 677800)
  assert.equal(r.name, 'Randy Arozarena')
  assert.equal(r.group, 'OF')
  assert.equal(r.teamId, 136)
  assert.equal(r.signed, false)
  assert.equal(r.newTeamId, null)
  assert.equal(r.war, 5.5)
  assert.equal(r.minor, false)
  assert.equal(r.note, '')
  assert.equal(mapFreeAgent({ ...unsigned, player: { id: 600, fullName: 'X' } }, { war: WAR }).war, 0.7)
})

test('maps a signed row with its new club and a cleaned note', () => {
  const r = mapFreeAgent(signed, { war: WAR })
  assert.equal(r.signed, true)
  assert.equal(r.newTeamId, 116)
  assert.equal(r.newTeamName, 'Detroit Tigers')
  assert.equal(r.dateSigned, '2026-10-30')
  assert.equal(r.note, 'Traded for cash considerations')
  assert.equal(r.war, null)
})

test('a signing back with the same club is a re-signing', () => {
  const r = mapFreeAgent({ ...signed, newTeam: { id: 111, name: 'Boston Red Sox' } })
  assert.equal(r.signed, true)
  assert.equal(r.resigned, true)
  assert.equal(mapFreeAgent(signed).resigned, false)
  assert.equal(mapFreeAgent(unsigned).resigned, false)
})

test('a signed date with no new club id is not a signing', () => {
  const r = mapFreeAgent({ ...signed, newTeam: { link: '/api/v1/teams/null' } })
  assert.equal(r.signed, false)
  assert.equal(r.dateSigned, null)
})

test('the minor-league note marks the row and is not shown as a note', () => {
  const r = mapFreeAgent(minor)
  assert.equal(r.minor, true)
  assert.equal(r.note, '')
})

test('option-declined notes are counted in every spelling the feed uses', () => {
  for (const n of ['Club Option Declined', 'Club Option Declined.', 'Declined Player Option', 'Mutual Option Declined']) {
    assert.equal(mapFreeAgent({ ...declined, notes: n }).optionDeclined, true, n)
  }
  assert.equal(mapFreeAgent({ ...declined, notes: 'Claimed Off Waivers.' }).optionDeclined, false)
  assert.equal(cleanNote('Claimed Off Waivers.'), 'Claimed off waivers')
})

test('position groups', () => {
  assert.equal(positionGroup('SP'), 'P')
  assert.equal(positionGroup('TWP'), 'P')
  assert.equal(positionGroup('SS'), 'IF')
  assert.equal(positionGroup('CF'), 'OF')
  assert.equal(positionGroup('DH'), 'DH')
  assert.equal(positionGroup('??'), null)
})

const rows = [unsigned, signed, minor, declined].map((r) => mapFreeAgent(r, { war: WAR }))

test('the default filter is MLB only and hides only minor-league free agents', () => {
  const out = filterFreeAgents(rows)
  assert.deepEqual(out.map((r) => r.id), [677800, 691907, 669373])
  assert.equal(filterFreeAgents(rows, { includeMinors: true }).length, 4)
})

test('position, club and unsigned-only filters combine', () => {
  assert.deepEqual(filterFreeAgents(rows, { group: 'P' }).map((r) => r.id), [669373])
  assert.deepEqual(filterFreeAgents(rows, { teamId: 111 }).map((r) => r.id), [691907])
  assert.deepEqual(filterFreeAgents(rows, { unsignedOnly: true }).map((r) => r.id), [677800, 669373])
  assert.deepEqual(filterFreeAgents(rows, { group: 'P', includeMinors: true }).map((r) => r.id), [1, 669373])
})

test('sorts by WAR, highest first, with no-WAR rows last by name', () => {
  assert.deepEqual(sortFreeAgents(rows).map((r) => r.id), [677800, 669373, 1, 691907])
})

test('the summary counts the MLB list only', () => {
  const s = summarizeFreeAgents(rows)
  assert.equal(s.declared, 3)
  assert.equal(s.signed, 1)
  assert.equal(s.unsigned, 2)
  assert.equal(s.latest.id, 691907)
  assert.equal(s.best.id, 677800)
  assert.equal(s.optionsDeclined, 1)
})

test('stat lines for hitters and pitchers', () => {
  const stats = statsByPerson([
    {
      id: 1,
      currentAge: 30,
      stats: [
        { group: { displayName: 'hitting' }, splits: [{ stat: { avg: '.000', obp: '.000', slg: '.000', homeRuns: 0 } }] },
        { group: { displayName: 'pitching' }, splits: [{ stat: { era: '1.72', inningsPitched: '52.1', strikeOuts: 59, saves: 4 } }] },
      ],
    },
    { id: 2, currentAge: 31, stats: [{ group: { displayName: 'hitting' }, splits: [{ stat: { avg: '.281', obp: '.381', slg: '.484', homeRuns: 26 } }] }] },
  ])
  assert.equal(stats[1].age, 30)
  assert.equal(statLine(stats[1], true), '1.72 ERA · 52.1 IP · 59 K · 4 SV')
  assert.equal(statLine(stats[2], false), '.281/.381/.484 · 26 HR')
  assert.equal(statLine(stats[2], true), '')
  assert.equal(statLine(undefined, false), '')
})
