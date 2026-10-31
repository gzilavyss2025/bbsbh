import { useState } from 'react'
import { EraseDataDialog } from '../../../components/profile/EraseDataDialog.jsx'
import { SyncReceipt } from '../../../components/profile/SyncReceipt.jsx'
import { buildGameLogExport, gameLogFilename } from '../../../lib/account/localData.js'
import { allPhotoRecords, photoExportFilename } from '../../../lib/scorecard-photos/store.js'

// Sync & data — where everything is, how to take it with you, and how to take
// it away.
//
// The receipt is rendered from the claims ledger (see SyncReceipt.jsx), so this
// section can never promise a channel the app does not actually sync.
//
// TWO deletion actions, deliberately separated. "This device" always works —
// signed out, signed in, and on a deploy with no account feature at all,
// because the local copy is the one that always exists. The account erase is
// the Clerk-gated section's, since only it can hold a token; this section links
// to it in words rather than rendering a button that would 401.

// A download, built in the page and never uploaded anywhere. Same-origin,
// no network, no server round trip — the file is your own local records.
function downloadGameLog(stamps) {
  const payload = buildGameLogExport(stamps)
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = gameLogFilename()
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can race the download on some browsers; a tick later
  // is universally safe and the blob is tiny either way.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// The scorecard photos' own export (#2511, Gary 2026-10-31: separate from the Game Log JSON,
// which stays small). Photos live only in this browser, so this file is their only backup:
// one JSON with each photo as a data URL, keyed by game. Returns how many it saved.
const asDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})
async function downloadPhotos() {
  const records = await allPhotoRecords()
  const photos = []
  for (const rec of records) {
    for (const p of rec.photos ?? []) photos.push({ gamePk: rec.gamePk, addedAt: p.addedAt, image: await asDataUrl(p.blob) })
  }
  if (!photos.length) return 0
  const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: 'tally-scorecard-photos', version: 1, photos })], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = photoExportFilename()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return photos.length
}

export function DataSection({
  status,
  accountPhase,
  stamps,
  stampCount,
  recentCount,
  onClearRecent,
  accountEraseAvailable,
}) {
  const [erasing, setErasing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [photoNote, setPhotoNote] = useState('')

  return (
    <section className="mytally__section">
      <h2 className="mytally__sectiontitle">Sync &amp; data</h2>

      <SyncReceipt status={status} />

      {accountPhase === 'off' && (
        <p className="mytally__fieldnote caps-exempt">
          This copy of Tally has no account feature configured, so everything above
          lives here and only here.
        </p>
      )}

      <div className="mytally__field">
        <button
          type="button"
          className="mytally__rowbtn"
          onClick={() => downloadGameLog(stamps)}
          disabled={stampCount === 0}
        >
          Export your Game Log
          <span className="mytally__rowbtnhint caps-exempt">
            {stampCount === 0
              ? 'Nothing to export yet — your book is empty.'
              : 'A JSON file of your stamps, their notes and where each one sits.'}
          </span>
        </button>

        <button
          type="button"
          className="mytally__rowbtn"
          onClick={async () => {
            try {
              const n = await downloadPhotos()
              setPhotoNote(n ? `Saved ${n} ${n === 1 ? 'photo' : 'photos'}.` : 'No scorecard photos on this device yet.')
            } catch {
              setPhotoNote('The photos could not be exported. Try again.')
            }
          }}
        >
          Export your scorecard photos
          <span className="mytally__rowbtnhint caps-exempt">
            {photoNote || 'They live only in this browser, so this file is their backup.'}
          </span>
        </button>

        <button
          type="button"
          className="mytally__rowbtn"
          onClick={() => {
            onClearRecent()
            setCleared(true)
          }}
          disabled={recentCount === 0 || cleared}
        >
          Clear recent searches
          <span className="mytally__rowbtnhint caps-exempt">
            {cleared
              ? 'Cleared.'
              : recentCount === 0
                ? 'Nothing remembered on this device.'
                : `${recentCount} remembered on this device. They are never synced.`}
          </span>
        </button>

        <button
          type="button"
          className="mytally__rowbtn mytally__rowbtn--danger"
          onClick={() => setErasing(true)}
        >
          Erase this device
          <span className="mytally__rowbtnhint caps-exempt">
            {accountEraseAvailable
              ? 'Clears this browser only. Your account keeps its copy.'
              : 'Clears everything Tally has saved in this browser.'}
          </span>
        </button>
      </div>

      {erasing && <EraseDataDialog scope="device" onClose={() => setErasing(false)} />}
    </section>
  )
}
