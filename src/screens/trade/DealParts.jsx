import { useState } from 'react'
import { money } from '../../lib/trade/deal.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'

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
// The deal's sentence and its Copy button. `children` (the trade story)
// stands in the sentence's place; Copy still copies the plain wire sentence.
export function Wire({ text, children = null }) {
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
    <div className={children ? 'tradedesk__wire tradedesk__wire--story' : 'tradedesk__wire'}>
      {children ?? <p className="tradedesk__wiretext">{text}</p>}
      <Button size="control" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  )
}

// The one banner on top, Trade Machine style, but a fact rather than a ruling:
// what has to happen before this deal can go through. Green when nothing does.

// What the deal does for one club, under its haul: WAR, money and control,
// then the same thing said in a sentence (the Trade Machine's "you have
// increased this team's projected wins by 3").
// The deal sheet for one club: the three questions a front office asks, in
// the order it asks them (better next year, better long-term, what it costs),
// each as a bar pulled left or right of even, the way the scoreboard's meter
// is. Green is better, red worse; cost is drawn in plain ink, since spending
// is neither. The method sits behind the info button.
const SHEET = [
  { key: 'projWar', ask: (y) => `Better in ${y}`, reach: 15, fmt: (v) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)} WAR`, toned: true },
  { key: 'value', ask: () => 'Long-term value', reach: 150e6, fmt: (v) => signedMoney(v), toned: true },
  { key: 'payroll', ask: (y) => `${y} payroll`, reach: 60e6, fmt: (v) => signedMoney(v), toned: false },
]

export function Effect({ club, side, deal, nextYear }) {
  const unset = deal.unpriced[side]
  return (
    <div className="tradedesk__effect dealsheet" aria-label={`What the deal does for the ${club}`}>
      {SHEET.map(({ key, ask, reach, fmt, toned }) => {
        const v = deal[key][side]
        const pull = Math.max(-1, Math.min(1, v / reach)) * 50
        const tone = !toned ? 'ink' : Math.abs(v) < reach / 100 ? 'flat' : v > 0 ? 'up' : 'down'
        return (
          <div key={key} className={`dealsheet__line dealsheet__line--${tone}`}>
            <span className="dealsheet__ask">{ask(nextYear)}</span>
            <span className="dealsheet__bar" aria-hidden="true">
              <span className="dealsheet__fill" style={{ left: `${pull < 0 ? 50 + pull : 50}%`, width: `${Math.abs(pull)}%` }} />
            </span>
            <span className="dealsheet__fig">{fmt(v)}</span>
          </div>
        )
      })}
      <p className="dealsheet__fine infopop-row">
        {unset ? `${unset} salary not set yet is left out of payroll. ` : ''}How it’s figured{' '}
        <InfoPopover label="How the deal sheet is figured" className="infopop--paper">
          Better in {nextYear}: the projected WAR the {club} gain or lose next season. Long-term value: surplus value, each player’s projected worth less his salary over the years his new club controls him (a rough estimate, give or take $15M). Payroll: next season’s salaries in less salaries out, with pre-arbitration years at the league minimum and arbitration years estimated from projected value.
        </InfoPopover>
      </p>
    </div>
  )
}

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



// "+$28.7M · 1 salary not set": the figure, and how many players in the deal it leaves out.
export const payText = (v, unset) => `${signedMoney(v)}${unset ? ` + ${unset} TBD` : ''}`
const signedMoney = (v) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}${money(v)}`)
const signedNum = (v) => (v === 0 ? '0.0' : `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`)
