import { Group } from './Entry.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import '../../styles/62-game-preview.css'

// BEFORE / AFTER for the seven card names set large (#1346, from #1113 H2).
// BEFORE is the shipped class, drawn as the app draws it. AFTER is the 12px
// `label` SectionHead. Nothing moves in the app until Gary picks from these.
// The offseason `.note` block is `.seasonnote` since H3 (#1339).
const PAIRS = [
  { cls: 'prospectcard__title', size: 'fs-h3', text: 'Prospect performance' },
  { cls: 'levelprog__title', size: 'fs-h3', text: 'Path to the Majors' },
  { cls: 'gamestory__title', size: 'fs-ui', text: 'Coverage' },
  { cls: 'posterstudio__title', size: 'fs-h3', text: 'Preview card' },
  { cls: 'seasonnote__title', size: 'fs-title-md', text: 'Youngest regulars' },
  { cls: 'srecord__title', size: 'fs-title-sm', text: 'Season record' },
  // On the heat band, as shipped (the ink is the band's own).
  { cls: 'pitchslab__title', size: 'fs-h3', text: 'Arsenal', band: true },
]

export function HeadPairs() {
  return (
    <Group
      title="Seven large card names, before and after"
      lede="Top: today's title. Bottom: the 12px label head. Gary picks; no name has moved."
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
