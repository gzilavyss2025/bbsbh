// The site's own identity, in one place.
//
// SITE_URL must be ABSOLUTE and must match the canonical origin in index.html's
// OG block — a canonical tag and an og:url that disagree are worse than neither,
// because a crawler resolves the conflict by picking one and you do not get to
// know which. Kept here rather than read from the request origin on purpose:
// preview and branch deployments must NOT advertise themselves as canonical, or
// a preview URL can be indexed in place of production.
//
// THE ORIGIN IS THE APEX DOMAIN, `tallybb.com`. Three hostnames serve identical
// bytes — `tallybb.com`, `www.tallybb.com` and the Vercel deployment hostname
// `bbsbh.vercel.app` — and only one of them may be advertised. This constant is
// the single place that choice is made: it feeds the sitemap's every <loc>
// (scripts/gen-sitemap.mjs), the /learn documents' canonical, og:url and JSON-LD
// (render.js), and the per-route canonical the link-preview function injects
// (api/preview.js). public/robots.txt, public/llms.txt and index.html's default
// OG block hold the same origin as literals, because a static file cannot import
// this one — keep them in step.
export const SITE_NAME = 'Tally Baseball'
export const SITE_URL = 'https://tallybb.com'
