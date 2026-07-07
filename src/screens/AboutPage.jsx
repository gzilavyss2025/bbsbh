import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

// Placeholder for now — just the standard screen shell with a back button.
// Content to come.
export function AboutPage({ onBack }) {
  useDocumentTitle('About')
  return (
    <div className="screen">
      <header className="topbar">
        <button className="topbar__back" onClick={onBack}>
          ‹ Games
        </button>
        <h1 className="topbar__title">About</h1>
      </header>
    </div>
  )
}
