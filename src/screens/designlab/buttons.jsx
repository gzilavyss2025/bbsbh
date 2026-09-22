import { Entry, Group } from './Entry.jsx'

// The REAL Button and Door, rendered — never a copy of their markup.
import { Button } from '../../components/ui/control/Button.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { SectionTitle } from '../../components/ui/SectionTitle.jsx'
import { SKINS } from '../../lib/design/buttonClass.js'

const PATH = 'src/components/ui/control/Button.jsx'
const SIZES = [
  { key: 'tap', label: 'tap · 44px' },
  { key: 'control', label: 'control · 34px' },
]

// THE STATES ARE THE REAL ATTRIBUTES. selected is aria-pressed, disabled is the
// disabled attribute, busy is aria-busy — the same hooks the app writes, so this
// page shows what those attributes draw rather than a lab-only class that could
// drift from them. Hover, pressed and focus are left LIVE on every rest cell:
// point, press and Tab to see them, which is the only honest way to show a
// state a stylesheet draws on interaction.
function StateCells({ skin, size }) {
  return (
    <div className="dlab__matrixcell">
      <Button skin={skin} size={size}>Rest</Button>
      <Button skin={skin} size={size} pressed>
        Selected
      </Button>
      <Button skin={skin} size={size} disabled>
        Disabled
      </Button>
      <Button skin={skin} size={size} busy icon="↻">
        Busy
      </Button>
    </div>
  )
}

// The two faces the collapse had to choose between, each drawn beside the
// neighbours a control really lands next to: a card head, a door, a table row.
// Candidate B is the old .btn face, and it is drawn by restating the three
// declarations that WERE that face — the only inline style on this page, and it
// exists to show the rejected look, not to patch a live one.
const BODY_FACE = { fontFamily: 'var(--font-body)', fontSize: 'var(--fs-body)', letterSpacing: 'var(--ls-none)' }

function Neighbours({ face }) {
  const style = face === 'body' ? BODY_FACE : undefined
  const small = face === 'body' ? BODY_FACE : undefined
  return (
    <div className="thub-card dlab__neighbours">
      <SectionTitle title="Innings by position" action={<Door onClick={() => {}}>See all</Door>} />
      <div className="dlab__row">
        <Button size="control" pressed style={small}>
          Season
        </Button>
        <Button size="control" pressed={false} style={small}>
          MLB career
        </Button>
      </div>
      <table className="bs__grid">
        <thead>
          <tr>
            <th className="bs__nameCol">Pos</th>
            <th>G</th>
            <th>GS</th>
            <th>Inn</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="bs__nameCol">LF</td>
            <td>112</td>
            <td>108</td>
            <td>941.1</td>
          </tr>
        </tbody>
      </table>
      <div className="dlab__row">
        <Button skin="ink" style={style}>
          Home team ›
        </Button>
        <Button skin="ghost" style={style}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function ButtonHalf() {
  return (
    <Group
      title="The button — one control, two sizes, five skins (#1130)"
      lede="Every skin in every state, from the real attributes. The anatomy and the meaning of each skin are the header of src/styles/system/button.css."
    >
      <Entry
        title="Button"
        path={PATH}
        wide
        note="Rows are skins, columns are sizes. Each cell is rest, selected (aria-pressed), disabled and busy (aria-busy). Point at, press and Tab to a Rest button to see hover, pressed and focus — they are live, not drawn. A tick marks selected so the state never rests on colour alone. Seal is the mint strip only (ADR-0083); it is shown here so its states can be checked, not offered."
      >
        <table className="dlab__matrix">
          <thead>
            <tr>
              <th scope="col">skin</th>
              {SIZES.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SKINS.map((skin) => (
              <tr key={skin}>
                <th scope="row">{skin}</th>
                {SIZES.map((s) => (
                  <td key={s.key}>
                    <StateCells skin={skin} size={s.key} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Entry>
      <Entry
        title="Which face outline is"
        path="src/styles/system/button.css"
        wide
        verdict="A chosen"
        tone="canon"
        note="A: the display face in caps, which about twenty of the controls already used. B: the old .btn face, body type at 15px, which the reveal button still wears on purpose. Beside a card head, a door and a table row — all three in the display face — B is the only thing in the card that reads as a sentence rather than as chrome. A label on a control is chrome."
      >
        <div className="dlab__candidates">
          <div>
            <p className="dlab__path">A — display face, caps (chosen)</p>
            <Neighbours face="display" />
          </div>
          <div>
            <p className="dlab__path">B — body face (rejected)</p>
            <Neighbours face="body" />
          </div>
        </div>
      </Entry>
    </Group>
  )
}
