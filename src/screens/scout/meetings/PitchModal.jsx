import { useMemo, useRef, useState } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialogFocus } from '../../../hooks/dialog/useDialogFocus.js'
import { pitchFamily } from '../../../api/pitchArsenal.js'
import { fetchPlayIds, playIdFor } from '../../../api/scout/playIds.js'
import { resolveClipUrl } from '../../../api/expresslane/clipIndex.js'
import { realFlight } from '../../../lib/pitcherCard/camera.js'
import { realScenePitch } from '../../../lib/pitcherCard/scene.js'
import { Button } from '../../../components/ui/control/Button.jsx'
import { FilmPane } from '../../expresslane/FilmPane.jsx'
import { ScoutScene } from '../ScoutScene.jsx'
import { ContactFacts, Fact, fixed } from './Facts.jsx'
import { PitchZone } from './PitchZone.jsx'
import { callOf, inPlay, nameOf, ordinal, playText } from './meetings.js'

// THE PITCH MODAL (#1490, "like the express lane"): one pitch of a past
// meeting. Its REAL flight in the page's scene and view (camera.js
// realFlight, from the Savant row's own velocity and acceleration), its
// numbers, its location against its own zone, and its film.
//
// Prev / Next walk every pitch in the Meetings list, and "8 of 12" counts
// that list, never a game's total.
//
// FILM, THE EXPRESS LANE'S WAY. The playId comes from the game's play-by-play
// (api/scout/playIds.js, one pruned request per game, only when a modal opens);
// the mp4 from Savant's sporty-videos page (expresslane/clipIndex.js, one
// lookup per pitch you open, never a burst). A pitch with no film is an
// ordinary pitch with nothing to watch, never an error (FilmPane). No poster
// is drawn: the clip itself starts on its first frame.
const SPEEDS = [['real', 'Real'], ['quarter', '¼ speed']]
const SLOW = { real: 1, quarter: 4 }
const VIEW_WORD = { pitcher: 'Pitcher’s view', hitter: 'Hitter’s view' }
function PitchFilm({ pa, pitch, cutoff }) {
  const film = useAsync(async () => {
    const ids = await fetchPlayIds(pa.gamePk, pa.date, cutoff)
    const id = playIdFor(ids, pa.atBat, pitch.n)
    return id ? resolveClipUrl(id) : null
  }, [pa.gamePk, pa.date, pa.atBat, pitch.n, cutoff])
  if (film.loading) return <FilmPane gate={{}} />
  if (film.data) return <FilmPane clipUrl={film.data} autoPlay={false} />
  return <FilmPane gate={{ reason: 'no-film' }} />
}

export function PitchModal({ walk, index, onIndex, onClose, board, data, view, stance, cutoff }) {
  const { pa, pitch, k, of } = walk[index]
  const [speed, setSpeed] = useState('quarter')
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const name = nameOf(pitch.code, board)
  const family = pitchFamily(pitch.code)
  const call = callOf(pitch.call)
  const isLast = k === of
  const scene = useMemo(() => {
    const p = realScenePitch(realFlight(pitch), { code: pitch.code ?? 'XX', name, mph: fixed(pitch.mph, 1), family }, view)
    return p ? [p] : []
  }, [pitch, name, family, view])
  const zone = useMemo(() => (pitch.szBot != null && pitch.szTop != null ? [pitch.szBot, pitch.szTop] : undefined), [pitch])
  const go = (i) => i >= 0 && i < walk.length && onIndex(i)

  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div
        className="scout__pm"
        role="dialog"
        aria-modal="true"
        aria-label={`${name}, pitch ${k} of ${of}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(index - 1)
          if (e.key === 'ArrowRight') go(index + 1)
        }}
      >
        <header className="scout__pmhead">
          <div>
            <p className="scout__kicker">
              {pa.inning ? `${ordinal(pa.inning)} inning · ` : ''}pitch {k} of {of} · count {pitch.balls}-{pitch.strikes}
            </p>
            <h2 className="scout__pmtitle">{name} · {fixed(pitch.mph, 1)} mph</h2>
            <p className="scout__pmcall" data-tone={call.tone}>
              {call.word}{isLast && pa.event ? ` · ${pa.event.replace(/_/g, ' ')}` : ''}
            </p>
          </div>
          <button ref={closeRef} type="button" className="scout__pmclose" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {scene.length > 0 ? (
          <ScoutScene
            key={`${index}-${view}-${speed}`}
            pitches={scene}
            lefty={data.pitcher.throws === 'L'}
            name={data.pitcher.name}
            view={view}
            slow={SLOW[speed]}
            zone={zone}
            caption={`Real flight · ${VIEW_WORD[view]}`}
            label="Speed"
            options={SPEEDS}
            value={speed}
            onChange={setSpeed}
          />
        ) : (
          <p className="scout__note">No flight on file for this pitch.</p>
        )}

        <div className="scout__pmbody">
          <div className="scout__facts scout__facts--3">
            <Fact value={pitch.spin == null ? '—' : Math.round(pitch.spin)} unit="rpm" label="Spin rate" />
            <Fact value={pitch.pfxX == null ? '—' : Math.abs(pitch.pfxX * 12).toFixed(0)} unit="in" label="Horizontal break" />
            <Fact value={pitch.pfxZ == null ? '—' : (pitch.pfxZ * 12).toFixed(0)} unit="in" label="Vertical break" />
          </div>
          <PitchZone pitch={pitch} view={view} stance={pa.stand ?? stance} family={family} />
        </div>
        {inPlay(pitch) && <ContactFacts pitch={pitch} />}
        {isLast && pa.description && <p className="scout__play">{playText(pa.description, data.hitter.name)}</p>}

        <PitchFilm pa={pa} pitch={pitch} cutoff={cutoff} />

        <footer className="scout__pmfoot">
          <Button size="control" onClick={() => go(index - 1)} disabled={index === 0}>‹ Previous</Button>
          <span className="scout__pmpos">{index + 1} of {walk.length}</span>
          <Button size="control" onClick={() => go(index + 1)} disabled={index === walk.length - 1}>Next ›</Button>
        </footer>
      </div>
    </div>
  )
}
