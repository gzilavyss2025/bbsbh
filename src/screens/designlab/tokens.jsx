import { useMemo } from 'react'
import { PAIRINGS, ratio } from '../../lib/design/contrastPairings.js'
import { Entry, Group } from './Entry.jsx'

// ---------------------------------------------------------------------------
// HALF ONE OF THE DESIGN LAB: the tokens.
//
// NOTHING HERE IS A LIST OF TOKEN NAMES. The names are read from the SHIPPED
// stylesheet at runtime — every `:root` rule in document.styleSheets — so a
// token added to src/tokens/*.css appears on this page without anyone
// remembering to add it. That is the difference between a catalog and a second
// copy of the design system, and a second copy is the thing #1112 exists to
// stop.
//
// Two values per token, and they are not the same question:
//   DECLARED  — what the author wrote (`var(--paper-2)`), read off the CSSOM
//               rule. This is what shows an alias pointing at its primitive.
//   RESOLVED  — what the browser computed (`#FBF6E9`), read with
//               getComputedStyle. This is what the user actually sees, and it
//               is what the contrast ratios below are computed from.
//
// A token that matches no group below lands in "Unfiled" and is VISIBLE there.
// That is deliberate: a new token should show up as unfiled and get filed,
// rather than be silently missing from the page that exists to show it.

const GROUPS = [
  {
    id: 'color',
    title: 'colors.css — the palette',
    file: 'src/tokens/colors.css',
    match: (n) =>
      /^(paper|ink|graphite|rule|field|clay|navy|allstar|seal|kraft|album|marker|award|bg|surface|text|border|accent|winprob|arsenal|heat|batted|book)(-|$)/.test(n) ||
      n === 'focus-ring',
  },
  {
    id: 'type',
    title: 'typography.css — the roles',
    file: 'src/tokens/typography.css',
    match: (n) => /^(font|w|fs|lh|ls)-/.test(n),
  },
  {
    id: 'space',
    title: 'spacing.css — the 4px scale, radii, borders',
    file: 'src/tokens/spacing.css',
    match: (n) => /^(space|radius|bw)-/.test(n),
  },
  {
    id: 'layout',
    title: 'layout.css — the measured dimensions',
    file: 'src/tokens/layout.css',
    // `refrail` and `xl` joined this list when the four dimensions the page's
    // first run found unfiled moved out of their component partials and into
    // layout.css (#1127). The list is names, not files, so a token has to be
    // both moved AND matched here before the page stops calling it unfiled.
    match: (n) => /^(cell|shot|app|tap|console|slate|focus-bar|skel|refrail|xl)-/.test(n),
  },
  {
    id: 'effects',
    title: 'effects.css — shadows, motion',
    file: 'src/tokens/effects.css',
    // `-texture` rather than a prefix: the two kraft/tape textures are named
    // for the surface they dress (--il-texture, --win-texture), not for what
    // they are. They live in effects.css with the shadows.
    match: (n) => /^(shadow|inset|ease|dur)-/.test(n) || /-texture$/.test(n) || n === 'ring',
  },
]

// Every custom property declared on :root, with what the author wrote.
// Walks the CSSOM rather than fetching the source, so it reports what SHIPPED.
function readDeclaredTokens() {
  const out = new Map()
  for (const sheet of Array.from(document.styleSheets)) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue // a cross-origin sheet (a font CDN) — nothing of ours in it
    }
    for (const rule of Array.from(rules || [])) {
      if (!(rule.selectorText || '').split(',').some((s) => s.trim() === ':root')) continue
      for (const prop of Array.from(rule.style)) {
        if (!prop.startsWith('--')) continue
        // Later sheets win, which is the cascade this page is reporting.
        out.set(prop.slice(2), rule.style.getPropertyValue(prop).trim())
      }
    }
  }
  return out
}

// Read once, during render. The tokens cannot change after the stylesheet is
// applied, and src/index.css is imported by main.jsx before React mounts, so
// the values are already there on the first pass — no effect, no second render.
function useTokens() {
  return useMemo(() => {
    const declared = readDeclaredTokens()
    const root = getComputedStyle(document.documentElement)
    return [...declared].map(([name, value]) => ({
      name,
      declared: value,
      resolved: root.getPropertyValue(`--${name}`).trim(),
    }))
  }, [])
}

const isColor = (v) => /^(#|rgb|hsl)/i.test(v)
const isLength = (v) => /^-?[\d.]+(px|em|rem)$/.test(v)

// ---------------------------------------------------------------------------

function Swatch({ token }) {
  const alias = token.declared.startsWith('var(')
  return (
    <div className="dlab__swatch">
      <span className="dlab__chip" style={{ background: token.resolved }} aria-hidden="true" />
      <span className="dlab__swatchname">--{token.name}</span>
      <span className="dlab__swatchval">
        {alias ? `${token.declared} = ${token.resolved}` : token.resolved}
      </span>
    </div>
  )
}

function TypeSpecimen({ token }) {
  // A --fs-* role, set at its real size in the family that role is used in.
  // The sample says its own name, so the specimen and its label cannot drift.
  return (
    <div className="dlab__typerow">
      <span className="dlab__typelabel">
        --{token.name}
        <span className="dlab__typeval">{token.resolved}</span>
      </span>
      <span className="dlab__typesample" style={{ fontSize: token.resolved }}>
        Bottom 9th, two out
      </span>
    </div>
  )
}

function MeasureBar({ token }) {
  return (
    <div className="dlab__measure">
      <span className="dlab__swatchname">--{token.name}</span>
      <span className="dlab__bar" style={{ width: token.resolved }} aria-hidden="true" />
      <span className="dlab__swatchval">{token.resolved}</span>
    </div>
  )
}

function RadiusBox({ token }) {
  return (
    <div className="dlab__radius">
      <span className="dlab__radiusbox" style={{ borderRadius: token.resolved }} aria-hidden="true" />
      <span className="dlab__swatchname">--{token.name}</span>
      <span className="dlab__swatchval">{token.resolved}</span>
    </div>
  )
}

function ShadowBox({ token }) {
  return (
    <div className="dlab__shadow">
      <span className="dlab__shadowbox" style={{ boxShadow: token.resolved }} aria-hidden="true" />
      <span className="dlab__swatchname">--{token.name}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The contrast table. Same list the build enforces — imported, not restated —
// but resolved LIVE through getComputedStyle, so this reports what the browser
// renders rather than what a file parse predicted.
function ContrastTable() {
  const rows = useMemo(() => {
    const root = getComputedStyle(document.documentElement)
    const hex = (ref) => (ref.startsWith('#') ? ref : root.getPropertyValue(`--${ref}`).trim())
    return PAIRINGS.map((p) => {
      const fg = hex(p.fg)
      const bg = hex(p.bg)
      let value = null
      try {
        value = ratio(fg, bg)
      } catch {
        value = null // a token that did not resolve — reported as a miss below
      }
      return { ...p, fg, bg, value }
    })
  }, [])

  return (
    <div className="dlab__rows">
      {rows.map((r, i) => (
        <div className="dlab__pair" key={`${r.fg}-${r.bg}-${i}`}>
          <span className="dlab__pairsample" style={{ background: r.bg, color: r.fg }}>
            Bottom 9th
          </span>
          <span className="dlab__pairnote">{r.note}</span>
          <span
            className={`dlab__ratio${r.value !== null && r.value < r.min ? ' dlab__ratio--under' : ''}`}
          >
            {r.value === null ? 'unresolved' : `${r.value.toFixed(2)}:1`}
            <span className="dlab__ratiomin">needs {r.min}:1</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function TokenHalf() {
  const tokens = useTokens()
  const bucket = (id) => tokens.filter((t) => GROUPS.find((g) => g.id === id)?.match(t.name))
  const unfiled = tokens.filter((t) => !GROUPS.some((g) => g.match(t.name)))

  const colors = bucket('color')
  const type = bucket('type')
  const space = bucket('space')
  const layout = bucket('layout')
  const effects = bucket('effects')

  const fs = type.filter((t) => t.name.startsWith('fs-'))
  const families = type.filter((t) => t.name.startsWith('font-'))
  const weights = type.filter((t) => t.name.startsWith('w-'))
  const leading = type.filter((t) => t.name.startsWith('lh-'))
  const tracking = type.filter((t) => t.name.startsWith('ls-'))

  const steps = space.filter((t) => t.name.startsWith('space-'))
  const radii = space.filter((t) => t.name.startsWith('radius-'))
  const borders = space.filter((t) => t.name.startsWith('bw-'))

  const shots = layout.filter((t) => t.name.startsWith('shot-'))
  const otherLayout = layout.filter((t) => !t.name.startsWith('shot-'))

  const shadows = effects.filter((t) => /^(shadow|inset)-/.test(t.name) || t.name === 'ring')
  const motion = effects.filter((t) => /^(ease|dur)-/.test(t.name))

  return (
    <>
      <Group title={`colors.css — ${colors.length} properties`} grid={false}>
        <div className="dlab__swatches">
          {colors.map((t) => (
            <Swatch key={t.name} token={t} />
          ))}
        </div>
      </Group>

      <Group
        title="The enforced contrast pairings"
        lede={`${PAIRINGS.length} pairs, imported from src/lib/design/contrastPairings.js — the same list scripts/check-contrast.mjs fails the build on. Resolved live here, so this is what the browser renders, not what a file parse predicted.`}
        grid={false}
      >
        <ContrastTable />
      </Group>

      <Group title="fonts.css — the four faces" grid={false}>
        <div className="dlab__rows">
          {families.map((t) => (
            <div className="dlab__typerow" key={t.name}>
              <span className="dlab__typelabel">
                --{t.name}
                <span className="dlab__typeval">{t.declared.split(',')[0].replace(/"/g, '')}</span>
              </span>
              <span className="dlab__typesample dlab__typesample--lg" style={{ fontFamily: t.resolved }}>
                Bottom 9th, two out
              </span>
            </div>
          ))}
        </div>
        <p className="dlab__warn">
          Barlow Condensed and JetBrains Mono ship ONE weight each — 700. Every rule that asks
          either family for {weights.map((w) => `--${w.name}`).join(', ')} renders at 700, so
          font-weight is a no-op on the display and mono faces. It is a deliberate trade, not an
          oversight (src/tokens/fonts.css), and it has cost time twice. Emphasise with colour or
          size instead. Source Sans 3 and Lora do ship real second weights.
        </p>
        <div className="dlab__rows">
          {weights.map((t) => (
            <div className="dlab__typerow" key={t.name}>
              <span className="dlab__typelabel">
                --{t.name}
                <span className="dlab__typeval">{t.resolved}</span>
              </span>
              <span
                className="dlab__typesample"
                style={{ fontFamily: 'var(--font-display)', fontWeight: t.resolved }}
              >
                Display face at {t.resolved} — identical to every other
              </span>
            </div>
          ))}
        </div>
      </Group>

      <Group title={`typography.css — ${fs.length} size roles, at their real size`} grid={false}>
        <div className="dlab__rows">
          {fs.map((t) => (
            <TypeSpecimen key={t.name} token={t} />
          ))}
        </div>
      </Group>

      <Group title="Leading and tracking" grid={false}>
        <div className="dlab__rows">
          {leading.map((t) => (
            <div className="dlab__typerow" key={t.name}>
              <span className="dlab__typelabel">
                --{t.name}
                <span className="dlab__typeval">{t.resolved}</span>
              </span>
              <span className="dlab__typesample dlab__typesample--wrap" style={{ lineHeight: t.resolved }}>
                Bottom 9th, two out, runner on second, the tying run at the plate
              </span>
            </div>
          ))}
          {tracking.map((t) => (
            <div className="dlab__typerow" key={t.name}>
              <span className="dlab__typelabel">
                --{t.name}
                <span className="dlab__typeval">{t.resolved}</span>
              </span>
              <span className="dlab__typesample" style={{ letterSpacing: t.resolved }}>
                Bottom 9th, two out
              </span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="spacing.css — the 4px step scale, drawn to scale" grid={false}>
        <div className="dlab__rows">
          {steps.map((t) => (
            <MeasureBar key={t.name} token={t} />
          ))}
        </div>
      </Group>

      <Group title="Radii and border widths" grid={false}>
        <div className="dlab__swatches">
          {radii.map((t) => (
            <RadiusBox key={t.name} token={t} />
          ))}
        </div>
        <div className="dlab__rows">
          {borders.map((t) => (
            <div className="dlab__measure" key={t.name}>
              <span className="dlab__swatchname">--{t.name}</span>
              <span
                className="dlab__rule"
                style={{ borderTopWidth: t.resolved }}
                aria-hidden="true"
              />
              <span className="dlab__swatchval">{t.resolved}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="layout.css — the six headshot rungs, to scale" grid={false}>
        <div className="dlab__swatches">
          {shots
            .filter((t) => t.name.endsWith('-w'))
            .map((t) => {
              const h = shots.find((s) => s.name === t.name.replace(/-w$/, '-h'))
              return (
                <div className="dlab__shot" key={t.name}>
                  <span
                    className="dlab__shotbox"
                    style={{ width: t.resolved, height: h?.resolved }}
                    aria-hidden="true"
                  />
                  <span className="dlab__swatchname">--{t.name.replace(/-w$/, '')}</span>
                  <span className="dlab__swatchval">
                    {t.resolved} × {h?.resolved ?? '—'}
                  </span>
                </div>
              )
            })}
        </div>
        <div className="dlab__rows">
          {otherLayout.map((t) =>
            isLength(t.resolved) ? (
              <MeasureBar key={t.name} token={t} />
            ) : (
              <div className="dlab__measure" key={t.name}>
                <span className="dlab__swatchname">--{t.name}</span>
                <span className="dlab__swatchval">{t.resolved}</span>
              </div>
            ),
          )}
        </div>
      </Group>

      <Group title="effects.css — shadows and the focus ring" grid={false}>
        <div className="dlab__swatches">
          {shadows.map((t) => (
            <ShadowBox key={t.name} token={t} />
          ))}
        </div>
        <div className="dlab__rows">
          {motion.map((t) => (
            <div className="dlab__measure" key={t.name}>
              <span className="dlab__swatchname">--{t.name}</span>
              <span className="dlab__swatchval">{t.resolved}</span>
            </div>
          ))}
        </div>
      </Group>

      {unfiled.length > 0 && (
        <Group
          title={`Unfiled — ${unfiled.length} properties`}
          lede="Declared on :root and matching none of the groups above — which means they are not in src/tokens/ at all. A component partial declared a global custom property instead of putting the dimension in tokens/layout.css, where src/CLAUDE.md says app-specific component geometry belongs. Not an error on its own; each one is worth a look."
          grid={false}
        >
          <div className="dlab__swatches">
            {unfiled.map((t) =>
              isColor(t.resolved) ? (
                <Swatch key={t.name} token={t} />
              ) : (
                <div className="dlab__measure" key={t.name}>
                  <span className="dlab__swatchname">--{t.name}</span>
                  <span className="dlab__swatchval">{t.resolved}</span>
                </div>
              ),
            )}
          </div>
        </Group>
      )}

      <Entry
        title="Every token on this page is read from the shipped stylesheet"
        note="Nothing above is a hand-kept list. The names come from every :root rule in document.styleSheets and the values from getComputedStyle, so a token added to src/tokens/ appears here on its own — and one that is removed disappears. A token matching no group lands in Unfiled rather than vanishing."
      />
    </>
  )
}
