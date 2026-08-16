import { useEffect, useMemo } from 'react'
import { buildSheetModel } from './sheetModel.js'
import { ScoreSheet } from './ScoreSheet.jsx'
import { PrintSheetButton } from './PrintSheetButton.jsx'
import '../../styles/63-print-sheet.css'

// `/{date}/{matchup}/sheet` — tonight's scorecard, pre-filled and printable.
//
// The fifth-and-a-half stop in a game (after the preview poster, and like it NOT
// one of the four the "next" buttons walk): it is a thing you MAKE, not a page of
// the scorebook. Where the poster makes an image to post, this makes a sheet to
// carry to the ballpark.
//
// Everything on it comes from `sheetModel.js`, which reads `api/select.js` and
// nothing else — read that file's header before adding a single field here. The
// at-bat grid is empty by design and must stay that way; see `ScoreSheet.jsx`.
//
// The page takes its feed, managers and weather as props rather than fetching:
// `GameView` already has all three in hand for every section of the game, so
// opening the sheet costs no request at all.
export function ScoreSheetPage({ feed, managers, scorebookWeather }) {
  const model = useMemo(
    () => buildSheetModel(feed, { managers, weather: scorebookWeather }),
    [feed, managers, scorebookWeather],
  )

  // Marks the document while this route is mounted, so the print stylesheet can
  // strip the app's chrome down to the sheet alone (styles/63-print-sheet.css).
  // An attribute on <body> rather than a class on the page itself because the
  // rules have to reach UPWARD past the page — the site bar, the game masthead
  // and the section tabs are all ancestors or siblings of this component, and no
  // selector rooted here can hide them.
  useEffect(() => {
    document.body.dataset.printSheet = 'on'
    return () => {
      delete document.body.dataset.printSheet
    }
  }, [])

  if (!model) return null

  const [away, home] = model.clubs
  const matchup = `${away.abbr || 'Away'} at ${home.abbr || 'Home'}`

  return (
    <div className="printsheet-screen">
      <div className="printsheet-screen__intro">
        <h2 className="printsheet-screen__title">Tonight’s sheet</h2>
        <p className="printsheet-screen__note">
          One page, landscape — Letter or A4. Both batting orders, the crew and the
          park are penciled in; every at-bat box is yours.
        </p>
        <PrintSheetButton
          title={`${matchup} scorecard`}
          text={`Scorecard for ${matchup}, ${model.date}`}
        />
        <p className="printsheet-screen__hint">
          On a phone this opens the share sheet — print from there, or send it to a
          computer that can. On a computer it opens the print dialog.
        </p>
      </div>

      {/* The sheet at its printed width, swiped sideways on a phone the way you
          slide a paper scorebook across a table (the same convention the
          Scorecard Lab's grid uses). It is the same DOM the printer gets. */}
      <div className="printsheet-screen__paper">
        <ScoreSheet model={model} />
      </div>
    </div>
  )
}

export default ScoreSheetPage
