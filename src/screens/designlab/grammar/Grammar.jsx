import '../../../styles/designlab/grammar.css'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { Table } from '../../../components/ui/table/Table.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import {
  DIRECTIONS, FORM, MIX, PCT_ROWS, REGISTER, SPLIT, STANDINGS, TEAM_TILES, TILES,
} from './fixture.js'

// ONE SHARED GRAMMAR, FOUR DIRECTIONS. Every direction renders this same markup
// from the same rows (fixture.js). Only the scoped rules in
// styles/designlab/grammar.css differ, so the eye compares grammar and nothing
// else. The head, the card and the table are the real parts; the bar, the tile
// and the form rail are the missing parts the direction would define.
// Open surface (ADR-0034): invented data, no score, no API call, no --seal.

// Head look per direction. SectionHead already has all three.
const HEAD = { box: 'label', attr: 'band', rule: 'rule', vs: 'label' }

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
const rankText = ([n, of]) => `${n} of ${of}`

// Tier index for the Attribute Screen: bench, starter, regular, all-star, MVP.
const tier = (p) => (p >= 90 ? 4 : p >= 75 ? 3 : p >= 50 ? 2 : p >= 25 ? 1 : 0)

// A bar. `pct` is 0 to 100 and 50 is the league median. Every direction reads
// the same three numbers; none computes its own, so none can drift.
function Bar({ pct, median = 50, className = '' }) {
  const lo = Math.min(pct, median)
  const style = { '--v': `${pct}%`, '--ref': `${median}%`, '--lo': `${lo}%`, '--w': `${Math.abs(pct - median)}%` }
  return (
    <span className={`gx__bar gx__bar--t${tier(pct)} ${pct >= median ? 'is-up' : 'is-down'} ${className}`.trim()} style={style} aria-hidden="true">
      <i className="gx__fill" />
      <b className="gx__ref" />
    </span>
  )
}

function Tile({ label, value, rank, pct }) {
  return (
    <div className="gx__tile">
      <span className="gx__tilelabel">{label}</span>
      <span className="gx__tilevalue">{value}</span>
      <span className="gx__delta">{signed(pct - 50)} pts vs league</span>
      <span className="gx__rank">{rankText(rank)}</span>
      <Bar pct={pct} className="gx__bar--mini" />
    </div>
  )
}

function PctRow({ label, value, pct }) {
  return (
    <div className="gx__prow">
      <span className="gx__plabel">{label}</span>
      <Bar pct={pct} />
      <span className="gx__pval">{value}</span>
      <span className="gx__pnum">{pct}</span>
      <span className="gx__pdelta">{signed(pct - 50)}</span>
    </div>
  )
}

function Mix() {
  return (
    <div className="gx__mix">
      <span className="gx__mixbar">
        {MIX.map((m, i) => (
          <i key={m.label} className={`gx__seg gx__seg--${i}`} style={{ '--w': `${m.share}%` }} />
        ))}
      </span>
      <ul className="gx__legend">
        {MIX.map((m, i) => (
          <li key={m.label}>
            <i className={`gx__key gx__seg--${i}`} />
            {m.label}
            <b>{m.share}%</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Register() {
  return (
    <Table frame="bare" className="gx__tbl" label="Register">
      <thead>
        <tr><th>Year</th><th>Tm</th><th>IP</th><th>ERA</th><th>K</th><th>BB</th></tr>
      </thead>
      <tbody>
        {REGISTER.map((r) => (
          <tr key={r.yr}><th>{r.yr}</th><td>{r.tm || '—'}</td><td>{r.ip}</td><td>{r.era}</td><td>{r.k}</td><td>{r.bb}</td></tr>
        ))}
      </tbody>
    </Table>
  )
}

function Form() {
  return (
    <div className="gx__form" role="img" aria-label="Last ten: 6 wins, 4 losses">
      {FORM.map((w, i) => <i key={i} className={`gx__pip ${w ? 'is-w' : 'is-l'}`} />)}
    </div>
  )
}

function Standings() {
  return (
    <Table frame="bare" className="gx__tbl" label="Standings">
      <thead>
        <tr><th>Club</th><th>W</th><th>L</th><th>Pct</th><th>GB</th></tr>
      </thead>
      <tbody>
        {STANDINGS.map((r) => (
          <tr key={r.club} className={r.own ? 'is-own' : undefined}>
            <th>{r.club}</th><td>{r.w}</td><td>{r.l}</td><td>{r.pct}</td><td>{r.gb}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function Split() {
  return (
    <div className="gx__split">
      <span className="gx__mixbar gx__mixbar--split">
        {SPLIT.map((s, i) => (
          <i key={s.label} className={`gx__seg gx__seg--${i}`} style={{ '--w': `${s.share}%` }} />
        ))}
      </span>
      <div className="gx__diverge">
        {SPLIT.map((s) => (
          <div key={s.label} className="gx__prow">
            <span className="gx__plabel">{s.label}</span>
            <Bar pct={50 + (s.share - s.lg) * 5} />
            <span className="gx__pval">{s.share}%</span>
            <span className="gx__pdelta">{signed(s.share - s.lg)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayerSlice({ dir }) {
  return (
    <Stack gap="loose" className="gx__slice">
      <Card as="div" body="flush" className="gx__card">
        <SectionHead look={HEAD[dir]} house={dir === 'attr'} as="h4" note="2026">Season</SectionHead>
        <div className="gx__tiles">{TILES.map((t) => <Tile key={t.label} {...t} />)}</div>
      </Card>
      <Card as="div" body="flush" className="gx__card">
        <SectionHead look={HEAD[dir]} house={dir === 'attr'} as="h4" note={dir === 'vs' ? 'vs league' : 'of 89'}>Craft</SectionHead>
        <div className="gx__cols">
          <div className="gx__pane">{PCT_ROWS.map((r) => <PctRow key={r.label} {...r} />)}</div>
          <div className="gx__pane"><Mix /><Register /></div>
        </div>
      </Card>
    </Stack>
  )
}

function TeamSlice({ dir }) {
  return (
    <Stack gap="loose" className="gx__slice">
      <Card as="div" body="flush" className="gx__card">
        <SectionHead look={HEAD[dir]} house={dir === 'attr'} as="h4" note="of 30">Numbers</SectionHead>
        <div className="gx__tiles">{TEAM_TILES.map((t) => <Tile key={t.label} {...t} />)}</div>
        <div className="gx__pane gx__pane--form"><span className="gx__plabel">Last 10</span><Form /></div>
      </Card>
      <Card as="div" body="flush" className="gx__card">
        <SectionHead look={HEAD[dir]} house={dir === 'attr'} as="h4" note="Division">Standings and run value</SectionHead>
        <div className="gx__cols">
          <div className="gx__pane"><Standings /></div>
          <div className="gx__pane"><Split /></div>
        </div>
      </Card>
    </Stack>
  )
}

const SPEC_ROWS = [
  ['Why it looks intentional', 'why'], ['Track, radius, ends', 'track'], ['Fill ramp', 'ramp'],
  ['Where the number sits', 'number'], ['Label style', 'label'], ['Ticks and axis', 'ticks'],
  ['Stat tile', 'tile'], ['Table header', 'tableHead'], ['Card head', 'head'], ['Rank', 'rank'],
  ['The five chart types', 'charts'],
]

// layout-exempt: a fixed-width specimen frame (390 or 1180 px) is the point of
// the entry, so it cannot use a width-driven layout part.
function Frame({ size, children }) {
  return (
    <div className="gx__scroll" tabIndex={0} role="region" aria-label={`${size} frame`}>
      <div className={`gx__frame gx__frame--${size}`}>{children}</div>
    </div>
  )
}

export function Grammar({ dir }) {
  const d = DIRECTIONS.find((x) => x.id === dir)
  const spec = { ...d, tableHead: d.tableHead ?? TABLE_HEAD[dir] }
  return (
    <div className={`gx gx--${dir}`}>
      <Stack gap="loose">
        <h3 className="gx__name">{d.name}</h3>
        <dl className="gx__spec">
          {SPEC_ROWS.map(([k, key]) => (
            <div key={key}><dt>{k}</dt><dd className="gx__dd">{spec[key]}</dd></div>
          ))}
        </dl>
        <p className="gx__cap">Player: Season and Craft. Phone, 390 px.</p>
        <Frame size="phone"><PlayerSlice dir={dir} /></Frame>
        <p className="gx__cap">Player: Season and Craft. Wide, 1180 px.</p>
        <Frame size="wide"><PlayerSlice dir={dir} /></Frame>
        <p className="gx__cap">Team: Numbers. Phone, 390 px.</p>
        <Frame size="phone"><TeamSlice dir={dir} /></Frame>
        <p className="gx__cap">Team: Numbers. Wide, 1180 px.</p>
        <Frame size="wide"><TeamSlice dir={dir} /></Frame>
      </Stack>
    </div>
  )
}

const TABLE_HEAD = {
  box: 'Graphite capitals on a hairline, right-aligned except the first cell. Same as today’s standings.',
  attr: 'Ink fill row, paper capitals. The table reads as a stat sheet.',
  rule: 'Graphite capitals over a 2px ink rule (the scorebook’s heavy line). Row rules are dotted.',
  vs: 'Graphite capitals on a hairline. The own-club row carries a navy edge.',
}
