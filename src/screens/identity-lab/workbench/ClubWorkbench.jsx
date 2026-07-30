import { useState } from 'react'
import { CrestStrip } from './CrestStrip.jsx'
import { TwoBarsPanel } from './TwoBarsPanel.jsx'
import { LogoShelf } from './LogoShelf.jsx'
import { JerseyRack } from './JerseyRack.jsx'

// One club's whole kit pulled out onto the bench: who it is, its two header
// bars, every mark on file, every jersey on the rack, and one jersey open
// underneath. Mounted for the selected club only — which is also why the lazy
// lastOpponent fetch and the WinProbChart mockups cost less than the old
// expand-several-rows page did.
//
// Everything here is assembled from the profile's descriptor (benchItems /
// headerUnits / headerProps / markVisual / shelfMarks / Bench), so the MLB and
// MiLB dimensions share this layout without either one's data model leaking
// into it.
export function ClubWorkbench({ profile, team, prev, next, onStepTeam, extras, drafts, on, lastOpponent }) {
  const items = profile.benchItems(team.id, extras)
  const [selectedKey, setSelectedKey] = useState(items[0]?.key)
  const [hoveredSlot, setHoveredSlot] = useState(null)

  // A club whose catalog hasn't resolved a single jersey yet still has a crest
  // and a shelf worth showing, so this degrades rather than blanking.
  const selected = items.find((i) => i.key === selectedKey) ?? items[0]

  const units = profile.headerUnits(team.id).map((unit) => ({
    ...unit,
    name: team.name,
    anchorId: `idlab-bar-${team.id}-${unit.slot}`,
    header: profile.headerProps(team, unit.slot, drafts, extras, on),
    wearers: items
      .filter((item) => profile.headerSlotFor(item.treatment) === unit.slot)
      .map((item) => ({ key: item.key, label: item.label, visual: profile.markVisual(team.id, item.treatment, drafts) })),
  }))
  const barBySlot = Object.fromEntries(units.map((u) => [u.slot, u.header.unset ? null : u.header.colors.bar]))

  const rackItems = items.map((item) => {
    const slot = profile.headerSlotFor(item.treatment)
    return {
      ...item,
      visual: profile.markVisual(team.id, item.treatment, drafts),
      hasDraft: hasJerseyDraft(drafts, item.treatment),
      barSlot: slot,
      barColor: barBySlot[slot] ?? null,
    }
  })

  // A shelf mark names the treatment it belongs to; clicking it opens that
  // jersey. A WPA-only mark additionally scrolls its own section into view,
  // since that mark is only ever visible from there.
  const selectFromShelf = (mark) => {
    const item = items.find((i) => i.treatment === mark.treatment)
    if (item) setSelectedKey(item.key)
    if (!mark.wpaOnly) return
    requestAnimationFrame(() => {
      document.querySelector('.idlab__tuning .colorlab__wpapreview')?.scrollIntoView({ block: 'center' })
    })
  }

  return (
    <div className="idlab__workbench">
      <CrestStrip team={team} badge={profile.rowBadge?.(team.id)} prev={prev} next={next} onStep={onStepTeam} />

      <TwoBarsPanel units={units} onHover={setHoveredSlot} onSelectWearer={setSelectedKey} />

      <LogoShelf marks={profile.shelfMarks?.(team.id) ?? []} onSelect={selectFromShelf} />

      <JerseyRack
        items={rackItems}
        selectedKey={selected?.key}
        onSelect={setSelectedKey}
        highlightSlot={hoveredSlot}
      />

      {selected && (
        <profile.Bench
          key={selected.key}
          team={team}
          item={selected}
          lastOpponent={lastOpponent}
          extras={extras}
          drafts={drafts}
          on={on}
        />
      )}
    </div>
  )
}

// Whether THIS jersey carries an unsaved edit — the per-treatment stores only.
// A club-level colors draft belongs to the club, not to one jersey, so it lights
// the rail's own dot rather than every chip on the rack at once.
function hasJerseyDraft(drafts, treatment) {
  return ['pos', 'wpa', 'tcolors'].some((store) => Object.keys(drafts[store]?.[treatment] ?? {}).length > 0)
}
