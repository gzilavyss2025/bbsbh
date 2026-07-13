// A slim banner above the extra-innings reading pane: each club's extra-inning
// record for the season ("BREWERS 5-2 in extras · CUBS 2-5"). Renders nothing
// until the data's there for both, so a thin/absent bundle just leaves it off.
export function ExtrasBanner({ records, awayName, homeName }) {
  const away = records?.away?.extraInning
  const home = records?.home?.extraInning
  if (!away && !home) return null
  return (
    <p className="innings__extras" role="note">
      <span className="innings__extras-icon" aria-hidden="true">⚾️</span> Extra
      innings this season:{' '}
      {away && (
        <span className="innings__extras-team">
          {awayName || 'Away'} {away}
        </span>
      )}
      {away && home && <span className="innings__extras-dot" aria-hidden="true"> · </span>}
      {home && (
        <span className="innings__extras-team">
          {homeName || 'Home'} {home}
        </span>
      )}
    </p>
  )
}
