import { Entry, Group } from './Entry.jsx'

// The REAL Stack, and the real Card as the thing stacked — never a copy of
// either's markup.
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'

const PATH = 'src/components/ui/layout/Stack.jsx'

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
