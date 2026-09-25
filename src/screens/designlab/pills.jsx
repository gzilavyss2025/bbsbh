import { Entry, Group } from './Entry.jsx'

// The REAL Pill, Button and Door, rendered — never a copy of their markup.
import { Pill } from '../../components/ui/control/Pill.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { FILLS } from '../../lib/design/pillClass.js'
import { headerThemeClass, headerThemeFor, headerThemeStyle } from '../../lib/headerTheme.js'
import { leagueLogoUrl } from '../../lib/teams.js'

const PATH = 'src/components/ui/control/Pill.jsx'

// The inks a tag is really passed, one per meaning the old tone names carried.
// The copy says what the tag is; the ink says which kind. Only outline and
// paper take one — ink and seal carry their own.
const TAG_INKS = {
  outline: [
    { ink: undefined, label: 'Top 100', logo: true },
    { ink: '--field', label: 'Rookie' },
    { ink: '--accent-primary', label: '12 shy of 300 HR' },
    { ink: '--clay', label: 'IL-60' },
  ],
  paper: [
    { ink: undefined, label: 'Signed' },
    { ink: '--field', label: 'Rookie' },
  ],
  ink: [{ label: '1st of 30' }],
  seal: [{ label: 'Due up' }],
}

// THE STATES ARE THE REAL ATTRIBUTES, as on the button's matrix: selected is
// aria-pressed, disabled is the disabled attribute. Hover, pressed and focus
// are left live on every rest cell — point, press and Tab to see them.
function TagCell({ fill }) {
  return (
    <div className="dlab__matrixcell">
      {TAG_INKS[fill].map((t) => (
        <Pill key={t.label} fill={fill} ink={t.ink}>
          {t.logo && <img src={leagueLogoUrl()} alt="" width="12" height="12" />}
          {t.label}
        </Pill>
      ))}
    </div>
  )
}

function ControlCell({ fill }) {
  return (
    <div className="dlab__matrixcell">
      <Pill role="control" fill={fill}>
        Rest
      </Pill>
      <Pill role="control" fill={fill} pressed>
        Selected
      </Pill>
      <Pill role="control" fill={fill} disabled>
        Disabled
      </Pill>
    </div>
  )
}

// A GROUND is a real surface a pill lands on, drawn by the app's own classes:
// the card's paper, and the club band on a themed team hub (ADR-0030) — the
// Brewers' navy bar with paper type, and the Orioles' orange bar with black
// type, the loudest light bar in the table. The app has one colour scheme
// (01-base.css says `color-scheme: light`), so "dark" here is the dark ground
// a pill really sits on — the band — not a dark mode that does not exist.
const GROUNDS = [
  { key: 'paper', label: 'Card paper', teamId: null },
  { key: 'brewers', label: 'Brewers band — dark bar', teamId: 158 },
  { key: 'orioles', label: 'Orioles band — light bar', teamId: 110 },
]

function Ground({ teamId, title, children, body }) {
  const theme = teamId ? headerThemeFor(teamId, 'main') : null
  return (
    <div className={`team-hub ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <Card
        body={body ? 'padded' : 'flush'}
        head={
          <SectionHead look="band" club as="span" action={children}>
            {title}
          </SectionHead>
        }
      >
        {body}
      </Card>
    </div>
  )
}

function AllEight() {
  return (
    <div className="dlab__row">
      {FILLS.map((fill) => (
        <Pill key={`t-${fill}`} fill={fill}>
          {fill}
        </Pill>
      ))}
      {FILLS.map((fill) => (
        <Pill key={`c-${fill}`} role="control" fill={fill}>
          {fill}
        </Pill>
      ))}
    </div>
  )
}

export function PillSystemHalf() {
  return (
    <Group
      title="The pill — one capsule, two roles, four fills (#1131)"
      lede="Every fill in every role, from the real attributes. The anatomy is the header of src/styles/system/pill.css. The capsule tells a pill from a button; the height tells a tag from a control."
    >
      <Entry
        title="Pill"
        path={PATH}
        wide
        note="Rows are fills, columns are roles. A tag has no states — it is a span, never focusable. A control is rest, selected (aria-pressed) and disabled; point at, press and Tab to a Rest control to see hover, pressed and focus. Selected is ink plus a tick, the button's contract. Tags show the inks they are really passed: no ink, --field, --accent-primary, --clay. Seal is the due-up marker and a control that lifts a seal, nothing else (ADR-0083)."
      >
        <table className="dlab__matrix">
          <thead>
            <tr>
              <th scope="col">fill</th>
              <th scope="col">tag · ≈20px</th>
              <th scope="col">control · 34px</th>
            </tr>
          </thead>
          <tbody>
            {FILLS.map((fill) => (
              <tr key={fill}>
                <th scope="row">{fill}</th>
                <td>
                  <TagCell fill={fill} />
                </td>
                <td>
                  <ControlCell fill={fill} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Entry>

      <Entry
        title="Three shapes, three heights"
        path="src/styles/system/pill.css"
        wide
        note="Left to right: a pill tag (≈20px), a pill control (34px), a button control (34px), a button at tap (44px), an inline door. The pill control and the button control share a height on purpose — both are a switch inside a card — and are told apart by the capsule. The tag never shares a height with anything a thumb can press."
      >
        <div className="dlab__row dlab__row--middle">
          <Pill ink="--field">Rookie</Pill>
          <Pill role="control" pressed={false}>
            MLB only
          </Pill>
          <Button size="control" pressed={false}>
            Season
          </Button>
          <Button>Refresh</Button>
          <Door onClick={() => {}}>See all</Door>
        </div>
      </Entry>

      <Entry
        title="On the grounds it lands on"
        path="src/styles/09-team-info.css"
        wide
        note="All eight pairs in the band head, then again on the card paper under it. Only paper holds on every band: outline is drawn in paper ink and vanishes on a dark bar, and ink is navy and vanishes on a navy one. So a pill on a band is paper, and it never borrows the club's colour to be seen (ADR-0030)."
      >
        <div className="dlab__candidates">
          {GROUNDS.map((g) => (
            <div key={g.key}>
              <p className="dlab__path">{g.label}</p>
              <Ground teamId={g.teamId} title="On the band" body={<AllEight />}>
                <AllEight />
              </Ground>
            </div>
          ))}
        </div>
      </Entry>

      <Entry
        title="Beside the button and the door"
        path="src/screens/team"
        wide
        note="The team hub's own neighbourhood: a band with its control, a scope toggle (Button), roster rows carrying tags, and a door closing the card. Each thing should say what a tap will do before the thumb lands."
      >
        <div className="dlab__candidates">
          {[158, 110].map((teamId) => (
            <Ground
              key={teamId}
              teamId={teamId}
              title="Roster"
              body={
                <div className="dlab__neighbours">
                  <div className="dlab__row">
                    <Button size="control" pressed>
                      Active
                    </Button>
                    <Button size="control" pressed={false}>
                      40-man
                    </Button>
                    <Pill role="control" pressed>
                      MLB only
                    </Pill>
                  </div>
                  <div className="dlab__row dlab__row--middle">
                    <span>Jackson Chourio</span>
                    <Pill ink="--accent-primary">12 shy of 100 HR</Pill>
                  </div>
                  <div className="dlab__row dlab__row--middle">
                    <span>Jacob Misiorowski</span>
                    <Pill ink="--field">Rookie</Pill>
                    <Pill>
                      <img src={leagueLogoUrl()} alt="" width="12" height="12" />
                      Top 100 · 8
                    </Pill>
                  </div>
                  <div className="dlab__row dlab__row--middle">
                    <span>Freddy Peralta</span>
                    <Pill fill="ink">1st of 30</Pill>
                    <Pill fill="seal">Due up</Pill>
                  </div>
                  <Door onClick={() => {}}>Full roster</Door>
                </div>
              }
            >
              <Pill role="control" fill="paper">
                Postseason odds
              </Pill>
            </Ground>
          ))}
        </div>
      </Entry>
    </Group>
  )
}
