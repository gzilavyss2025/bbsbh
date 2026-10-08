import '../../../styles/designlab/nested.css'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { Table } from '../../../components/ui/table/Table.jsx'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { Grid } from '../../../components/ui/layout/Grid.jsx'
import { RosterList } from '../../team/modules/RosterList.jsx'

// BOXES INSIDE CARDS (#1775, Q4 of #1113): four real cases, each drawn twice.
// BEFORE is today: the real classes and components. AFTER is the same data in
// the same order with the inner box gone. Nothing here ships: no production
// file changes, and the partial leaves with this entry when Gary decides.
//
// Every figure is invented, and none is a score. The worst-call and
// umpire-favour boxes sit in the seal scope in the app (src/CLAUDE.md), so
// the lean is drawn with --winprob-away and the tier pill, never --seal.
const DASH = '—'

// Case 1. Invented: nobody, no club, no inning that is a real game's.
const FAVOR = { net: 0.8, club: 'Away', calls: 6 }

function WorstCallBody() {
  return (
    <>
      <div className="wcall__top">
        <span className="wcall__label">Worst call</span>
      </div>
      <div className="wcall__body">
        <div className="wcall__diagram">
          <svg className="wcall__svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
            <rect className="wcall__zone" x="25" y="12" width="50" height="76" rx="3" />
            <line className="wcall__edgeline wcall__ink--clay" x1="75" y1="12" x2="75" y2="88" />
            <circle className="wcall__ball wcall__ink--clay" cx="87" cy="50" r="9" />
          </svg>
          <span className="wcall__edgeword" aria-hidden="true">2.1″ OUTSIDE</span>
        </div>
        <div className="wcall__side">
          <div className="wcall__calls">
            <Pill className="wcall__pill wcall__pill--wrong">Strike</Pill>
            <span className="wcall__arrow" aria-hidden="true">→</span>
            <Pill className="wcall__pill wcall__pill--right">Ball</Pill>
          </div>
          <div className="wcall__locator"><b>Sample Batter</b> · ▲3</div>
          <div className="wcall__count">
            <span className="wcall__count-label">Count</span>
            <span className="wcall__count-old">1–2</span>
            <span className="wcall__count-arrow" aria-hidden="true">→</span>
            <span className="wcall__count-new">2–2</span>
          </div>
        </div>
      </div>
    </>
  )
}

function FavorBody({ tier }) {
  return (
    <>
      {tier && (
        <Pill className="favormeter__tierpill favormeter__tierpill--standout">
          Standout<span className="favormeter__tierpill-count"> · {FAVOR.calls} missed calls</span>
        </Pill>
      )}
      <div className="favormeter__track-row">
        <span className="wcall__edgeword">AWY</span>
        <div className="favormeter__track" role="img" aria-label={`Missed calls added ${FAVOR.net} runs for ${FAVOR.club}`}>
          <span className="favormeter__mid" aria-hidden="true" />
          <span className="favormeter__fill favormeter__fill--away" style={{ width: '30%' }} aria-hidden="true" />
        </div>
        <span className="wcall__edgeword">HME</span>
      </div>
      <div className="favormeter__caption" aria-hidden="true">
        <span className="favormeter__label">Missed calls have added</span>
        <strong className="favormeter__value">+{FAVOR.net.toFixed(1)} <span className="favormeter__unit">runs</span></strong>
        <span className="favormeter__label">for {FAVOR.club}</span>
      </div>
    </>
  )
}

const statHead = <SectionHead look="band" house>Insights</SectionHead>

function PanelBefore() {
  return (
    <Card head={statHead}>
      <div className="umpfavor">
        <span className="umpfavor__title">Sample behind the plate</span>
        <div className="umpfavor__row">
          <div className="wcall"><WorstCallBody /></div>
          <div className="favormeter favormeter--standout"><FavorBody tier /></div>
        </div>
      </div>
    </Card>
  )
}

function PanelAfter() {
  return (
    <Card head={statHead}>
      <span className="umpfavor__title nested__ruled">Sample behind the plate</span>
      <div className="nested__duo">
        <div className="nested__cell"><WorstCallBody /></div>
        <div className="nested__cell nested__cell--meter"><FavorBody tier /></div>
      </div>
    </Card>
  )
}

// Case 2. Invented players; WAR null shows the dash fallback.
const ROSTER = [
  { id: 1, jersey: '4', name: 'Alex Sample', pos: 'C', war: 2.4 },
  { id: 2, jersey: '12', name: 'Jordan Example', pos: '1B', war: 3.6, allStar: true },
  { id: 3, jersey: '27', name: 'Casey Placeholder', pos: 'SS', war: -0.3, hurt: true },
  { id: 4, jersey: '31', name: 'Riley Invented', pos: 'LF', war: null },
].map((p) => ({ ...p, badge: p.pos, badgeClass: 'thub-pos' }))

const rosterHead = <SectionHead look="band" club>Current Roster</SectionHead>
const rosterList = <RosterList season={2026} rows={ROSTER} />

function RosterBefore() {
  return (
    <Card head={rosterHead}>
      <h4 className="roster-sub__title">Position players · season WAR</h4>
      {rosterList}
    </Card>
  )
}

function RosterAfter() {
  return (
    <Card head={rosterHead}>
      <h4 className="roster-sub__title">Position players · season WAR</h4>
      <div className="nested__roster">{rosterList}</div>
    </Card>
  )
}

// Case 3. A pitcher's line and a hitter's; a missing WHIP shows the dash.
const TILES = [
  { name: 'Sam Example', stats: [['W-L', '8-3'], ['ERA', '2.91'], ['K', '104'], ['WHIP', DASH]] },
  { name: 'Drew Placeholder', stats: [['AVG', '.287'], ['HR', '14'], ['RBI', '52'], ['OPS', '.841']] },
]

function TileHead({ name }) {
  return (
    <div className="hzntile__head">
      <div className="horizontile__body">
        <span className="horizontile__name">{name}</span>
        <div className="horizontile__meta"><span>Double-A</span></div>
        <div className="hzntile__trend">&#9650; top 10% since Aug 14</div>
      </div>
    </div>
  )
}

function WellCard({ flat }) {
  return (
    <Card head={<SectionHead look="band" club>On the horizon</SectionHead>}>
      <ul className="hznlist">
        {TILES.map((t) => (
          <Card as="li" body="flush" className="hzntile" key={t.name}>
            <TileHead name={t.name} />
            {flat ? (
              <div className="nested__stats">
                {t.stats.map(([k, v]) => (
                  <div className="nested__stat" key={k}>
                    <span className="hzntile__tilev">{v}</span>
                    <span className="hzntile__tilek">{k}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Grid min={64} fit gap="snug" className="hzntile__stats">
                {t.stats.map(([k, v]) => (
                  <div className="hzntile__tile" key={k}>
                    <span className="hzntile__tilev">{v}</span>
                    <span className="hzntile__tilek">{k}</span>
                  </div>
                ))}
              </Grid>
            )}
          </Card>
        ))}
      </ul>
    </Card>
  )
}

// Case 4. The real Table, the real rows; only `frame` differs.
const PROSPECTS = [
  { rk: 1, name: 'Sam Example', top: 12, pos: 'SS', level: 'Double-A' },
  { rk: 2, name: 'Drew Placeholder', top: null, pos: 'RHP', level: 'High-A' },
  { rk: 3, name: 'Quinn Invented', top: null, pos: null, level: null },
]

function ProspectTable({ frame }) {
  return (
    <Card head={<SectionHead look="band" club note="org rank">Prospects</SectionHead>}>
      <Table frame={frame} label="Org prospects" className="ledger prospecttable">
        <thead>
          <tr>
            <th className="lft">Rk</th>
            <th className="lft">Player</th>
            <th>Pos</th>
            <th>Level</th>
          </tr>
        </thead>
        <tbody>
          {PROSPECTS.map((p) => (
            <tr key={p.rk}>
              <td className="lft yr">{p.rk}</td>
              <td className="lft ledger__label">
                <span className="prospecttable__name">{p.name}</span>
                {p.top != null && <Pill figure className="prospecttable__top">#{p.top}</Pill>}
              </td>
              <td>{p.pos || DASH}</td>
              <td className="prospecttable__level"><span>{p.level || DASH}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

const CASES = [
  {
    kind: 'Panel',
    title: 'Worst call and umpire favour, inside the at-bat stat box',
    where: '.wcall, .favormeter · gamehud/StatBox.jsx',
    before: <PanelBefore />,
    after: <PanelAfter />,
    lost: 'The tier wash: a Standout or Outlier night no longer tints the whole box, only the pill shows it. The two figures stop reading as two objects, so a rule must split them. Both boxes are inside the seal scope, so the real change needs a browser check on a revealed half.',
  },
  {
    kind: 'Nested sheet',
    title: 'Roster list, inside the roster card',
    where: '.thub-roster · team/modules/RosterList.jsx',
    before: <RosterBefore />,
    after: <RosterAfter />,
    lost: 'The list stops being a thing you can point at. Rows keep their hairlines and the card edge is the only frame. The same list draws on the All-Star and series pages, which need their own look before the box goes. Team-hub files wait for #1179 and #1180.',
  },
  {
    kind: 'Well',
    title: 'Stat tiles, inside a minor-league tile',
    where: '.hzntile__tile · team/modules/minors/HorizonCard.jsx',
    before: <WellCard />,
    after: <WellCard flat />,
    lost: 'The grey fill that sets the figures apart from the name above. A rule and the label type now do that job. The tile itself is still a sheet inside the On the horizon card; this case does not touch it.',
  },
  {
    kind: 'Table',
    title: 'Prospects table, inside the prospects card',
    where: 'frame="sheet" · team/modules/minors/ProspectsCard.jsx',
    before: <ProspectTable frame="sheet" />,
    after: <ProspectTable frame="bare" />,
    lost: 'The table edge. The head row and the row hairlines carry the shape. This needs no new code: Table already has frame="bare". StandingsCard is the same change.',
  },
]

export function NestedBoxes() {
  return (
    <div className="nested">
      {CASES.map((c, i) => (
        <section className="nested__case" key={c.kind}>
          <h4 className="nested__casehead">{i + 1} · {c.kind}: {c.title}</h4>
          <p className="nested__where">{c.where}</p>
          <div className="nested__pair">
            <div className="nested__side">
              <span className="nested__tag">Before · today</span>
              {c.before}
            </div>
            <div className="nested__side">
              <span className="nested__tag">After · flattened</span>
              {c.after}
            </div>
          </div>
          <p className="nested__lost"><strong>Flattening loses:</strong> {c.lost}</p>
        </section>
      ))}
    </div>
  )
}
