import { SiteHeader } from '../../components/SiteHeader.jsx'

// The chrome every dimension of the lab shares: site bar, title, hint, and the
// dimension nav that replaced five separate unlisted routes with one
// (/identity-lab). The nav reuses .patternlab__filters, which the MiLB screen
// already used for exactly this job.
//
// `chrome` says which fixed furniture the dimension's own body will render, so
// the page can reserve room for it: 'workbench' (club rail + dugout — the two
// colour dimensions), 'jump' (club rail only — the Jersey Audit's list of
// anchors), or 'plain' (the WPA pattern catalog, which has its own level
// filters and nothing to select).
export function LabShell({ title, hint, chrome, profiles, activeKey, onPick, children }) {
  const railed = chrome === 'workbench' || chrome === 'jump'
  const className = [
    'screen',
    'screen--identitylab',
    railed ? 'screen--idlab-railed' : '',
    chrome === 'workbench' ? 'screen--idlab-dugout' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">{title}</h1>
      </header>
      <p className="hint">{hint}</p>

      <nav className="patternlab__filters" aria-label="Switch lab dimension">
        {profiles.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`patternlab__filterbtn${p.key === activeKey ? ' is-active' : ''}`}
            aria-current={p.key === activeKey ? 'page' : undefined}
            onClick={() => onPick(p.key)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {children}
    </div>
  )
}
