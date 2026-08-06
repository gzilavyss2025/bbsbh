// The pregame Innings board stays up through MLB's Warmup state, whose
// abstractGameState is already "Live" even though no pitch has been thrown.
// Look for the first real pitch instead of treating that coarse status as the
// boundary. Final is accepted independently so an unusually sparse/forfeited
// final feed can never fall backward into a pregame countdown.
//
// Spoiler-free: this reads only the structural isPitch flag, never any pitch
// result, count, runner, run, hit, error, or score value.
export function selectHasFirstPitch(feed) {
  if (feed?.gameData?.status?.abstractGameState === 'Final') return true
  return (feed?.liveData?.plays?.allPlays ?? []).some((play) =>
    (play?.playEvents ?? []).some((event) => event?.isPitch === true),
  )
}
