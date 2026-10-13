// The cards the tbd module draws in a section (#1896, TbdWire "season", "role", "more" and "history"), as
// keys, in board order. Pure. A card with no data hides alone; the module reports empty
// when every card here has. Career is empty: its only wireframe, Prospect rankings, is #1927.
// Run value and the History cards are about the man, not a stat group, so a two-way
// player gets them once, on his primary role (the one PlayerHistoryTab's primaryGroup names).
export function tbdCards(section, role, bio) {
  const first = role === (bio.isPitcher ? 'pitching' : 'hitting')
  if (section === 'season') {
    // Command received is a catcher's card; the live Analytics tab shows it by data, so a hitter's
    // list holds it and the card hides itself for a man who never caught.
    const keys = role === 'hitting' ? ['percentile', 'advanced', 'cmdreceived'] : ['percentile', 'advanced']
    return first ? [...keys, 'runvalue'] : keys
  }
  if (section === 'history' && first) return ['awards', 'timeline', 'transactions', 'media']
  if (section === 'on-the-mound' && role === 'pitching') return ['targetcommand']
  if (section === 'game-log') return role === 'pitching' ? ['fouls', 'milestones'] : ['milestones']
  return []
}
