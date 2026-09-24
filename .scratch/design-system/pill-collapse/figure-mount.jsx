// See figure-mount.html. Each variant is drawn 8 times; copy i sits i/8 px
// lower inside a fixed 44px slot, so the 8 copies land on 8 different
// fractional positions and a mean over them is the rule's bias, not one
// position's luck. The "plain" variants are the pill with the mono face and
// no figure rule, the state before #1186 with no nudge.
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'

const MONO = { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-cell)', letterSpacing: 'var(--ls-caps)' }
const MONO_13 = { ...MONO, fontSize: 'var(--fs-small)' }

const VARIANTS = [
  // figure tags (the rule)
  { v: 'tag-1px', cls: 'pill pill--paper pill--figure', text: 'AAA' },
  { v: 'tag-2px', cls: 'pill pill--paper pill--figure', style: { '--pill-pad-block': '2px' }, text: '15' },
  { v: 'tag-ink', cls: 'pill pill--ink pill--figure', style: { '--pill-pad-block': '2px' }, text: 'MIL +18%' },
  // figure controls (the rule): 11px like .depthpos, 13px like the level switches
  { v: 'ctl-11', el: 'button', cls: 'pill pill--control pill--paper pill--figure', text: 'SS' },
  { v: 'ctl-13', el: 'button', cls: 'pill pill--control pill--paper pill--figure', style: { fontSize: 'var(--fs-small)', letterSpacing: 'normal' }, text: 'AAA' },
  { v: 'ctl-13-on', el: 'button', pressed: true, cls: 'pill pill--control pill--paper pill--figure', style: { fontSize: 'var(--fs-small)', letterSpacing: 'normal' }, text: 'AAA' },
  // plain: the same pills with the mono face and no figure rule
  { v: 'plain-tag-1px', cls: 'pill pill--paper', style: { ...MONO, paddingBlock: '1px' }, text: 'AAA' },
  { v: 'plain-tag-2px', cls: 'pill pill--paper', style: { ...MONO }, text: '15' },
  { v: 'plain-ctl-11', el: 'button', cls: 'pill pill--control pill--paper', style: MONO, text: 'SS' },
  { v: 'plain-ctl-13', el: 'button', cls: 'pill pill--control pill--paper', style: { ...MONO_13, letterSpacing: 'normal' }, text: 'AAA' },
]

function Copy({ v, el = 'span', cls, style, text, pressed, i }) {
  const El = el
  const aria = pressed ? { 'aria-pressed': 'true' } : {}
  return (
    <div style={{ height: 44, paddingTop: i / 8, boxSizing: 'border-box' }}>
      <El className={cls} style={style} data-v={v} {...aria}>
        {text}
      </El>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <main className="screen" style={{ padding: 16 }}>
    {VARIANTS.map((variant) => (
      <section key={variant.v} style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 12 }}>{variant.v}</p>
        {Array.from({ length: 8 }, (_, i) => (
          <Copy key={i} i={i} {...variant} />
        ))}
      </section>
    ))}
  </main>,
)
