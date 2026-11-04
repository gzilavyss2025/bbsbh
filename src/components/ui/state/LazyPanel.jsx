import { Component, Suspense } from 'react'
import { reportCrash } from '../../../lib/crash/report.js'

// A lazily loaded slate panel. While its chunk loads it reserves the panel's
// height (`.slate-reserve--{reserve}`, 25-wide-layout.css) so the games below do
// not jump; if the chunk fails to load (a 404 after a deploy, a phone gone
// offline) the panel is simply absent — it never takes the slate down
// (MoveRow.jsx's WireFactsBoundary is the same rule).
export class PanelBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // The crash signal (#2514): the kind only, never the error (lib/crash/report.js).
    reportCrash({ kind: 'render' })
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function LazyPanel({ reserve, children }) {
  return (
    <PanelBoundary>
      <Suspense fallback={<div aria-hidden="true" className={`slate-reserve slate-reserve--${reserve}`} />}>
        {children}
      </Suspense>
    </PanelBoundary>
  )
}
