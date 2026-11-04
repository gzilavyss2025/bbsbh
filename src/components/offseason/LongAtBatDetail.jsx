import { useMemo, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { findLongAtBat } from '../../api/notebook.js'
import { getJson } from '../../api/statsapi.js'
import { StrikeZone } from '../scoring/StrikeZone.jsx'
import { pitchCardInfo } from '../../api/playbyplay/pitchInfo.js'
import { fallbackFigureUrls } from '../../api/uniforms.js'
import { BatterFallbackContext } from '../logo/uniformContexts.js'
import { HeaderBug } from '../gamehud/HeaderBug.jsx'
import { PitchScene } from '../playbyplay/pitcherCard/PitchScene.jsx'
import { atBatScenePitches, atBatZone } from '../../lib/pitcherCard/atBat.js'
import { Button } from '../ui/control/Button.jsx'

// The longest at-bats card's picked at-bat (LongAtBats.jsx): Gameday's scorebug
// and the zone with its replay. Its own chunk, loaded lazily: the zone, the
// pitch scene and the scorebug are about 16 kB gzip the home page's first load
// does not need, and nothing here draws before its play-by-play read anyway.

// The longest at-bat's pitches on the Gameday zone. The census file keeps no
// at-bat index, so the game's play-by-play is read and the plate appearance
// found by its batter, pitcher and length. Nothing until it arrives.
// One request per at-bat: the scorebug and the zone both ask for it.
const atBats = new Map()
function fetchAtBat(row) {
  const k = `${row.pk}-${row.batter.id}-${row.pitcher.id}-${row.pitches}`
  if (!atBats.has(k)) atBats.set(k, readAtBat(row))
  return atBats.get(k)
}
async function readAtBat(row) {
  const feed = await getJson(`/api/v1/game/${row.pk}/playByPlay`).catch(() => null)
  const play = findLongAtBat(feed?.allPlays, row)
  if (!play) return null
  // The game as the at-bat began: the play before it carries the score, and,
  // in the same half, the outs and the runners.
  const at = feed.allPlays.indexOf(play)
  const prev = feed.allPlays[at - 1]
  const same = prev && prev.about?.inning === play.about?.inning && prev.about?.halfInning === play.about?.halfInning
  const bug = {
    away: prev?.result?.awayScore ?? 0,
    home: prev?.result?.homeScore ?? 0,
    inning: play.about?.inning,
    top: play.about?.halfInning === 'top',
    outs: same ? prev.count?.outs ?? 0 : 0,
    bases: same ? ['postOnFirst', 'postOnSecond', 'postOnThird'].map((k) => !!prev.matchup?.[k]) : [false, false, false],
  }
  return { bug, result: play.result?.description ?? null, event: play.result?.event ?? null, pitchDetails: pitchCardInfo(feed, play).pitchDetails, batSide: play.matchup?.batSide?.code ?? 'R', pitchHand: play.matchup?.pitchHand?.code ?? 'R' }
}

// Gameday's own scorebug, set to the game as the at-bat began.
export function Scorebug({ row }) {
  const { data } = useAsync(() => fetchAtBat(row), [row.pk, row.batter.id, row.pitches])
  const b = data?.bug
  if (!b) return null
  const [first, second, third] = b.bases
  return (
    <div className="seasonnote__bug">
      <HeaderBug
        season={row.date?.slice(0, 4)}
        awayName={row.away.abbr}
        homeName={row.home.abbr}
        awayTeamId={row.away.id}
        homeTeamId={row.home.id}
        awayRuns={b.away}
        homeRuns={b.home}
        inning={b.inning}
        half={b.top ? 'top' : 'bottom'}
        batter={null}
        pitcher={null}
        bases={{ first, second, third }}
        outs={b.outs}
      />
    </div>
  )
}

// The zone, a card for whichever pitch dot the pointer is on, and how the
// at-bat ended under it.
export function AtBatZone({ row }) {
  const { data } = useAsync(() => fetchAtBat(row), [row.pk, row.batter.id, row.pitches])
  const [tip, setTip] = useState(null)
  // The pitch-tracking replay: null shows the zone, an object plays the at-bat
  // through PitchScene's at-bat look (a new object replays it).
  const [play, setPlay] = useState(null)
  const scene = useMemo(() => (data ? atBatScenePitches(data.pitchDetails, 'hitter', data.batSide) : []), [data])
  if (!data) return null
  const side = row.batter.teamId === row.away?.id ? 'away' : 'home'
  const figures = fallbackFigureUrls(row.batter.teamId, side, data.batSide === 'L' ? 'left' : 'right')
  const last = data.pitchDetails[data.pitchDetails.length - 1]
  const onMove = (e) => {
    const no = Number(e.target.closest('g')?.querySelector('.strikezone__num')?.textContent)
    const p = no ? data.pitchDetails.find((d) => d.no === no) : null
    if (!p) return setTip(null)
    const box = e.currentTarget.getBoundingClientRect()
    setTip({ p, x: e.clientX - box.left, y: e.clientY - box.top })
  }
  return (
    <div className="seasonnote__zonecol">
      <div className="seasonnote__zonewrap" onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
        {play ? (
          <div className="seasonnote__scene">
            <PitchScene
              pitches={scene}
              lefty={data.pitchHand === 'L'}
              name={row.pitcher.name}
              zone={atBatZone(data.pitchDetails)}
              atBat={scene.length}
              play={play}
            />
          </div>
        ) : (
          <BatterFallbackContext.Provider value={figures}>
            <StrikeZone pitchDetails={data.pitchDetails} batSide={data.batSide} className="seasonnote__zone" margin={0.6} />
          </BatterFallbackContext.Provider>
        )}
        {scene.length > 0 && (
          <Button
            size="control"
            skin="ink"
            className="seasonnote__play"
            onClick={() => setPlay(play ? null : { all: true })}
          >
            {play ? 'Zone' : '▶ Play'}
          </Button>
        )}
        {tip && (
          <div className="seasonnote__tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
            <span className={`pitchlist__num pitchlist__num--${tip.p.cat}`}>{tip.p.no}</span>
            <div>
              <p className="seasonnote__tiptype">{tip.p.type || 'Pitch'}</p>
              <p className="seasonnote__tipmeta">
                {tip.p.mph != null ? `${tip.p.mph} MPH · ` : ''}
                {tip.p.callDesc}
              </p>
              {tip.p.balls != null && (
                <p className="seasonnote__tipmeta">
                  Count {tip.p.balls}-{tip.p.strikes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {data.result && (
        <div className="seasonnote__result">
          <p className="t-label t-label--bold seasonnote__what">
            {last
              ? `Pitch ${last.no}: ${/walk/i.test(data.event ?? '') ? 'Ball 4' : /strikeout/i.test(data.event ?? '') ? 'Strike 3' : last.callDesc}`
              : data.event ?? 'Result'}
          </p>
          <p className="seasonnote__resulttext">{data.result}</p>
        </div>
      )}
    </div>
  )
}
