// Called only for a completed, already-revealed result in GamedayStage's
// SealBox render subtree. Never call this on a partially revealed pitch.
import { STATCAST } from '../../../../../api/gameday/moments/thresholds.js'

export function celebrationForPlay(play, gameData) {
  if (play?.about?.isComplete !== true) return null
  const half = play.about.halfInning
  if (half !== 'top' && half !== 'bottom') return null
  const batting = half === 'top' ? 'away' : 'home', fielding = half === 'top' ? 'home' : 'away'
  const result = play.result, type = result?.eventType ?? ''
  const nameOf = (person) => person?.fullName ?? gameData?.players?.[`ID${person?.id}`]?.fullName ?? ''
  const of = (scene, person, side) => ({ scene, name: nameOf(person), teamId: gameData?.teams?.[side]?.id ?? null })
  if (type === 'home_run') return of(result.rbi >= 4 ? 'grandSlam' : 'homeRun', play.matchup?.batter, batting)
  // Every other RBI (Gary, 2026-10-27): the batter's art, the headline naming the play.
  const rbi = result?.rbi ?? 0
  if (rbi > 0) return { headline: `${rbi === 1 ? 'RBI' : `${rbi}-run`} ${result.event ?? ''}`.trim(), ...of(rbi >= 2 ? 'multiRbi' : 'rbi', play.matchup?.batter, batting) }
  const scored = (play.runners ?? []).some((r) => r.movement?.end === 'score' && r.movement?.isOut !== true)
  if (type.startsWith('strikeout') && result.isOut === true && !scored) return of('strikeout', play.matchup?.pitcher, fielding)
  if (result?.isOut !== true || scored) return null
  const hit = play.playEvents?.findLast((e) => e.hitData)?.hitData
  if (!['fly_ball', 'line_drive'].includes(hit?.trajectory) || !Number.isFinite(hit.launchSpeed) || hit.launchSpeed < STATCAST.hitHard.floor) return null
  const batterOut = play.runners?.find((r) => r.details?.runner?.id === play.matchup?.batter?.id && r.movement?.isOut)
  const putout = batterOut?.credits?.find((c) => c.credit === 'f_putout' && ['LF', 'CF', 'RF'].includes(c.position?.abbreviation))
  if (putout?.player?.id != null) return of('catch', putout.player, fielding)
  return null
}
