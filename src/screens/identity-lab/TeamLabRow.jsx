import { useEffect, useState } from 'react'
import { fetchLastOpponent } from '../../api/schedule.js'
import { teamAnchorId } from './teamAnchorId.js'

// One club's collapsible row. `children` is a render function taking the row's
// resolved `lastOpponent`, so the tiles inside can hand it to WpaScenarios.
//
// The opponent is fetched once, lazily, and only while the row is EXPANDED:
// `undefined` means "haven't tried yet". A fresh visit starts every row
// collapsed (see the collapsed store's own default) specifically so a page load
// doesn't fire 30 — or, at the MiLB levels, 120 — schedule requests up front;
// unlike the one batched uniform-catalog fetch, there's no multi-team schedule
// endpoint to spread this over. It stays cached in this row's state once it
// resolves, so re-collapsing and re-expanding never re-fetches.
export function TeamLabRow({ teamId, name, sportId, badge, logos, collapsed, onToggleCollapsed, children }) {
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

  return (
    <section className="colorlab__row" id={teamAnchorId(teamId)}>
      <button
        type="button"
        className="colorlab__teamtoggle"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className="colorlab__teamname">{name}</span>
        {badge}
        <span className="colorlab__teamchevron" aria-hidden="true">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {/* Every mark this club actually renders somewhere on the site, at a
          glance without expanding the row — the CDN SVG for a plain
          treatment, a procured/hand-recolored PNG for the rest, or a
          separately uploaded WPA-only mark (`profile.rowLogos`, MLB only —
          absent for MiLB, same "absent rather than special-cased" pattern
          `upload`/`nameField` already follow). Collapsed-only: once expanded,
          every one of these already appears as its own tile's logo box. */}
      {collapsed && logos?.length > 0 && <RowLogoStrip name={name} logos={logos} />}
      {!collapsed && <div className="colorlab__treatments">{children(lastOpponent)}</div>}
    </section>
  )
}

// A mark that 404s (art not actually procured for a treatment the club
// otherwise qualifies for, e.g. an unset Alternate 4) just drops out of the
// strip rather than showing a broken image — the row itself already gates
// on `hasAlternate2/3/4`/`hasCityConnect`, so a real miss here means the
// file genuinely isn't on disk yet, not a bad url.
function RowLogo({ name, label, url }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      key={url}
      src={url}
      alt={`${name} — ${label}`}
      title={label}
      className="colorlab__rowlogo"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

function RowLogoStrip({ name, logos }) {
  return (
    <div className="colorlab__rowlogos">
      {logos.map((l) => (
        <RowLogo key={l.key} name={name} label={l.label} url={l.url} />
      ))}
    </div>
  )
}
