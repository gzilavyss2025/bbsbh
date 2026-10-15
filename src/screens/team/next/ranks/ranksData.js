// The Ranks band's jump-bar count: the rank cells it shows (the 9 batting and 13 pitching
// ranks). A club with none (Triple-A and below) reports 0.
export const rankCount = (n) => (n?.batting?.length ?? 0) + (n?.pitching?.length ?? 0)
