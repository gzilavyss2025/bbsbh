import { transactionTimelineView } from '../../src/api/person/transactions.js'
const ids = { turang: 668930, gasser: 688107 }
for (const [k, id] of Object.entries(ids)) {
  const r = await fetch(`https://statsapi.mlb.com/api/v1/transactions?playerId=${id}`).then(r => r.json())
  const v = transactionTimelineView(r.transactions, { selfId: id })
  console.log('==', k, r.transactions.length, 'raw ->', v?.rows.length)
  for (const row of v?.rows ?? []) console.log(row.date, row.code, row.tone, row.label, '|', row.description, '|', row.club?.name ?? '')
}
