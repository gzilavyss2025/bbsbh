import { money } from '../../lib/trade/deal.js'

const DASH = '—'

// The row's one line: next season's salary, the last year the club holds him
// and WAR; a minor leaguer's level and season line instead.
export function Numbers({ p, nextYear, farm, warSeason = null, full = false }) {
  if (!p.onForty && !p.contract) {
    if (!farm) return <span>{p.level ?? 'Minor leagues'}</span>
    return (
      <>
        <span><span className="tradedesk__k">{farm.level}</span> {farm.club}</span>
        {farm.ops != null && <span><span className="tradedesk__k">OPS</span> {farm.ops}</span>}
        {farm.era != null && <span><span className="tradedesk__k">ERA</span> {farm.era}</span>}
        {full && farm.hr != null && <span><span className="tradedesk__k">HR</span> {farm.hr}</span>}
        {full && farm.pa != null && <span><span className="tradedesk__k">PA</span> {farm.pa}</span>}
        {full && farm.ip != null && <span><span className="tradedesk__k">IP</span> {farm.ip}</span>}
        {full && farm.so != null && <span><span className="tradedesk__k">K</span> {farm.so}</span>}
      </>
    )
  }
  return (
    <>
      <span><span className="tradedesk__k">{nextYear}</span> {p.payUsd != null ? money(p.payUsd) : p.payLabel ?? 'No contract on file'}</span>
      {p.thru && <span><span className="tradedesk__k">{p.signed ? 'Signed thru' : 'Thru'}</span> {p.thru}</span>}
      <span><span className="tradedesk__k">{warSeason ? `${warSeason} WAR` : 'WAR'}</span> {p.war != null ? p.war.toFixed(1) : p.onForty ? 'No MLB time' : DASH}</span>
      {full && p.line?.ops && <span><span className="tradedesk__k">OPS</span> {p.line.ops}</span>}
      {full && p.line?.era && <span><span className="tradedesk__k">ERA</span> {p.line.era}</span>}
      {full && !p.line && farm?.ops && <span><span className="tradedesk__k">{farm.level} OPS</span> {farm.ops}</span>}
      {full && !p.line && farm?.era && <span><span className="tradedesk__k">{farm.level} ERA</span> {farm.era}</span>}
    </>
  )
}
