import { useEffect } from 'react'

const BASE_TITLE = 'Scorebook Helper'

// Keeps the browser tab title in sync with whichever screen/section is on
// screen, instead of the static "Scorebook Helper" baked into index.html.
// Every caller must only pass spoiler-free facts (team names, player names,
// section labels) — never a score — so the tab title can't leak a result
// the DOM itself is still sealing.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE
  }, [title])
}
