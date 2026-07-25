import { defaultCopy, fillTokens } from './registry.js'

// Build the `resolveText` override ConsentModal accepts, from the admin copy
// editor's CURRENT field values — including unsaved edits — so "View real modal"
// previews exactly what the live modal would render for the wording on screen.
//
// It mirrors PRODUCTION resolution, which is the point: a non-empty edited value
// wins; a BLANKED box falls back to the shipped default, because on save
// sanitizeOverrides drops an empty override (registry.js) and the app renders
// the default — so previewing a blanked title as an empty modal would show a
// state production can never produce. A slot the group doesn't define
// (scoresUnlocked has no changesNote) resolves to '' and ConsentModal skips it.
//
// {time} is filled HERE because ConsentModal only runs fillTokens on its default
// t() path — a resolveText result is taken verbatim.
const DEFAULTS = defaultCopy()

export function makePreviewResolver(group, values, time) {
  return (slot) => {
    const id = `${group}.${slot}`
    return fillTokens(values?.[id] || DEFAULTS[id] || '', { time })
  }
}
