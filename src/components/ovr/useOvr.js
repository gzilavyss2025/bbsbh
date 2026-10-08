import { useAsync } from '../../hooks/useAsync.js'
import { fetchOvr } from '../../api/ovr/ovrData.js'

// A player's OVR ratings for the hero: { hitting?, pitching? }, a key only for a group
// that has a rating, or null while loading and for a player with none (no tile, no gap).
// A two-way player (bio.twoWay) is read for both groups; anyone else for the group his
// position picks.
export function useOvr(bio) {
  const { data } = useAsync(async () => {
    const groups = bio.twoWay ? ['hitting', 'pitching'] : [bio.isPitcher ? 'pitching' : 'hitting']
    const rated = await Promise.all(groups.map((g) => fetchOvr(bio.id, g)))
    const found = groups.flatMap((g, i) => (rated[i] ? [[g, rated[i]]] : []))
    return found.length ? Object.fromEntries(found) : null
  }, [bio.id, bio.twoWay, bio.isPitcher])
  return data
}
