import { useState } from 'react'
import { money } from '../../lib/trade/deal.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { MoveRow } from '../../components/transactions/MoveRow.jsx'

// The trade card's deal pieces (src/screens/trade/TradePage.jsx): the banner,
// each club's effect line, the wire sentence, the pinned strip and the retain
// control, with the number formats they share.

export const PCTS = [0, 0.25, 0.5]

// The per-player retain control under a player the reader is sending.
export function RetainControl({ mode, p, value, onChange }) {
  if (mode === 'pct') {
    return (
      <Chips label={`Share of ${p.name}'s salary kept`} layout="wrap" value={value?.pct ?? 0} onChange={(v) => onChange({ pct: v })}
        options={PCTS.map((v) => ({ value: v, label: `Keep ${v * 100}%` }))} />
    )
  }
  return (
    <label className="tradedesk__cash">
      <span className="t-label">Keep a year ($M)</span>
      <input type="number" min="0" step="0.5" inputMode="decimal" value={value?.usd || ''} placeholder="0"
        onChange={(e) => onChange({ usd: Math.max(0, Number(e.target.value) || 0) })} />
    </label>
  )
}

// The deal as the transaction wire would print it, and a button that copies
// it as plain text. The copy names what happened in its own label.
// With a `story` (dealStory.js), the deal is drawn as the home page's
// offseason feed draws a major trade: MoveRow's faces, marks, cutline and
// each player's note. The Copy button still copies the plain wire sentence.
export function Wire({ text, story = null }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={story ? 'tradedesk__wire tradedesk__wire--story' : 'tradedesk__wire'}>
      {story ? (
        <ul className="oseason__list tradedesk__wirelist">
          <MoveRow story={story} marks date={new Date().toISOString().slice(0, 10)} />
        </ul>
      ) : (
        <p className="tradedesk__wiretext">{text}</p>
      )}
      <Button size="control" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  )
}

// The one banner on top, Trade Machine style, but a fact rather than a ruling:
// what has to happen before this deal can go through. Green when nothing does.

// What the deal does for one club, under its haul: WAR, money and control,
// then the same thing said in a sentence (the Trade Machine's "you have
// increased this team's projected wins by 3").
export function Effect({ club, pay, unset, war, inYrs, outYrs, nextYear, warSeason }) {
  const warText = Math.abs(war) < 0.05 ? 'no change in WAR' : `${war > 0 ? 'add' : 'lose'} ${Math.abs(war).toFixed(1)} WAR`
  const payText2 = Math.abs(pay) < 1 ? 'no change in payroll' : `${pay > 0 ? 'take on' : 'shed'} ${money(Math.abs(pay))}`
  return (
    <div className="tradedesk__effect">
      <p className="tradedesk__effectfigs">
        <span><span className="tradedesk__k">{warSeason ?? 'Last season'} WAR</span> <span className={`tradedesk__fig tradedesk__fig--${tone(war) || 'flat'}`}>{signedNum(war)}</span></span>
        <span><span className="tradedesk__k">{nextYear} payroll</span> <span className="tradedesk__fig">{signedMoney(pay)}</span>{unset ? (
          <span className="tradedesk__fignote infopop-row">
            {tbd(unset)}{' '}
            <InfoPopover label="What TBD means" className="infopop--paper">
              TBD is a big-league salary not set yet (arbitration, option or pre-arb). The payroll figure leaves it out.
            </InfoPopover>
          </span>
        ) : null}</span>
        <span><span className="tradedesk__k">Control</span> <span className="tradedesk__fig">+{inYrs} / −{outYrs}</span></span>
      </p>
      <p className="tradedesk__sentence">The {club} {warText} and {payText2} for {nextYear}{unset ? `, plus ${unset} salary not set yet` : ''}.</p>
    </div>
  )
}

// The notes the banner has not already said.
export const otherNotes = (notes) => notes.filter((n) => !/no set salary|must clear|10\+ years/.test(n))

export function StripSide({ name, pay, war, forty }) {
  return (
    <p className="tradedesk__stripside">
      <span className="t-label t-label--bold">{name}</span>
      <span><span className="tradedesk__k">Pay</span> {pay}</span>
      <span><span className="tradedesk__k">WAR</span> {signedNum(war)}</span>
      <span className={forty > 40 ? 'tradedesk__over' : ''}><span className="tradedesk__k">40-man</span> {forty}</span>
    </p>
  )
}


const tone = (v) => (v > 0.05 ? 'up' : v < -0.05 ? 'down' : '')
const tbd = (n) => (n ? `+ ${n} TBD` : null)

// "+$28.7M · 1 salary not set": the figure, and how many players in the deal it leaves out.
export const payText = (v, unset) => `${signedMoney(v)}${unset ? ` + ${unset} TBD` : ''}`
const signedMoney = (v) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}${money(v)}`)
const signedNum = (v) => (v === 0 ? '0.0' : `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`)
