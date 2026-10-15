// The Runs bar (the Pitch arsenal's mix bar, for runs): scored on the marker, allowed on the inset
// ground, each as wide as its share. The bar rolls open from the left, then each segment flashes.
export function RunsBar({ rs, ra, diff }) {
  return (
    <div className="tnext__panel tnext__runs">
      <p className="tnext__label"><span>Runs</span><span>{diff}</span></p>
      <div className="tnext__runsbar" role="img" aria-label={`${rs} runs scored, ${ra} allowed`}>
        <span className="tnext__seg tnext__seg--rs" style={{ flex: `${rs} 1 0` }}><i style={{ '--flash-delay': '950ms' }} /><b>Scored</b><span>{rs}</span></span>
        <span className="tnext__seg tnext__seg--ra" style={{ flex: `${ra} 1 0` }}><i style={{ '--flash-delay': '1150ms' }} /><b>Allowed</b><span>{ra}</span></span>
      </div>
    </div>
  )
}
