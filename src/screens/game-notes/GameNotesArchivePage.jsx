import '../../styles/report/game-notes.css'
import { useMemo, useState } from 'react'
import { fetchArchiveShard } from '../../api/gameNotes.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { monthDayYear, toApiDate } from '../../lib/dates.js'
import {
  ALL_CLUBS,
  PAGE_SIZE,
  archiveRows,
  clubOptions,
  csvFileName,
  csvForDownload,
  defaultClub,
  pageRows,
} from '../../lib/gameNotes/archive.js'
import { useNav } from '../../lib/nav.js'
import { gameNotesPath } from '../../lib/route.js'
import { ALL_MLB_TEAM_IDS, teamFullName } from '../../lib/teams.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Table } from '../../components/ui/table/Table.jsx'

// Every club's Game Notes PDF the archive holds, as one plain table with a link
// to each (#1258). It replaces the Game Notes feed idea (#911): the feed showed
// the notes' text, which leaks results, and this page never does. A row is a
// date, a club, the title the club gave the file, and a link that opens the PDF
// in a new tab.
//
// OUTSIDE THE SCORING FLOW, so no SealBox (root CLAUDE.md). A title carries no
// score, and the PDF is an off-site jump the reader chooses, the same contract as
// the Game Notes button on the lineup page. The page never fetches or renders PDF
// text.
//
// MLB CLUBS ONLY: MiLB clubs publish no notes, so they are not in the filter.
// One club's shard loads at a time; "All clubs" loads all thirty. The table shows
// PAGE_SIZE rows and a button for more, since "All clubs" is about 5,000 rows.
// The club in the filter is the club in the address (`?team=`), so a reload or a
// copied link reopens on it.
//
// The CSV button is for the local copy: 5,000 PDFs is too many for a browser
// button, so it saves the link list, and scripts/download-game-notes.mjs turns
// that same archive into files. The CSV is always the WHOLE archive, whatever
// club is picked, so it is one row per archived PDF.
const CLUBS = ALL_MLB_TEAM_IDS.map((id) => ({ id, name: teamFullName(id) }))
const CLUB_IDS = CLUBS.map((c) => c.id)

function loadShards(pick) {
  const ids = pick === ALL_CLUBS ? CLUB_IDS : [pick]
  return Promise.all(ids.map(fetchArchiveShard))
}

// Hand the browser a CSV to save. A Blob URL, revoked once the click is done.
function saveCsv(text, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function GameNotesArchivePage({ teamId: requestedId = null }) {
  useDocumentTitle('Game Notes')
  const { favoriteTeamId } = useFavoriteTeam()
  const navigate = useNav()
  const options = useMemo(() => clubOptions(CLUBS, favoriteTeamId), [favoriteTeamId])
  const pick = defaultClub({ favoriteId: favoriteTeamId, requestedId, clubIds: CLUB_IDS })
  const [csv, setCsv] = useState({ busy: false, error: false })
  // How many rows the reader has asked to see, for one pick. A new pick starts
  // over at one page, with no reset to remember.
  const [more, setMore] = useState({ pick, count: PAGE_SIZE })
  const count = more.pick === pick ? more.count : PAGE_SIZE

  const shards = useAsync(() => loadShards(pick), [pick])
  const rows = useMemo(() => archiveRows(shards.data ?? [], teamFullName), [shards.data])
  const { shown, left } = pageRows(rows, count)

  async function downloadList() {
    setCsv({ busy: true, error: false })
    try {
      const all = archiveRows(await loadShards(ALL_CLUBS), teamFullName)
      saveCsv(csvForDownload(all), csvFileName(toApiDate()))
      setCsv({ busy: false, error: false })
    } catch {
      setCsv({ busy: false, error: true })
    }
  }

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Game Notes</h1>
      </header>
      <p className="hint hint--prose">
        Every club’s pre-game notes PDF that the archive holds, newest first. Each link opens the
        PDF in a new tab. A PDF is a press packet, and it can show results.
      </p>

      <div className="gamefinder__season">
        <label htmlFor="game-notes-club">Club</label>
        <select
          id="game-notes-club"
          value={pick}
          onChange={(e) => {
            const v = e.target.value
            navigate(gameNotesPath(v === ALL_CLUBS ? ALL_CLUBS : Number(v)), { replace: true })
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button size="control" icon="↓" busy={csv.busy} onClick={downloadList}>
          Download the link list
        </Button>
      </div>
      {csv.error && (
        <p className="hint hint--error" role="status">
          Couldn’t build the link list. Try again.
        </p>
      )}

      <AsyncStatus
        loading={shards.loading}
        error={shards.error}
        hasData={shards.data != null}
        errorMessage="Couldn’t load the notes. Try again."
        onRetry={shards.reload}
      />

      {shards.data != null && (
        <>
          <p className="hint" role="status">
            {rows.length.toLocaleString('en-US')} {rows.length === 1 ? 'note' : 'notes'}
          </p>
          {rows.length > 0 && (
            <Table className="gnotes">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Club</th>
                  <th>Title</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.url}>
                    <td className="gnotes__date">{monthDayYear(r.date)}</td>
                    <td className="gnotes__club">{r.club}</td>
                    <td>{r.title}</td>
                    <td className="gnotes__pdf">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`PDF, ${r.title}, opens in a new tab`}
                      >
                        PDF ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {left > 0 && (
            <div className="gnotes__more">
              <Button size="control" onClick={() => setMore({ pick, count: count + PAGE_SIZE })}>
                {`Show ${Math.min(PAGE_SIZE, left)} more (${left.toLocaleString('en-US')} left)`}
              </Button>
            </div>
          )}
        </>
      )}
      <ReportFooter />
    </div>
  )
}
