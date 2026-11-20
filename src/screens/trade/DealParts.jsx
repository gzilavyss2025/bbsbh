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
  // Each label names what changes; each figure says which way, in words where a sign would be ambiguous.
  { key: 'projWar', ask: (y) => `${y} WAR`, reach: 15, fmt: (v) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`, toned: true },
  { key: 'value', ask: () => 'Value over cost', reach: 150e6, fmt: (v) => signedMoney(v), toned: true },
  { key: 'payroll', ask: (y) => `${y} payroll`, reach: 60e6, fmt: (v) => (v === 0 ? 'No change' : `${money(Math.abs(v))} ${v < 0 ? 'lower' : 'higher'}`), toned: false },
]

// What the deal does for one club, as three figures in a row: a fair deal sits
// near zero on all three, so the numbers say it and no bar is drawn. The method
// sits behind the ⓘ at the row's end.
export function Effect({ club, side, deal, nextYear }) {
  const unset = deal.unpriced[side]
  return (
    <div className="tradedesk__effect dealsheet" aria-label={`What the deal does for the ${club}`}>
      <dl className="dealsheet__row">
        {SHEET.map(({ key, ask, reach, fmt, toned }) => {
          const v = deal[key][side]
          const tone = !toned ? 'ink' : Math.abs(v) < reach / 100 ? 'flat' : v > 0 ? 'up' : 'down'
          return (
            <div key={key} className={`dealsheet__line dealsheet__line--${tone}`}>
              <dt className="dealsheet__ask">{ask(nextYear)}</dt>
              <dd className="dealsheet__fig">{fmt(v)}</dd>
            </div>
          )
        })}
        <InfoPopover label="How the deal sheet is figured" className="infopop--paper dealsheet__how">
          {nextYear} WAR: how many more (or fewer) wins the {club} project next season. Value over cost: what the players they get are worth beyond their salaries, minus the same for the players they give up, over the years each is under control (rough, within about $15M). {nextYear} payroll: how much their {nextYear} salaries change{unset ? `, leaving out ${unset} salary not set yet` : ''}.
        </InfoPopover>
      </dl>
      {/* A player who can veto the deal is the one roster rule worth stating here. */}
      {deal.notes.filter((n) => /10-and-5/.test(n)).map((n) => <p key={n} className="dealsheet__fine dealsheet__veto">{n}</p>)}
    </div>
  )
}

const signedMoney = (v) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}${money(v)}`)
