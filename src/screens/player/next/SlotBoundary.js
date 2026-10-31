import { Component } from 'react'
import { reportCrash } from '../../../lib/crash/report.js'

// Catches a module that throws, or a module chunk that fails to load (a 404 after a
// deploy), so one bad module drops only its own card and never the page's React root.
// `slotKey` names it in the console. `onFail` is the slot's no-data path: the card and its button hide like an empty module.
export class SlotBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(`player page: slot ${this.props.slotKey} failed`, error)
    this.props.onFail()
    // The crash signal (#2514): the kind only, never the error (lib/crash/report.js).
    ;(this.props.report ?? reportCrash)({ kind: 'render', route: 'player' })
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
