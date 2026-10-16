// A callout note carries a `kind`; every World Series one starts `ws` + a capital
// (wsSeriesOdds, wsStarterStart, wsLastTime, wsLastTimeGame, wsWtaTrailing9).
// CalloutNote swaps its star for the trophy on these. Reads no score.
export const isWorldSeriesKind = (kind) => /^ws[A-Z]/.test(kind ?? '')
