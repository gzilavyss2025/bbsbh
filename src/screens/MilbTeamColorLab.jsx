import { useEffect, useState } from 'react'
import { CopyIconButton } from '../components/CopyBox.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { WinProbChart } from '../components/WinProbChart.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { fetchLastOpponent } from '../api/schedule.js'
import { teamAbbr } from '../lib/teams.js'
import {
  MILB_COLOR_LAB_LEVELS,
  milbColorPair,
  milbHasResearchedColor,
  milbLogoPosition,
  milbWpaLogoLayout,
  milbWpaBandColor,
  milbWpaBandPinstripeColor,
  milbHeaderColorsFor,
} from '../lib/milbColors.js'

// Simplified MiLB counterpart of Team Color Lab (screens/TeamColorLab.jsx) —
// same design-lab pattern (propose in the lab, copy a snippet, land it by
// hand in lib/milbColors.js) but deliberately NOT the same catalog. MLB gets
// a Main/Alternate/City-Connect/… treatment system because real per-jersey
// art and colors exist and are worth curating one at a time; MiLB has too
// many one-off jerseys, reported inconsistently across statsapi, for that to
// be worth the effort. So every MiLB affiliate gets exactly two variations —
// Home and Away — built from one researched primary/secondary pair
// (lib/milbColors.js), no exceptions, and never cross-links to the MLB page.
//
// One route per full-season level (Triple-A/Double-A/High-A/Single-A —
// complex/rookie leagues have no stable per-club identity, same exclusion
// TeamPatternLab.jsx already makes), all four rendered by this one
// component parameterized by `level` (see MILB_COLOR_LAB_LEVELS,
// lib/milbColors.js) — App.jsx lazy-imports one named export per route.

const VARIANTS = [
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
]

function affiliatesStorageKey(level, suffix) {
  return `bbsbh:milb-team-color-lab:${level.key}:${suffix}`
}

function useDraftStore(key) {
  const [draft, setDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')
    } catch {
      return {}
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(draft))
  }, [key, draft])
  const setField = (teamId, variant, field, value) =>
    setDraft((was) => ({
      ...was,
      [teamId]: {
        ...was[teamId],
        [variant]: { ...was[teamId]?.[variant], [field]: value },
      },
    }))
  const reset = (teamId, variant) =>
    setDraft((was) => {
      if (!was[teamId]) return was
      const nextTeam = { ...was[teamId] }
      delete nextTeam[variant]
      return { ...was, [teamId]: nextTeam }
    })
  return [draft, setField, reset]
}

function loadCollapsed(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

function teamAnchorId(teamId) {
  return `milb-colorlab-team-${teamId}`
}

function MilbTeamColorLabPage({ level }) {
  useDocumentTitle(`Team Color Lab — ${level.label} (MiLB)`)
  const [teams, setTeams] = useState(null) // [{ id, name }] | null while loading
  const collapsedKey = affiliatesStorageKey(level, 'collapsed')
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(collapsedKey))
  const [posDraft, setPosField, resetPosDraft] = useDraftStore(affiliatesStorageKey(level, 'logopos'))
  const [wpaDraft, setWpaField, resetWpaDraft] = useDraftStore(affiliatesStorageKey(level, 'wpa'))
  const [headerDraft, setHeaderField, resetHeaderDraft] = useDraftStore(affiliatesStorageKey(level, 'headercolors'))

  useEffect(() => {
    let cancelled = false
    fetch('/data/affiliates.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const rows = []
        for (const affiliates of Object.values(data.byOrgId)) {
          for (const a of affiliates) {
            if (a.sportId === level.sportId) rows.push({ id: a.id, name: a.name })
          }
        }
        rows.sort((x, y) => x.name.localeCompare(y.name))
        setTeams(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [level.sportId])

  useEffect(() => {
    localStorage.setItem(collapsedKey, JSON.stringify(collapsed))
  }, [collapsedKey, collapsed])

  const toggleCollapsed = (teamId) =>
    setCollapsed((was) => ({ ...was, [teamId]: was[teamId] === false ? true : false }))

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Team Color Lab — {level.label} (MiLB)</h1>
      </header>
      <p className="hint">
        An unlisted design harness — not linked anywhere in the app, and
        deliberately not cross-linked to the MLB Team Color Lab. Every{' '}
        {level.label} affiliate gets exactly two variations, Home and Away,
        built from one researched primary/secondary color pair (see{' '}
        <code>src/lib/milbColors.js</code>) — no per-jersey treatment catalog
        like the MLB page, since MiLB clubs wear too many one-off jerseys,
        reported too inconsistently across statsapi, for that to be worth
        curating one at a time. A team shown with a gray placeholder pair
        has no confidently-researched color yet. Position lets you nudge/
        rescale the logo tile and try a new background; WPA previews the
        real win-probability band (against that team&rsquo;s most recent
        opponent) at three score states; Header colors is an unwired mockup.
        Every proposed edit has a copy icon that tells Claude exactly what
        to change and where.
      </p>

      <nav className="patternlab__filters" aria-label="Switch MiLB level">
        {MILB_COLOR_LAB_LEVELS.map((l) => (
          <a
            key={l.key}
            href={`/${l.routeName}`}
            className={`patternlab__filterbtn${l.key === level.key ? ' is-active' : ''}`}
            aria-current={l.key === level.key ? 'page' : undefined}
          >
            {l.label}
          </a>
        ))}
      </nav>

      {teams === null ? (
        <p className="hint">Loading affiliate list…</p>
      ) : (
        <div className="colorlab__layout">
          <nav className="colorlab__nav" aria-label="Jump to team">
            {teams.map((t) => (
              <a key={t.id} className="colorlab__navlink" href={`#${teamAnchorId(t.id)}`} title={t.name}>
                <TeamLogo teamId={t.id} name={t.name} size={28} />
              </a>
            ))}
          </nav>
          <div className="colorlab">
            {teams.map((t) => (
              <TeamRow
                key={t.id}
                teamId={t.id}
                name={t.name}
                sportId={level.sportId}
                collapsed={collapsed[t.id] !== false}
                onToggleCollapsed={() => toggleCollapsed(t.id)}
                posDraft={posDraft[t.id]}
                onPosField={(variant, field, value) => setPosField(t.id, variant, field, value)}
                onPosReset={(variant) => resetPosDraft(t.id, variant)}
                wpaDraft={wpaDraft[t.id]}
                onWpaField={(variant, field, value) => setWpaField(t.id, variant, field, value)}
                onWpaReset={(variant) => resetWpaDraft(t.id, variant)}
                headerDraft={headerDraft[t.id]}
                onHeaderField={(variant, field, value) => setHeaderField(t.id, variant, field, value)}
                onHeaderReset={(variant) => resetHeaderDraft(t.id, variant)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeamRow({
  teamId,
  name,
  sportId,
  collapsed,
  onToggleCollapsed,
  posDraft,
  onPosField,
  onPosReset,
  wpaDraft,
  onWpaField,
  onWpaReset,
  headerDraft,
  onHeaderField,
  onHeaderReset,
}) {
  // Same lazy, row-expansion-gated fetch as TeamColorLab.jsx's TeamColorRow —
  // a fresh page load starts every row collapsed specifically so this
  // doesn't fire for every affiliate in the level at once.
  const [lastOpponent, setLastOpponent] = useState(undefined)
  useEffect(() => {
    if (collapsed || lastOpponent !== undefined) return
    let cancelled = false
    fetchLastOpponent(teamId, new Date().getFullYear(), sportId).then((opp) => {
      if (!cancelled) setLastOpponent(opp ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [collapsed, teamId, sportId, lastOpponent])

  const hasResearched = milbHasResearchedColor(teamId)

  return (
    <section className="colorlab__row" id={teamAnchorId(teamId)}>
      <button
        type="button"
        className="colorlab__teamtoggle"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className="colorlab__teamname">{name}</span>
        {!hasResearched && <span className="hint hint--error">no researched color</span>}
        <span className="colorlab__teamchevron" aria-hidden="true">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed && (
        <div className="colorlab__treatments">
          {VARIANTS.map((v) => (
            <VariantBox
              key={v.key}
              teamId={teamId}
              name={name}
              variant={v.key}
              label={v.label}
              lastOpponent={lastOpponent}
              posDraft={posDraft?.[v.key]}
              onPosField={(field, value) => onPosField(v.key, field, value)}
              onPosReset={() => onPosReset(v.key)}
              wpaDraft={wpaDraft?.[v.key]}
              onWpaField={(field, value) => onWpaField(v.key, field, value)}
              onWpaReset={() => onWpaReset(v.key)}
              headerDraft={headerDraft?.[v.key]}
              onHeaderField={(field, value) => onHeaderField(v.key, field, value)}
              onHeaderReset={() => onHeaderReset(v.key)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function VariantBox({
  teamId,
  name,
  variant,
  label,
  lastOpponent,
  posDraft,
  onPosField,
  onPosReset,
  wpaDraft,
  onWpaField,
  onWpaReset,
  headerDraft,
  onHeaderField,
  onHeaderReset,
}) {
  const [primary, secondary] = milbColorPair(teamId)
  const pos = milbLogoPosition(teamId, variant, posDraft)
  const hasPosDraft = posDraft && Object.keys(posDraft).length > 0
  const logoboxClass = `colorlab__logobox colorlab__logobox--gloss${pos.pinstripe ? ' colorlab__logobox--pinstripe' : ''}`
  const logoboxStyle = {
    '--tint': pos.pinstripe ? undefined : pos.bg,
    '--scale': 1.32 * pos.scale,
    '--offset-x': `${pos.offsetX}%`,
    '--offset-y': `${pos.offsetY}%`,
    '--origin-y': 'center',
    '--pinstripe-color': pos.pinstripe ? pos.bg : undefined,
    '--pinstripe-bg': undefined,
  }

  const wpaPinstripe = milbWpaBandPinstripeColor(teamId, variant, wpaDraft)
  const wpaBand = milbWpaBandColor(teamId, variant, wpaDraft)
  const wpaLayout = milbWpaLogoLayout(teamId, variant, wpaDraft)
  const headerColors = milbHeaderColorsFor(teamId, variant, headerDraft)

  return (
    <div className="colorlab__treatment">
      <div className="colorlab__treatmentlabelrow">
        <span className="colorlab__treatmentlabel">{label}</span>
      </div>
      <div className="colorlab__treatmentbox">
        <div className={logoboxClass} style={logoboxStyle}>
          <TeamLogo teamId={teamId} name={name} size={64} />
        </div>
        <div className="colorlab__swatchrow">
          <ColorSwatch label="Primary" hex={primary} active={pos.bg.toLowerCase() === primary.toLowerCase()} /> {/* caps-js-exempt */}
          <ColorSwatch label="Secondary" hex={secondary} active={pos.bg.toLowerCase() === secondary.toLowerCase()} /> {/* caps-js-exempt */}
        </div>
        <LogoPositionControls
          teamId={teamId}
          name={name}
          variant={variant}
          variantLabel={label}
          pos={pos}
          hasDraft={hasPosDraft}
          onField={onPosField}
          onReset={onPosReset}
        />
      </div>
      <WpaPreview
        teamId={teamId}
        name={name}
        variant={variant}
        variantLabel={label}
        layout={wpaLayout}
        pinstripe={Boolean(wpaPinstripe)}
        bandColor={wpaPinstripe ?? wpaBand}
        draft={wpaDraft}
        onField={onWpaField}
        onReset={onWpaReset}
      />
      <WpaScenarios
        teamId={teamId}
        name={name}
        variant={variant}
        lastOpponent={lastOpponent}
        headerColors={headerColors}
        wpaLayout={wpaLayout}
        wpaBandOverride={{ pinstripe: Boolean(wpaPinstripe), color: wpaPinstripe ?? wpaBand }}
      />
      <HeaderPreview
        teamId={teamId}
        name={name}
        variant={variant}
        variantLabel={label}
        colors={headerColors}
        draft={headerDraft}
        onField={onHeaderField}
        onReset={onHeaderReset}
      />
    </div>
  )
}

function ColorSwatch({ label, hex, active }) {
  return (
    <div className={`colorlab__swatchcell${active ? ' colorlab__swatchcell--active' : ''}`}>
      <div className="colorlab__swatchchip" style={{ background: hex }} />
      <span className="colorlab__swatchlabel">{label}</span>
      <span className="colorlab__swatchhex">{hex}</span>
    </div>
  )
}

function LogoPositionControls({ teamId, name, variant, variantLabel, pos, hasDraft, onField, onReset }) {
  const copyText =
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/milbColors.js — MILB_LOGO_POS_OVERRIDES[${teamId}].${variant}\n` +
    `MILB_LOGO_POS_OVERRIDES[${teamId}] = { ...MILB_LOGO_POS_OVERRIDES[${teamId}], ` +
    `${variant}: { scale: ${pos.scale}, offsetX: ${pos.offsetX}, offsetY: ${pos.offsetY}, ` +
    `bg: '${pos.bg}', pinstripe: ${pos.pinstripe} } }`
  return (
    <div className="colorlab__posinline">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Position</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${variantLabel} logo-position context`} />
      </div>
      <div className="colorlab__posinlinefields">
        <label>
          <span>Scale</span>
          <input
            type="number"
            step="0.01"
            value={pos.scale}
            onChange={(e) => onField('scale', Number(e.target.value))}
          />
        </label>
        <label>
          <span>X</span>
          <input type="number" value={pos.offsetX} onChange={(e) => onField('offsetX', Number(e.target.value))} />
        </label>
        <label>
          <span>Y</span>
          <input type="number" value={pos.offsetY} onChange={(e) => onField('offsetY', Number(e.target.value))} />
        </label>
        <label className="colorlab__posbgfield">
          <span>{pos.pinstripe ? 'Stripe' : 'Background'}</span>
          <input type="text" value={pos.bg} placeholder="#hex" onChange={(e) => onField('bg', e.target.value)} />
        </label>
        <label className="colorlab__posbgfield colorlab__poscheck">
          <input type="checkbox" checked={pos.pinstripe} onChange={(e) => onField('pinstripe', e.target.checked)} />
          <span>Pinstripe</span>
        </label>
      </div>
    </div>
  )
}

function WpaPreview({ teamId, name, variant, variantLabel, layout, pinstripe, bandColor, draft, onField, onReset }) {
  const hasDraft = draft && Object.keys(draft).length > 0
  const overrideValue = pinstripe ? `{ pinstripe: true, color: '${bandColor}' }` : `'${bandColor}'`
  const copyText =
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/milbColors.js — MILB_WPA_LOGO_LAYOUT_OVERRIDES[${teamId}].${variant} / ` +
    `MILB_WPA_BAND_COLOR_OVERRIDES[${teamId}].${variant}\n` +
    `MILB_WPA_LOGO_LAYOUT_OVERRIDES[${teamId}] = { ...MILB_WPA_LOGO_LAYOUT_OVERRIDES[${teamId}], ` +
    `${variant}: { size: ${layout.size}, rotate: ${layout.rotate}, offsetX: ${layout.offsetX}, offsetY: ${layout.offsetY}, ` +
    `paddingX: ${layout.paddingX}, paddingY: ${layout.paddingY}, rowShift: ${layout.rowShift} } }\n` +
    `MILB_WPA_BAND_COLOR_OVERRIDES[${teamId}] = { ...MILB_WPA_BAND_COLOR_OVERRIDES[${teamId}], ` +
    `${variant}: ${overrideValue} }`

  return (
    <div className="colorlab__wpapreview">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">WPA</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${variantLabel} WPA context`} />
      </div>
      <div className="colorlab__wpapreviewfields">
        <label>
          <span>Size</span>
          <input type="number" value={layout.size} onChange={(e) => onField('size', Number(e.target.value))} />
        </label>
        <label>
          <span>Rotate</span>
          <input type="number" value={layout.rotate} onChange={(e) => onField('rotate', Number(e.target.value))} />
        </label>
        <label>
          <span>X</span>
          <input type="number" value={layout.offsetX} onChange={(e) => onField('offsetX', Number(e.target.value))} />
        </label>
        <label>
          <span>Y</span>
          <input type="number" value={layout.offsetY} onChange={(e) => onField('offsetY', Number(e.target.value))} />
        </label>
        <label>
          <span>H-Pad</span>
          <input type="number" value={layout.paddingX} onChange={(e) => onField('paddingX', Number(e.target.value))} />
        </label>
        <label>
          <span>V-Pad</span>
          <input type="number" value={layout.paddingY} onChange={(e) => onField('paddingY', Number(e.target.value))} />
        </label>
        <label>
          <span>Shift %</span>
          <input type="number" value={layout.rowShift} onChange={(e) => onField('rowShift', Number(e.target.value))} />
        </label>
        <label className="colorlab__wpapreviewcolor">
          <span>{pinstripe ? 'Stripe' : 'Band'}</span>
          <input type="text" value={bandColor} onChange={(e) => onField('bandColor', e.target.value)} />
        </label>
        <label className="colorlab__wpapreviewcolor colorlab__wpapreviewcheck">
          <input type="checkbox" checked={pinstripe} onChange={(e) => onField('pinstripe', e.target.checked)} />
          <span>Pinstripe</span>
        </label>
      </div>
    </div>
  )
}

// Same three fixed win-probability states as Team Color Lab's own
// WPA_MOCK_SCENARIOS — losing/tied/winning — so a band's readability at
// different score states can be judged directly instead of guessing from one
// static tile.
const WPA_MOCK_SCENARIOS = [
  { key: 'losing', label: 'Losing', homePct: 20 },
  { key: 'tied', label: '50/50', homePct: 50 },
  { key: 'winning', label: 'Winning', homePct: 80 },
]

// This tile's own team ALWAYS plays the chart's home slot, its opponent
// always the away slot in their own real colors — same convention as
// TeamColorLab.jsx's TreatmentWpaScenarios, where "home" is a rendering
// slot, not a claim about which variation is being previewed (a club's Away
// variation is just as valid a preview against a real opponent as its Home
// one; only the color/layout override fed in via homeBandOverride/
// homeLayoutOverride changes between the two tiles). Renders nothing until
// lastOpponent resolves.
function WpaScenarios({ teamId, name, variant, lastOpponent, headerColors, wpaLayout, wpaBandOverride }) {
  if (!lastOpponent) return null
  const homeAbbr = teamAbbr({ id: teamId, name })
  return (
    <div
      className="colorlab__wpascenarios"
      style={{ '--navy': headerColors.blue, '--seal': headerColors.gold, '--text-on-ink': headerColors.font }}
    >
      {WPA_MOCK_SCENARIOS.map((s) => (
        <div className="colorlab__wpascenario" key={s.key}>
          <span className="colorlab__wpascenariolabel">{s.label}</span>
          <WinProbChart
            points={[{ home: s.homePct, inning: 1, half: 'top' }]}
            awayId={lastOpponent.id}
            homeId={teamId}
            awayAbbr={lastOpponent.abbreviation}
            homeAbbr={homeAbbr}
            awayTreatment="main"
            homeLayoutOverride={wpaLayout}
            homeBandOverride={wpaBandOverride}
            homeTreatment={variant}
          />
        </div>
      ))}
    </div>
  )
}

function HeaderPreview({ teamId, name, variant, variantLabel, colors, draft, onField, onReset }) {
  const { blue, gold, font } = colors
  const hasDraft = draft && Object.keys(draft).length > 0
  const copyText =
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/milbColors.js — MILB_HEADER_COLOR_OVERRIDES[${teamId}].${variant} ` +
    `(design-lab preview only — no real component reads this table yet)\n` +
    `blue: ${blue}, gold: ${gold}, font: ${font}`
  return (
    <div className="colorlab__wpapreview colorlab__headerpreview">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Header colors</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${variantLabel} header-color context`} />
      </div>
      <div className="colorlab__headerpreviewbody">
        <div className="colorlab__headerfields">
          <label>
            <span>Blue</span>
            <input type="text" value={blue} onChange={(e) => onField('blue', e.target.value)} />
          </label>
          <label>
            <span>Gold</span>
            <input type="text" value={gold} onChange={(e) => onField('gold', e.target.value)} />
          </label>
          <label>
            <span>Font</span>
            <input type="text" value={font} onChange={(e) => onField('font', e.target.value)} />
          </label>
        </div>
        <div
          className="colorlab__headerbar"
          style={{ '--header-blue': blue, '--header-gold': gold, '--header-font': font }}
        >
          <span className="colorlab__headerbar__title">{name}</span>
        </div>
      </div>
    </div>
  )
}

export function MilbTeamColorLabAAA() {
  return <MilbTeamColorLabPage level={MILB_COLOR_LAB_LEVELS[0]} />
}
export function MilbTeamColorLabAA() {
  return <MilbTeamColorLabPage level={MILB_COLOR_LAB_LEVELS[1]} />
}
export function MilbTeamColorLabHighA() {
  return <MilbTeamColorLabPage level={MILB_COLOR_LAB_LEVELS[2]} />
}
export function MilbTeamColorLabA() {
  return <MilbTeamColorLabPage level={MILB_COLOR_LAB_LEVELS[3]} />
}
