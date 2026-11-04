import { useEffect } from 'react'
import { fetchCommandReceived, commandReceivedFor } from '../../../../../api/commandReceived.js'
import { CommandReceivedCard } from '../../../../../components/playerstats/CommandReceivedCard.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'

// Command received (#1896): a catcher's card, as the live Analytics tab draws it. Hitters only; it
// hides for a man who never caught. Open surface (ADR-0034).
const load = async (id, season) => {
  const data = await fetchCommandReceived()
  return commandReceivedFor(data, id, season) ? data : null
}

export default function CommandReceivedModule({ bio, season, onEmpty }) {
  const { data, loading } = useAsync(() => load(bio.id, season), [bio.id, season])
  const none = !loading && !data
  useEffect(() => {
    if (none) onEmpty()
  }, [none, onEmpty])
  if (loading) return <div aria-busy="true" />
  if (none) return null
  return <CommandReceivedCard data={data} personId={bio.id} season={season} />
}
