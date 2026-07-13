// One Statcast superlative: the measure up top (FASTEST PITCH), the value with
// its unit trailing in a smaller face (95.2 MPH), then who did it beneath — a
// pitcher's card also names the pitch type (MAY (SINKER)). Shared by the
// innings view's per-half row and the box score's whole-game Insights card.
export function StatcastCard({ label, value, unit, who, detail }) {
  return (
    <div className="statcast__card">
      <span className="statcast__label">{label}</span>
      <span className="statcast__value">
        {value}
        <em className="statcast__unit"> {unit}</em>
      </span>
      {who && (
        <span className="statcast__who">
          {who}
          {detail ? ` (${detail})` : ''}
        </span>
      )}
    </div>
  )
}
