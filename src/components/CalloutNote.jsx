// A season-context call-out line — the leader / streak / situational-record
// fun fact (see api/callout-notes.js), marked off with a small star and the
// kraft-amber seal accent. Shared by the play-by-play at-bat card (one note at
// a time, where it fired) and the box score's Insights card (the whole game's
// notes rolled up in one list).
export function CalloutNote({ text }) {
  return (
    <div className="pbp__callout">
      <span className="pbp__calloutmark" aria-hidden="true">★</span>
      {text}
    </div>
  )
}
