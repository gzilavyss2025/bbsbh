import { transactionTimelineView } from '../../src/api/person/transactions.js'
import { SPORT_LABEL } from '../../src/lib/teams.js'
import fs from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'
const rook = JSON.parse(fs.readFileSync('public/data/rookies.json','utf8')).players
const J = getJson
const PEOPLE = [
  { id: 'gasser', pid: 688107, label: 'Robert Gasser · pitcher' },
  { id: 'turang', pid: 668930, label: 'Brice Turang · infielder' },
  { id: 'yelich', pid: 592885, label: 'Christian Yelich · outfielder' },
]
const out = []
for (const P of PEOPLE) {
  const tx = (await J(`/api/v1/transactions?playerId=${P.pid}`)).transactions
  const ids = new Set(); tx.forEach(t=>{ if(t.fromTeam?.id) ids.add(t.fromTeam.id); if(t.toTeam?.id) ids.add(t.toTeam.id)})
  const person = (await J(`/api/v1/people/${P.pid}?hydrate=draft`)).people[0]
  const d = person.drafts?.[0]
  if (d?.team?.id) ids.add(d.team.id)
  const teams = (await J(`/api/v1/teams?teamIds=${[...ids].join(',')}`)).teams
  const lv = new Map(teams.map(t=>[t.id,t.sport.id])), ab = new Map(teams.map(t=>[t.id,t.abbreviation]))
  const draft = d ? { year: d.year, round: d.pickRound, overall: d.pickNumber, teamId: d.team?.id, teamName: d.team?.name } : null
  const v = transactionTimelineView(tx, { selfId: P.pid, levelByTeamId: lv, draft, rookieUntil: rook[P.pid]?.rookieUntil ?? null })
  const rows = v.rows.map(r => {
    let tag = ''
    if (['ASG','CU','OPT','SE'].includes(r.code)) {
      const t = tx.find(t => (t.effectiveDate||t.date) === r.date && t.typeCode === r.code && (r.description === t.description || r.code==='ASG'))
      const f = t && SPORT_LABEL[lv.get(t.fromTeam?.id)], to = t && SPORT_LABEL[lv.get(t.toTeam?.id)]
      if (f && to && f !== to) tag = `${f} → ${to}`
    }
    const ilDays = r.code === 'IL' ? +(r.description.match(/after (\d+) days/)?.[1] ?? 0) : 0
    return { date: r.date, code: r.code, label: r.label, tone: r.tone, club: r.club ? (ab.get(r.club.id) ?? '') : '', text: r.description, tag, il: ilDays }
  })
  const aw = (await J(`/api/v1/people/${P.pid}/awards`)).awards.filter(a => /^(ALAS|NLAS)$/.test(a.id))
  for (const a of aw) rows.push({ date: a.date, code: 'ALLSTAR', label: 'All-Star', tone: 'honor', club: a.id === 'NLAS' ? 'NL' : 'AL', text: `Named to the ${a.season} ${a.id === 'NLAS' ? 'National' : 'American'} League All-Star team.`, tag: '', il: 0 })
  rows.sort((a,b)=> a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
  console.log(P.id, rows.length, 'rows,', aw.length, 'all-stars')
  out.push({ id: P.id, label: P.label, rows })
}
fs.writeFileSync('.scratch/tx-player/final.json', JSON.stringify(out))
for (const p of out) { console.log('==', p.id); p.rows.slice(0,12).forEach(r=>console.log(r.date,r.code,r.label,'|',r.tag,'|',r.club,'|',r.text.slice(0,90))) }
