import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/history/highlights.css'
import { fetchTeamHighlights, flattenPositiveClips } from '../../../../../api/gamehighlights.js'
import { HighlightSheet } from '../../../../../components/playbyplay/HighlightSheet.jsx'
import { Door } from '../../../../../components/ui/control/Door.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { inMajors } from '../tbd/tbdData.js'
import { clipsTag, highlightsView } from './highlightsView.js'

const SHOWN = 6

// Highlights (#2022): his clips this season, newest six, and a door to the rest. Open surface (ADR-0034);
// a game played today shows once Final (ADR-0117). A trade hides clips filed under his old club (accepted).
export default function HighlightsModule({ bio, asOf, season, onEmpty, onCount }) {
  const live = !asOf && !!bio.debut && inMajors(bio)
  const { data, loading } = useAsync(() => (live ? fetchTeamHighlights(bio.team?.id) : Promise.resolve(null)), [live, bio.team?.id])
  const items = useMemo(
    () => (data ? highlightsView({ clips: flattenPositiveClips(data), playerId: bio.id, season }) : []),
    [data, bio.id, season],
  )
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(null)
  const empty = !live || (!loading && !items.length)
  useEffect(() => {
    if (empty) onEmpty()
    else if (!loading) onCount(clipsTag(items.length))
  }, [empty, loading, items.length, onEmpty, onCount])
  if (empty) return null
  if (loading) return <div className="hlmod hlmod--wait" aria-busy="true" />
  const shown = all ? items : items.slice(0, SHOWN)
  const clip = open && items.find((i) => i.clipId === open)
  return (
    <div className="hlmod">
      <ul className="hlmod__grid">
        {shown.map((i) => (
          <li key={i.clipId}>
            <button type="button" className="hlmod__clip" onClick={() => setOpen(i.clipId)} aria-label={`Watch highlight: ${i.title || 'Highlight'}, ${i.when}`}>
              <span className="hlmod__frame">
                <img src={i.clip.poster} alt="" loading="lazy" />
                <span className="hlmod__box hlmod__box--play" aria-hidden="true">▶</span>
                {i.length && <span className="hlmod__box hlmod__box--len mono">{i.length}</span>}
              </span>
              <span className="hlmod__when mono">{i.when}</span>
              {i.title && <span className="hlmod__title">{i.title}</span>}
            </button>
          </li>
        ))}
      </ul>
      {!all && items.length > SHOWN && (
        <Door layout="block" onClick={() => setAll(true)}>
          See all {items.length}
        </Door>
      )}
      {clip && <HighlightSheet item={clip.clip} title={clip.title} onClose={() => setOpen(null)} />}
    </div>
  )
}
