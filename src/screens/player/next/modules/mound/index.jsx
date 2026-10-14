import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/pitcher/mound.css'
import { fetchWorkload } from '../../../../../api/workload.js'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { teamAbbr } from '../../../../../lib/teams.js'
import { moundView } from './moundView.js'

const TAB_LABEL = { starter: 'Starter', bullpen: 'Bullpen' }
const DAY_WORD = (n) => `${n} ${n === 1 ? 'day' : 'days'}`
const at = (o) => (o.opp ? `${o.home ? 'vs' : 'at'} ${teamAbbr({ id: o.opp })}` : '')

// On the mound (#1893): days since his last start or appearance, and his recent outings on a calendar.
// Open surface (ADR-0034): workload.json holds completed appearances only. It is regular season for the
// averages; the apps also hold postseason outings, which count for rest, wear a round tag, and stay out of the average.
export default function MoundModule({ bio, asOf, season, onEmpty }) {
  const { data, loading } = useAsync(fetchWorkload, [])
  const [picked, setPicked] = useState(null)
  const view = useMemo(() => {
    if (!data || (season && data.season && Number(data.season) !== Number(season))) return null
    const p = data.pitchers?.[String(bio.id)]
    // The season totals are end-of-file: under a cutoff they would average a different stretch than the bars, so no average line.
    return moundView(asOf && p ? { ...p, season: null } : p, asOf || data.asOf)
  }, [data, bio.id, asOf, season])
  // A missing file resolves to null (staticJson's fallback), it does not reject: a settled load with no view is empty.
  const empty = !loading && !view
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  if (loading) return <div className="mound mound--loading" aria-busy="true" />
  if (empty) return null
  const tab = view.tabs.includes(picked) ? picked : view.tab
  const v = view.views[tab]
  return (
    <div className="mound">
      <div className="mound__top">
        {view.tabs.length > 1 && (
          <div role="group" aria-label="How the card reads" className="mound__tabs">
            {view.tabs.map((t) => (
              <button key={t} type="button" className="pnext-pick" aria-pressed={t === tab} onClick={() => setPicked(t)}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        {view.roleWord !== TAB_LABEL[tab] && <span className="mound__role">{view.roleWord}</span>}
      </div>
      <Track v={v} />
      <Calendar chart={v.chart} />
    </div>
  )
}

function Track({ v }) {
  const { track, last } = v
  const usual = track.usual && `${track.usual.min}${track.usual.max > track.usual.min ? `–${track.usual.max}` : ''}`
  return (
    <div className="mound__block">
      <p className="mound__head">
        <span>{v.head}</span>
        {usual && <span>Usual gap · {usual} days</span>}
      </p>
      <div
        className={`mound__trk${!track.outOfTurn && track.nowLeft < 30 ? ' mound__trk--lead' : ''}`}
        role="img"
        aria-label={`${DAY_WORD(track.since)} since his last outing on ${last.md}${last.tag ? `, ${last.tag}` : ''}.`}
      >
        <span className="mound__chip">
          {last.opp && <TeamLogo teamId={last.opp} size={26} />}
          <span className="mono">
            <b>{last.md}</b> {at(last)} · {last.p} P
          </span>
          {last.tag && <span className="mound__tag">{last.tag}</span>}
        </span>
        {track.outOfTurn ? (
          <span className="mound__day">Day {track.since}</span>
        ) : (
          <>
            <span className="mound__now" style={{ left: `${track.nowLeft}%` }}>
              <span className="mound__day">Day {track.since}</span>
            </span>
            <div className="mound__rail">
              <span className="mound__fill" style={{ width: `${track.nowLeft}%` }} />
              {track.zone && <span className="mound__zone" style={{ left: `${track.zone.left}%`, width: `${track.zone.width}%` }} />}
            </div>
            <div className="mound__ticks mono">
              {track.ticks.map((t, i) => (
                <span
                  key={i}
                  className={`mound__tick${t.on ? ' mound__tick--on' : ''}${i === 0 ? ' mound__tick--first' : ''}${i === track.days ? ' mound__tick--end' : ''}${t.on || (i % 2 === 0 && Math.abs(i - track.since) !== 1) ? '' : ' mound__tick--skip'}`}
                  style={{ left: `${t.left}%` }}
                >
                  <em>{t.dow}</em>
                  {t.md}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Calendar({ chart }) {
  if (!chart.bars.length) return null
  const has = (k) => chart.bars.some((b) => b[k])
  const kinds = [
    ['', has('relief') ? 'Start' : 'Appearance', true],
    ['--relief', 'Relief', has('relief')],
    ['--post', 'Postseason', has('post')],
    ['--last', 'Latest', true],
  ].filter(([, , show]) => show)
  return (
    <div className="mound__block">
      <p className="mound__head">
        <span>{chart.head}</span>
        <span className="mound__key">
          {kinds.map(([mod, label]) => (
            <span key={label}>
              <i className={`mound__swatch${mod && ` mound__swatch${mod}`}`} />
              {label}
            </span>
          ))}
          {chart.avgLabel && (
            <span>
              <i className="mound__swatch mound__swatch--avg" />
              {chart.avgLabel}
            </span>
          )}
        </span>
      </p>
      <div className="mound__plot mono">
        {chart.months.map((m) => (
          <span key={m.lab + m.left} className="mound__month" style={{ left: `${m.left}%` }}>
            {m.lab}
          </span>
        ))}
        {chart.avg != null && <span className="mound__avg" style={{ bottom: `${chart.avgPct}%` }} />}
        {chart.live && <span className="mound__today">Today</span>}
        {chart.bars.map((b, i) => (
          <span
            key={i}
            className={`mound__bar${b.relief ? ' mound__bar--relief' : ''}${b.post ? ' mound__bar--post' : ''}${b.last ? ' mound__bar--last' : ''}`}
            style={{ left: `${b.left}%`, width: `${b.w}%`, height: `${b.h}%` }}
          >
            <span className="mound__pv">{b.p}</span>
          </span>
        ))}
      </div>
      <div className="mound__axis mono">
        {chart.dates.map((d, i) => (
          <span key={i} className={`mound__date${d.lo ? ' mound__date--lo' : ''}${d.dense ? ' mound__date--dense' : ''}`} style={{ left: `${d.left}%` }}>
            {d.t}
          </span>
        ))}
        {chart.bars.map((b, i) => (
          <span key={i} className="mound__logo" style={{ left: `${b.left}%` }} title={at(b)}>
            {b.opp && <TeamLogo teamId={b.opp} size={24} />}
          </span>
        ))}
        {chart.gaps.map((g, i) => (
          <span
            key={i}
            className={`mound__gap${g.now ? ' mound__gap--now' : ''}${g.odd ? ' mound__gap--odd' : ''}`}
            style={{ left: `${g.left}%`, width: `${g.w}%` }}
          >
            <b>{g.w < 7 ? g.n : <><span className="mound__long">{DAY_WORD(g.n)}</span><span className="mound__short">{g.n}</span></>}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
