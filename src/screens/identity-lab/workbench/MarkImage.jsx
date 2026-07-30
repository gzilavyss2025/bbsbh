import { useState } from 'react'

// A mark that fails to load is INFORMATION on this page, not noise: "this club
// qualifies for Alt 3 and there's no art on disk for it" is exactly the gap the
// logo shelf and jersey rack exist to surface. The old collapsed-row strip
// dropped a 404 silently, which made a missing file indistinguishable from a
// treatment the club doesn't have. So a failed load keeps its slot and draws an
// empty glove instead.
export function MarkImage({ url, alt }) {
  const [failed, setFailed] = useState(false)
  // Reset computed during render, not in an effect — see Headshot.jsx.
  const [prevUrl, setPrevUrl] = useState(url)
  if (url !== prevUrl) {
    setPrevUrl(url)
    setFailed(false)
  }
  if (!url || failed) return <GloveMark />
  return (
    <img
      key={url}
      src={url}
      alt={alt}
      className="colorlab__logoimg"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

// One outlined path in `currentColor` — a fielder's glove, waiting and empty.
export function GloveMark() {
  return (
    <span className="idlab__glove" title="No art yet">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M7 21v-4.2C5.2 15.5 4 13.4 4 11V6.5a1.5 1.5 0 0 1 3 0V10m3 0V4.5a1.5 1.5 0 0 1 3 0V10m0-4a1.5 1.5 0 0 1 3 0v4m0-2.5a1.5 1.5 0 0 1 3 0V13c0 2.4-1.2 4.5-3 5.8V21z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="idlab__glove__text">No art yet</span>
    </span>
  )
}
