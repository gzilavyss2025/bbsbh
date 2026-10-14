// The Form trend's Play button icon (board FormTrend): a triangle while the season is
// stopped, two bars while it plays. Drawn in the button's own ink (currentColor), 16px.
// Button's icon slot is aria-hidden: the label ("Play the season", "Pause") is the name.
const PLAY = 'M5 3L16 10L5 17Z'
const PAUSE = 'M5 3H8V17H5Z M12 3H15V17H12Z'

export function PlayPauseIcon({ playing }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
      <path d={playing ? PAUSE : PLAY} fill="currentColor" />
    </svg>
  )
}
