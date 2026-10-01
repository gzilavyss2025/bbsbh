import { Entry, Group } from './Entry.jsx'

// The REAL Stack and Cluster, and the real Card and Pill as the things they
// arrange — never a copy of any of their markup.
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Pill } from '../../components/ui/control/Pill.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'

const PATH = 'src/components/ui/layout/Stack.jsx'
const CLUSTER_PATH = 'src/components/ui/layout/Cluster.jsx'

// One column per gap, each a Stack of three ledger cards. The cards are the
// ruler: the space between them is the whole of what the Stack draws. The
// px values are the steps' own (src/tokens/spacing.css); `section` is
// --space-section, the 16px step today.
const GAPS = [
  { gap: 'tight', px: '4px · --space-1' },
  { gap: 'snug', px: '8px · --space-2' },
  { gap: 'base', px: '12px · --space-3' },
  { gap: 'loose', px: '16px · --space-4' },
  { gap: 'section', px: '--space-section' },
]

export function StackHalf() {
  return (
    <Group
      title="The stack — a column with one step of space between (#1180)"
      lede="Five gaps, four steps. The Stack owns the space between its children and nothing else: no padding, no margin, no frame. The anatomy is the header of src/styles/system/stack.css."
    >
      <Entry
        title="Stack"
        path={PATH}
        wide
        note="One column per gap. Base is the default. Section is the gap between a page's top-level sections: it has its own name, so one edit to --space-section moves every page. There is no hairline step and no half-step; a stack that wants 2px or 6px keeps its own namespace rule (ADR-0085). A Stack with as=ul or as=ol drops the marker and the indent."
      >
        <div className="dlab__row">
          {GAPS.map(({ gap, px }) => (
            <div key={gap}>
              <Stack gap={gap}>
                {['One', 'Two', 'Three'].map((n) => (
                  <Card key={n} as="div" frame="ledger">
                    {n}
                  </Card>
                ))}
              </Stack>
              <p className="dlab__path">
                {gap}
                <span className="dlab__count">{px}</span>
              </p>
            </div>
          ))}
        </div>
      </Entry>
    </Group>
  )
}

// The cluster's ruler is a run of tags in a column too narrow to hold them on
// one line, so they wrap. The width belongs to this frame, not to the Cluster.
const TAGS = ['Top 100', 'Rookie', 'IL-60', 'Signed', '12 shy of 300 HR', 'Due up', '1st of 30', 'Debut']
const CLUSTERS = [
  { label: 'tight', note: '4px', props: { gap: 'tight' } },
  { label: 'snug', note: '8px · default', props: { gap: 'snug' } },
  { label: 'base', note: '12px', props: { gap: 'base' } },
  { label: 'base + rowGap tight', note: '12px · lines 4px', props: { gap: 'base', rowGap: 'tight' } },
]

function TagRun(props) {
  return (
    <Cluster {...props}>
      {TAGS.map((t) => (
        <Pill key={t}>{t}</Pill>
      ))}
    </Cluster>
  )
}

export function ClusterHalf() {
  return (
    <Group
      title="The cluster — a row that wraps, one step of space between (#1180)"
      lede="Three gaps, an optional row gap and an optional alignment. Like the Stack, the Cluster owns the space between its children and nothing else. The anatomy is the header of src/styles/system/cluster.css."
    >
      <Entry
        title="Cluster"
        path={CLUSTER_PATH}
        wide
        note="Each column is held narrow so the run wraps. Snug is the default. rowGap is the space between lines and equals gap when left out: 39 existing rows set two gap values, and rowGap is how a Cluster says so. align is the cross axis of a line, and left out the items stretch. A Cluster with as=ul or as=ol drops the marker and the indent."
      >
        <div className="dlab__row">
          {CLUSTERS.map(({ label, note, props }) => (
            <div key={label} style={{ maxWidth: '12rem' }}>
              <TagRun {...props} />
              <p className="dlab__path">
                {label}
                <span className="dlab__count">{note}</span>
              </p>
            </div>
          ))}
        </div>
      </Entry>
      <Entry
        title="Cluster align"
        path={CLUSTER_PATH}
        wide
        note="A tag beside a taller item, on one line. Start pins them to the top, center to the middle, baseline to the first line of text, which is how a figure and its label line up."
      >
        <div className="dlab__row">
          {['start', 'center', 'baseline'].map((align) => (
            <div key={align}>
              <Cluster align={align}>
                <Pill>Rookie</Pill>
                <span style={{ fontSize: '2rem' }}>.312</span>
              </Cluster>
              <p className="dlab__path">{align}</p>
            </div>
          ))}
        </div>
      </Entry>
    </Group>
  )
}
