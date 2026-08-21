import { useEffect, useMemo, useState } from 'react'
import {
  awardsView,
  formatAwardOrder,
  knownRankKeys,
  parseAwardCap,
  parseAwardOrder,
  rankAwards,
} from '../../api/person/awards.js'
import { fetchPlayerAwards } from '../../api/person-fetch.js'

// The /admin panel's one non-text editor: the order that decides which of a
// player's awards lead his page, plus the two numbers that say how many of
// them get a table (ADR-0063).
//
// WHY IT IS NOT A TEXTAREA. It stores one, and the stored value stays a plain
// newline-separated list precisely so the panel is repairable by hand — but an
// ordering is a thing you compare pairs of, not a thing you retype. Reading
// "does Silver Slugger outrank All-Star?" out of a 50-line text box means
// counting lines. Two arrows and a live sample answer it in a glance.
//
// WHY A SAMPLE PLAYER. The setting is invisible on its own: a rank is a number
// with no meaning until you see which awards it promotes. So the panel loads
// ONE well-decorated real career beside the list and shows what his page would
// lead with, re-sorting as rows move, with the phone's cut drawn across it.
// Fixed rather than searchable on purpose — this is a rehearsal of the effect,
// not a player browser, and the effect is the same for everyone.
//
// SPOILER FOOTING. /people/{id}/awards carries seasons and dates, never a
// score, and this page is not a scoring surface; the fetch degrades to [] on
// failure and the list still works without it.
const SAMPLE = { id: 545361, name: 'Mike Trout', line: 'CF · Angels' }

const TIER_LABEL = {
  yearEnd: 'Year-end',
  allStar: 'All-Star',
  press: 'Press',
  inSeason: 'In-season',
  intl: 'Intl',
  minors: 'Minors',
  other: 'Unranked',
}

export function AwardOrderEditor({ fields, values, onChange, onReset }) {
  const orderField = fields.find((f) => f.id === 'awards.order')
  const [sample, setSample] = useState([])

  useEffect(() => {
    let cancelled = false
    fetchPlayerAwards(SAMPLE.id)
      .then((awards) => {
        if (!cancelled) setSample(awards ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const sampleView = useMemo(() => awardsView(sample), [sample])
  // The stored order is the text in the box; `order` is that text parsed. Both
  // are needed — the memo below keys off the STRING, because the parsed array
  // is a fresh object every render and would defeat it.
  const orderText = values['awards.order']
  const order = useMemo(() => parseAwardOrder(orderText), [orderText])
  const keys = useMemo(() => knownRankKeys(order, sampleView.categories), [order, sampleView])

  const capDesktop = parseAwardCap(values['awards.capDesktop'], 6)
  const capPhone = Math.min(parseAwardCap(values['awards.capPhone'], 3), capDesktop)

  // Count and tier per rank key, from the sample career — a key the sample
  // player never won shows a dash, which is the honest answer for most of them.
  const byRankKey = useMemo(() => {
    const map = new Map()
    for (const cat of sampleView.categories) {
      const prev = map.get(cat.rankKey)
      map.set(cat.rankKey, { count: (prev?.count ?? 0) + cat.count, tier: cat.tier })
    }
    return map
  }, [sampleView])

  const move = (index, delta) => {
    const next = keys.slice()
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange('awards.order', formatAwardOrder(next))
  }

  const leading = rankAwards(sampleView.categories, order).slice(0, capDesktop)

  return (
    <div className="awardord">
      <div className="awardord__caps">
        <span className="admincopy__label">Tables per player</span>
        <Stepper
          label="Desktop"
          value={capDesktop}
          min={capPhone}
          onSet={(n) => onChange('awards.capDesktop', String(n))}
        />
        <Stepper
          label="Phone"
          value={capPhone}
          max={capDesktop}
          onSet={(n) => onChange('awards.capPhone', String(n))}
        />
      </div>
      <p className="admincopy__help">
        One order, every player, both widths. A page leads with the awards highest in this list that
        the player actually won and files the rest in the index behind “Show all”. Nothing here can
        change what a player won — only which of it gets a table.
      </p>

      <div className="awardord__body">
        <div className="awardord__listcol">
          <p className="awardord__hd">Weight order</p>
          <ol className="awardord__list">
            {keys.map((key, i) => {
              const hit = byRankKey.get(key)
              return (
                <li className="awardord__row" key={key}>
                  <span className="awardord__n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="awardord__name">{key}</span>
                  <span className={`awardord__tier tier-${hit?.tier ?? 'other'}`}>
                    {TIER_LABEL[hit?.tier ?? 'other']}
                  </span>
                  <span className={hit ? 'awardord__ct' : 'awardord__ct awardord__ct--none'}>
                    {hit ? `×${hit.count}` : '—'}
                  </span>
                  <button
                    type="button"
                    className="awardord__mv"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${key} up`}
                  >
                    <Chevron up />
                  </button>
                  <button
                    type="button"
                    className="awardord__mv"
                    onClick={() => move(i, 1)}
                    disabled={i === keys.length - 1}
                    aria-label={`Move ${key} down`}
                  >
                    <Chevron />
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="admincopy__help">
            An award missing from this list sorts last, never first — so a new one MLB adds cannot
            jump the queue on the day it appears.
          </p>
          <button
            type="button"
            className="admincopy__reset"
            disabled={values['awards.order'] === orderField?.default}
            onClick={() => onReset('awards.order')}
          >
            Reset to default
          </button>
        </div>

        <div className="awardord__previewcol">
          <p className="awardord__hd">What it does</p>
          <div className="awardord__preview">
            <p className="awardord__who">{SAMPLE.name}</p>
            <p className="awardord__whoLine">
              {SAMPLE.line} · {sampleView.totals.categories} awards
            </p>
            {leading.length === 0 && <p className="admincopy__help">Loading a sample career…</p>}
            {leading.map((cat, i) => (
              <div key={cat.key}>
                {i === capPhone && (
                  <p className="awardord__cut">
                    <span aria-hidden="true" />
                    <span>{capPhone < capDesktop ? 'phone stops here' : 'phone and desktop agree'}</span>
                    <span aria-hidden="true" />
                  </p>
                )}
                <div className="awardord__pv">
                  <span className="awardord__pvN">{i + 1}</span>
                  <span className="awardord__pvNm">{cat.label}</span>
                  <span className="awardord__pvCt">×{cat.count}</span>
                </div>
              </div>
            ))}
            {sampleView.totals.categories > 0 && (
              <p className="awardord__note">
                The other {sampleView.totals.categories - capPhone} on a phone (
                {sampleView.totals.categories - capDesktop} on desktop) sit in the index behind “Show
                all” — reachable, just not given a table.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stepper({ label, value, min = 1, max = 9, onSet }) {
  return (
    <span className="awardord__stepper">
      <span className="awardord__steplabel">{label}</span>
      <button
        type="button"
        className="awardord__step"
        onClick={() => onSet(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Fewer tables on ${label}`}
      >
        −
      </button>
      <span className="awardord__stepval">{value}</span>
      <button
        type="button"
        className="awardord__step"
        onClick={() => onSet(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`More tables on ${label}`}
      >
        +
      </button>
    </span>
  )
}

function Chevron({ up = false }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
      <path
        d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
