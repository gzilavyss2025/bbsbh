// The nightly data trigger (#2725, ADR-0125). A Vercel cron (vercel.json, 08:17 UTC) calls this, and it
// asks GitHub to run update-nightly-data.yml. The job itself stays in Actions; Vercel only starts it,
// because Vercel's cron fires on time and GitHub's schedule has run hours late. The run is marked
// `trigger: cron`, so the workflow's gate treats it like a scheduled run and skips it when the nightly
// routine already ran. Inert until both secrets are set: CRON_SECRET (Vercel sends it as a bearer
// token on every cron call) and NIGHTLY_DISPATCH_TOKEN (fine-grained, Actions: write on this repo only).
// No score, no store.
export const config = { runtime: 'edge' }

const DISPATCH = 'https://api.github.com/repos/gzilavyss2025/bbsbh/actions/workflows/update-nightly-data.yml/dispatches'

export default async function handler(request) {
  const secret = process.env.CRON_SECRET
  const token = process.env.NIGHTLY_DISPATCH_TOKEN
  if (!secret || !token) return new Response(null, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return new Response(null, { status: 401 })
  const res = await fetch(DISPATCH, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { trigger: 'cron' } }),
  })
  if (!res.ok) console.log(`bbsbh-nightly-dispatch failed ${res.status}`)
  return new Response(null, { status: res.ok ? 202 : 502 })
}
