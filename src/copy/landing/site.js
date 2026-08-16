// The site's own identity, in one place.
//
// SITE_URL must be ABSOLUTE and must match the canonical origin in index.html's
// OG block — a canonical tag and an og:url that disagree are worse than neither,
// because a crawler resolves the conflict by picking one and you do not get to
// know which. Kept here rather than read from the request origin on purpose:
// preview and branch deployments must NOT advertise themselves as canonical, or
// a preview URL can be indexed in place of production.
export const SITE_NAME = 'Tally Baseball'
export const SITE_URL = 'https://bbsbh.vercel.app'
