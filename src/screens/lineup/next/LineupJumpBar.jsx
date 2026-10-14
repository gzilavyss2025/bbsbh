import { Cluster } from '../../../components/ui/layout/Cluster.jsx'

// The game's section bar in the jump bar's look (system/jumpbar): the stops are routes, so
// each button navigates and the current one is ink. Not the scroll-spy bar of a one-scroll
// page, which is why it does not use HubTabBar.
export function LineupJumpBar({ tabs, onSection }) {
  return (
    <nav className="jumpbar lnext__jump" aria-label="Game sections">
      <Cluster gap="snug" className="jumpbar__row">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`jumpbar__item${t.active ? ' is-current' : ''}`}
            aria-current={t.active ? 'page' : undefined}
            onClick={() => !t.active && onSection(t.section)}
          >
            {t.label}
          </button>
        ))}
      </Cluster>
    </nav>
  )
}
