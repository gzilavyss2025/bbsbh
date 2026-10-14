// The cards the tbd module still draws in a section (#1896, TbdWire "season", "role", "more" and "history"), as
// keys, in board order. Pure. A card with no data hides alone; the module reports empty
// when every card here has. Career is empty: its only wireframe, Prospect rankings, is #1927.
// History is empty too: its last card, the clips rail, is the Highlights module (#2022).
export function tbdCards(section, role) {
  if (section === 'season') {
    // Command received is a catcher's card; the live Analytics tab shows it by data, so a hitter's
    // list holds it and the card hides itself for a man who never caught.
    return role === 'hitting' ? ['cmdreceived'] : []
  }
  return []
}
