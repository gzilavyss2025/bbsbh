import { Component } from 'react'

// A missing decorative chunk must never take down the scoring surface.
export class CelebrationBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFail() }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
