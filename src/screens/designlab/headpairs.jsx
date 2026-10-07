import { Group } from './Entry.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import '../../styles/62-game-preview.css'

// The seven large card names (#1346, from #1113 H2). Gary picked on 2026-10-07:
// six became the 12px `label` SectionHead (their old rules are gone, so there
// is no "before" left to draw). `.pitchslab__title` stays large, on its heat
// band, as shipped. Its pair stays here as the one bespoke head.
// The offseason `.note` block is `.seasonnote` since H3 (#1339).
const PAIRS = [
  // On the heat band, as shipped (the ink is the band's own).
  { cls: 'pitchslab__title', size: 'fs-h3', text: 'Arsenal', band: true },
]

export function HeadPairs() {
  return (
    <Group
      title="Large card names: six moved, one kept"
      lede="Gary picked (2026-10-07): six names now wear the 12px label head. .pitchslab__title stays large. Top: the kept title. Bottom: the label head, for comparison."
      grid={false}
    >
      {PAIRS.map(({ cls, size, text, band }) => (
        <section key={cls} className="dlab__entry dlab__entry--wide">
          <h3 className="dlab__entrytitle">.{cls} <small>({size})</small></h3>
          <div className="dlab__stage">
            <div className={band ? 'pitchslab__head' : undefined}>
              <span className={cls}>{text}</span>
            </div>
          </div>
          <div className="dlab__stage">
            <SectionHead look="label" as="span">{text}</SectionHead>
          </div>
        </section>
      ))}
    </Group>
  )
}
