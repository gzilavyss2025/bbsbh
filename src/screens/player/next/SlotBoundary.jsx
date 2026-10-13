import { Component } from 'react'

// Catches a module that throws, or a module chunk that fails to load (a 404 after a
// deploy), so one bad module drops only its own card and never the page's React root.
// `onFail` is the slot's no-data path: the card and its button hide like an empty module.
export class SlotBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFail()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
