import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { monoInkFor } from '../../lib/monoInk.js'
import { seasonMark } from '../../lib/identity/seasonMarks.js'
import { sanitizeSvgMarkup } from '../../lib/svgSanitize.js'
import { secondaryLogoSvg } from '../../lib/heritage/marks.js'

// Many passes repeat the same clubs. Share requests and conversions by club's
// source identity, not by game; no additional requests as each pass mounts.
const sources = new Map()
const marks = new Map()
function loadSvg(url) {
  if (!sources.has(url)) {
    const pending = fetch(url, { signal: AbortSignal.timeout(8000) }).then(async (response) => {
      if (!response.ok) throw new Error('Logo unavailable')
      return sanitizeSvgMarkup(await response.text())
    }).catch((error) => { sources.delete(url); throw error })
    sources.set(url, pending)
  }
  return sources.get(url)
}

function secondaryUrl(teamId, sourceVariant) {
  const key = `${teamId}:${sourceVariant}`
  if (!marks.has(key)) {
    marks.set(key, secondaryLogoSvg(teamId, sourceVariant, loadSvg).then((svg) => {
      if (!svg) { marks.delete(key); return null }
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    }))
  }
  return marks.get(key)
}

export function SecondaryMark({ team, date }) {
  const [failed, setFailed] = useState(null)
  const sourceVariant = monoInkFor(team.id)?.source || 'base'
  const historical = Boolean(seasonMark(team.id, date))
  const { data } = useAsync(async () => team.id && !historical ? secondaryUrl(team.id, sourceVariant) : null,
    [team.id, sourceVariant, historical])
  return data && failed !== data ? (
    <img className="heritagepass__secondary" src={data} alt="" onError={() => setFailed(data)} />
  ) : (
    <svg className="heritagepass__secondary" viewBox="0 0 60 60" aria-hidden="true">
      <path d="M30 7 L53 30 L30 53 L7 30 Z" fill="none" stroke="currentColor" />
      <circle cx="30" cy="30" r="13" fill="none" stroke="currentColor" />
      <path d="M24 18 Q32 30 24 42 M36 18 Q28 30 36 42 M24 23 L29 21 M25 29 L30 28 M24 35 L29 37 M36 23 L31 21 M35 29 L30 28 M36 35 L31 37" fill="none" stroke="currentColor" />
    </svg>
  )
}
