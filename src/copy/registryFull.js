// The full copy registry: the runtime fields plus the /learn guide prose.
// Only the server (api/copy.js, api/page.js) and the lazy admin editor import
// this; the SPA's first-load JS imports registry.js and never sees the guides.
import { FIELDS as RUNTIME_FIELDS, GROUPS, makeRegistry } from './registry.js'
import { landingFields } from './landing/fields.js'

export { GROUPS }
export const FIELDS = [...RUNTIME_FIELDS, ...landingFields()]
const reg = makeRegistry(FIELDS)
export const defaultCopy = reg.defaultCopy
export const sanitizeOverrides = reg.sanitizeOverrides
export const mergeOverrides = reg.mergeOverrides
