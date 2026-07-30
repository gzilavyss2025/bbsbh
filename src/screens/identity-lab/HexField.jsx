// A hex text input plus an inline eyedropper button that samples a pixel
// straight off the screen — the browser's own EyeDropper API — so curating a
// swatch never means round-tripping through Preview/Photoshop to read a color
// off an already-rendered logo. Every hex field across the lab (ColorSwatch's
// editable role slots, HeaderPreview's Bar/Accent/On bar, LogoPositionControls'
// Background/Fill, WpaPreview's Band/Fill) renders through this one component
// instead of a bare `<input>`, so the affordance can't drift between them.
//
// `window.EyeDropper` is Chromium-only (Chrome/Edge — absent in Firefox and
// Safari as of this writing); the button simply doesn't render where it's
// missing rather than throwing on click, same fail-quiet shape as CopyBox's
// clipboard fallback. An inline SVG rather than a text label or glyph — the
// narrowest spot this renders in (ColorSwatch's 76px swatch cell) has no room
// for a word, and a stock pipette shape reads at any width text would need to
// be legible.
function EyedropperIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m2 22 1-4 9.5-9.5" />
      <path d="M17.5 3.5a2.12 2.12 0 0 1 3 3L18 9l-3-3Z" />
      <path d="m3 21 4-1 9-9-3-3-9 9Z" />
    </svg>
  )
}

export function HexField({ value, placeholder, onChange, className }) {
  const supported = typeof window !== 'undefined' && 'EyeDropper' in window

  const pick = async () => {
    try {
      const result = await new window.EyeDropper().open()
      onChange(result.sRGBHex)
    } catch {
      // Cancelled (Escape) or the picker failed to open — leave the field as
      // it was, same as a copy button's denied-clipboard fallback.
    }
  }

  return (
    <span className="colorlab__hexfield">
      <input
        type="text"
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {supported && (
        <button
          type="button"
          className="colorlab__eyedropperbtn"
          onClick={pick}
          aria-label="Pick a color from anywhere on screen"
          title="Eyedropper — pick any pixel on screen, including the logo above"
        >
          <EyedropperIcon />
        </button>
      )}
    </span>
  )
}
