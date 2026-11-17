import { Segmented } from '../ui/control/Segmented.jsx'
import { Button } from '../ui/control/Button.jsx'
import './explorers.css'

// An explorer's ways to read its list: the house Segmented, each option a name with a
// one-line meaning under it (Gary, 2026-11-17; docs/explorers.md, "Tabs"). A tool that is
// not a list (Wild Rides' Draw) is `tool`, a separate dashed button at the row's end.
//
//   tabs   [{ value, label, sub }]
//   tool   { label, sub, active, onPick } or null
export function ExplorerTabs({ label, tabs, value, onChange, tool = null }) {
  const face = (t) => (
    <span className="xtabs__tab">
      <b>{t.label}</b>
      <span>{t.sub}</span>
    </span>
  )
  return (
    <div className="xtabs">
      <Segmented
        label={label}
        fill
        className="xtabs__seg"
        value={tool?.active ? null : value}
        onChange={onChange}
        options={tabs.map((t) => ({ value: t.value, label: face(t) }))}
      />
      {tool && (
        <Button skin="outline" pressed={tool.active} onClick={tool.onPick} className="xtabs__tool">
          {face(tool)}
        </Button>
      )}
    </div>
  )
}
