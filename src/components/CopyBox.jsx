import { useState } from 'react'

// A block of pre-formatted context plus a copy-to-clipboard button — the
// pattern first used on Team Pattern Lab (screens/TeamPatternLab.jsx) for
// handing a review note back to Claude without retyping which team/file/
// table it's about. `label` is the button's accessible name only (not
// rendered); the visible button text is always "Copy"/"Copied!".
export function CopyBox({ text, label }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission denied or unavailable — the text is still
      // selectable/readable in the box, so this fails quiet rather than
      // throwing up an error the user can't act on.
    }
  }

  return (
    <div className="copybox">
      <pre className="copybox__text">{text}</pre>
      <button type="button" className="copybox__btn" onClick={copy} aria-label={label}>
        {copied ? 'Copied!' : '⧉ Copy'}
      </button>
    </div>
  )
}

// A compact icon-only variant for inline placement next to a single line of
// content (e.g. Team Color Lab's per-jersey match row) rather than its own
// boxed block — same clipboard behavior, no visible text/pre wrapper.
export function CopyIconButton({ text, label }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Same fail-quiet rationale as CopyBox above.
    }
  }

  return (
    <button type="button" className="copybox__iconbtn" onClick={copy} aria-label={label} title={label}>
      {copied ? '✓' : '⧉'}
    </button>
  )
}
