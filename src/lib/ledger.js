// Wraps a cell's content so it renders as a single <td> spanning every
// remaining column instead of one-per-column — the career register's missed-
// season note (see person.js's missingSeasonRows) uses this so the sentence
// can wrap within the row's width rather than sitting `nowrap` in one narrow
// column and forcing the whole table into horizontal scroll on a phone.
export function spanCell(value) {
  return { __ledgerSpan: true, value }
}
