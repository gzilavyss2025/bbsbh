// Expands the landing pages into copy-registry FIELDS.
//
// The registry is the closed set that makes admin editing safe (see the header
// of `src/copy/registry.js`): api/copy.js validates every incoming override
// against these ids and length caps, so a hand-crafted POST can only ever set a
// KNOWN key to a bounded string. Landing-page prose joins that same set — it
// gets no special path, no separate endpoint, and no separate validation.
//
// DERIVED, never hand-listed, for the same reason `parkFields()` is derived from
// BALLPARKS: the page modules are the one place the content is written down, and
// a second hand-kept list here would drift. A drifted id is not cosmetic — ids
// are Redis field names, so a slot whose id moved silently abandons the text
// somebody wrote and renders the shipped default, which looks exactly like a
// page nobody has edited yet.
//
// SPOILER GUARD. Everything here is prose about how to keep score, typed by hand
// about a subject with no result. No field may be interpolated with game data,
// and no landing page may render a value from the feed — see the note at the top
// of `schema.js` and the invariant test that pins it.

import { LANDING_PAGES } from './pages/index.js'
import { pageSlots } from './schema.js'

export function landingFields() {
  return LANDING_PAGES.flatMap((page) =>
    [...pageSlots(page)].map((slot) => ({
      id: slot.id,
      group: 'learn',
      subgroup: page.metaTitle,
      label: slot.label,
      help: `Shown on /learn/${page.slug}. Leave empty to use the shipped wording.`,
      maxLength: slot.maxLength,
      multiline: slot.multiline,
      // The shipped text is the DEFAULT, not a stored value. An empty override
      // means "use what shipped", so clearing a box in the editor restores the
      // authored copy instead of printing a blank paragraph onto a public page.
      default: slot.value,
    })),
  )
}
