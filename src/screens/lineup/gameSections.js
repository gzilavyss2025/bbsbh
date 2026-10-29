// The stops of a game's section bar, in the order the "next" buttons walk. Pure, so the
// live bar (GameView's .stepnav) and the new lineup page's jump bar draw one list.
// `step` is sectionToStep's step; `lastInningSection` is where "Gameday" returns to.
export function gameSectionTabs(game, step, lastInningSection) {
  return [
    { key: 'away', label: game.away.abbreviation || 'Away', active: step === 0, section: 'lineup1', teamId: game.away.id ?? null },
    { key: 'home', label: game.home.abbreviation || 'Home', active: step === 1, section: 'lineup2', teamId: game.home.id ?? null },
    { key: 'innings', label: 'Gameday', active: step === 2, section: lastInningSection },
    { key: 'box', label: 'Box', active: step === 3, section: 'boxscore' },
    // Fifth stop: the live #22 sheet, filled through the reveal mark. Last, so the four
    // scoring sections keep the order the "next" buttons walk.
    { key: 'scorecard', label: 'Scorecard', active: step === 6, section: 'scorecard', wideOnly: true },
    // `wideOnly`: the jump bar drops this stop under 740px, where five no longer fit one row. The
    // Gameday page still opens it from its reference panel.
    // The preview poster (step 4) and the printable sheet (step 5) have NO stop here:
    // `.stepnav__btn` is `flex: 1 1 0`, so a sixth stop wraps "Gameday" on a phone.
  ]
}
