const PLAYER_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'stats', label: 'Stats' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'history', label: 'History' },
]

export function playerTabsFor(rosterStatus) {
  return rosterStatus?.state === 'retired'
    ? PLAYER_TABS.filter((tab) => tab.key !== 'analytics')
    : PLAYER_TABS
}
