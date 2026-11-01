import { Component } from 'react'
import { recoverOnce, purgeAndReload } from '../../../lib/crash/recover.js'
import { Notice } from './Notice.jsx'
import { Button } from '../control/Button.jsx'

// The app's last line: a render error nothing else caught. Without it React unmounts the root
// and the reader sees a blank page. The first time in a session it repairs the cached app files
// and reloads (lib/crash/recover.js); if it breaks again, it shows a card with a reload button.
// main.jsx's onCaughtError already reports the crash.
export class RootBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    if (recoverOnce()) this.setState({ repairing: true })
  }

  render() {
    if (!this.state.failed) return this.props.children
    if (this.state.repairing) return null
    return (
      <Notice
        tone="error"
        label="Did not load"
        action={<Button skin="ink" onClick={purgeAndReload}>Reload</Button>}
      >
        Reloading fetches a fresh copy of the app. Your games and settings stay.
      </Notice>
    )
  }
}
