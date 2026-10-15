import { Cluster } from '../../../components/ui/layout/Cluster.jsx'

// The game's section bar in the jump bar's look (system/jumpbar): the stops are routes, so
// each button navigates and the current one is ink. Not the scroll-spy bar of a one-scroll
// page, which is why it does not use HubTabBar. `aside` (the innings page: the date, keep-awake
// and Watch) sits under the stops on a phone, where only the stops scroll, and at the right
// end of the row from the wide step.
export function LineupJumpBar({ tabs, onSection, aside }) {
  return (
    <nav className={`jumpbar lnext__jump${aside ? ' jumpbar--aside' : ''}`} aria-label="Game sections">
      <Cluster gap="snug" className="jumpbar__row">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`jumpbar__item${t.active ? ' is-current' : ''}${t.wideOnly ? ' jumpbar__item--wide' : ''}`}
            aria-current={t.active ? 'page' : undefined}
            onClick={() => !t.active && onSection(t.section)}
          >
            {t.label}
          </button>
        ))}
      </Cluster>
      {aside && <div className="jumpbar__aside">{aside}</div>}
    </nav>
  )
}
