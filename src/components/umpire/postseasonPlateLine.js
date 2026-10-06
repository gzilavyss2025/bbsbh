// The one reference line for an umpire's postseason plate work: games, how
// accurate, and how many calls that covers. Pure so it is tested alone.
//
// It is UNRANKED on purpose (api/umpires.js): a few games in a different-stakes
// setting is no sample to place on the regular-season scale. So this takes the
// `seasonPost` aggregate and nothing else. It never takes a rank, a tier or the
// league baseline, so none of them can leak onto the line.
//
// Null when he has no scored postseason plate games, so the caller renders
// nothing. Every figure is an aggregate over Final games (ADR-0034).
export function postseasonPlateLine(post) {
  if (!post?.called || !post.games) return null
  const games = post.games
  const pct = `${((post.correct / post.called) * 100).toFixed(1)}%`
  return {
    games,
    accuracy: pct,
    calls: post.called,
    text: `Postseason plate work: ${games} ${games === 1 ? 'game' : 'games'}, ${pct} of ${post.called} calls correct. Not ranked.`,
  }
}
