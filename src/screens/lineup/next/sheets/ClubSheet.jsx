import { useState } from 'react'
import { UniformFigure } from '../../../../components/logo/UniformFigure.jsx'
import { SheetFrame } from './SheetFrame.jsx'

// The crest's sheet: Gameday's batter figure in tonight's uniform, and nothing else (Gary,
// 2026-10-28; the colours, marks and "Sketch this mark" went). A bottom sheet like the pitch-mix
// sheet. Spoiler-free: identity and art only. Before the figure is posted, or if it fails, a line says so.
export function ClubSheet({ name, uniform, figureUrls, onClose }) {
  const [figureFailed, setFigureFailed] = useState(false)
  const shown = figureUrls && uniform && !figureFailed
  return (
    <SheetFrame title="Tonight’s uniform" label={`${name}, tonight's uniform`} onClose={onClose}>
      {shown
        ? <UniformFigure urls={figureUrls} label={uniform} onError={() => setFigureFailed(true)} />
        : <p className="lsheet__sub">{uniform || 'Uniform not posted yet'}</p>}
    </SheetFrame>
  )
}
