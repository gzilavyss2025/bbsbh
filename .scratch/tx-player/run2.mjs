import { transactionTimelineView } from '../../src/api/person/transactions.js'
import fs from 'node:fs'
const rook = JSON.parse(fs.readFileSync('public/data/rookies.json','utf8')).players
const J = (u) => fetch('https://statsapi.mlb.com'+u).then(r=>r.json())
const ids = { gasser: 688107, turang: 668930, chourio: 694192 }
const out = {}
for (const [k, id] of Object.entries(ids)) {
  const tx = (await J(`/api/v1/transactions?playerId=${id}`)).transactions
  const teamIds = new Set(); tx.forEach(t=>{ if(t.fromTeam?.id) teamIds.add(t.fromTeam.id); if(t.toTeam?.id) teamIds.add(t.toTeam.id)})
  const lv = new Map()
  const teams = (await J(`/api/v1/teams?teamIds=${[...teamIds].join(',')}`)).teams
  teams.forEach(t=>lv.set(t.id, t.sport.id))
  const person = (await J(`/api/v1/people/${id}?hydrate=draft`)).people[0]
  const d = person.drafts?.[0]
  const draft = d ? { year: d.year, round: d.pickRound, overall: d.pickNumber, teamId: d.team?.id, teamName: d.team?.name } : null
  const v = transactionTimelineView(tx, { selfId: id, levelByTeamId: lv, draft, rookieUntil: rook[id]?.rookieUntil ?? null })
  const aw = (await J(`/api/v1/people/${id}/awards`)).awards.filter(a=>/^(ALAS|NLAS|ASMVP)$/.test(a.id) || /All-Star Game|Home Run Derby/.test(a.name))
  console.log('==',k, v.rows.length, 'rows; AS awards:', JSON.stringify(aw.map(a=>[a.id,a.name,a.season,a.date])))
  for (const r of v.rows) console.log(r.date, r.code, r.tone, r.label,'|',r.description,'|',r.club?.name??'')
  out[k]={rows:v.rows,aw}
}
fs.writeFileSync('.scratch/tx-player/rows.json', JSON.stringify(out,null,1))
