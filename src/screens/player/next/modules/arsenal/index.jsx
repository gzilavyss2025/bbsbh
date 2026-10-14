import { useEffect, useMemo } from 'react'
import '../../../../../styles/player-next/pitcher/arsenal.css'
import { fetchCommandFor } from '../../../../../api/commandMap.js'
import { arsenalXwobaFor, fetchSavantMatchup } from '../../../../../api/matchup/savant.js'
import { fetchPitchArsenalFor } from '../../../../../api/pitchArsenal.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { ArsenalCard } from './ArsenalCard.jsx'
import { FlightCard } from './FlightCard.jsx'
import { arsenalView } from './arsenalView.js'

// The Pitch arsenal (#1892, pitcher only): the mix with each pitch's numbers, and each pitch type's flight.
// Season aggregates over completed games, so an open surface (ADR-0034); no seal. Three static reads, made
// when the slot comes near. A missing file resolves to null (staticJson's fallback), which ends the load.
export default function ArsenalModule({ bio, season, onEmpty, onCount }) {
  const { data, loading, error } = useAsync(
    () =>
      // The command grid and Savant's file only add to the mix: either one failing must not hide it.
      Promise.all([
        fetchPitchArsenalFor(bio.id, { seasonYear: season }),
        fetchCommandFor(bio.id, { seasonYear: season }).catch(() => null),
        fetchSavantMatchup().catch(() => null),
      ]),
    [bio.id, season],
  )
  const rows = useMemo(() => {
    if (!data) return null
    const [shard, command, savant] = data
    // Savant's file holds one season, the latest: a past season has no xwOBA of its own.
    const xwoba = Number(savant?.season) === Number(season) ? (code) => arsenalXwobaFor(savant, bio.id, code) : undefined
    return arsenalView({ shard, command, id: bio.id, xwoba })
  }, [data, bio.id, season])
  const empty = Boolean(error) || (!loading && !rows)
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  const n = rows?.length
  useEffect(() => {
    onCount(n ? `${n} pitch ${n === 1 ? 'type' : 'types'}` : undefined)
  }, [n, onCount])
  if (empty) return null
  if (!rows) return <div className="arsenal arsenal--wait" aria-busy="true"><p className="hint">Loading the arsenal…</p></div>
  return (
    <div className="arsenal">
      <ArsenalCard rows={rows} id={bio.id} />
      {rows.some((r) => r.path) && <FlightCard rows={rows} season={season} throws={bio.throws} />}
    </div>
  )
}
