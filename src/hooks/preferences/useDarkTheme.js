import { useSyncExternalStore } from 'react'

// Whether the page is in night mode right now (ADR-0130): <html data-theme> wins, else the phone's
// prefers-color-scheme. One shared observer, so 200 logos do not each add a listener.
const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null

function subscribe(notify) {
  const obs = new MutationObserver(notify)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  mq?.addEventListener?.('change', notify)
  return () => {
    obs.disconnect()
    mq?.removeEventListener?.('change', notify)
  }
}

const read = () => {
  const attr = document.documentElement.dataset.theme
  return attr ? attr === 'dark' : mq?.matches === true
}

export const useDarkTheme = () => useSyncExternalStore(subscribe, read, () => false)
