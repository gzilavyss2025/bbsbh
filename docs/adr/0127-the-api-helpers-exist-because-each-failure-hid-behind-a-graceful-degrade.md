# The api helpers exist because each failure hid behind a graceful degrade

**Status:** Accepted (Gary, 2026-11-04)
**Date:** 2026-11-04
**Issue:** #2847

## Context

`api/_lib/redis.js`, `auth.js` and `nodeHandler.js` each carried a long comment block telling the
story of the production failure the file was written for. The stories are worth keeping; they do not
belong in the code, where they were about half of each file. They moved here (ponytail audit,
#2844). The lesson is the same four times: **a graceful degrade hides a hard failure
indefinitely**, so each helper names its failure and a test pins it.

## The four incidents

### 1. The Redis store was linked but the functions 501'd (`_lib/redis.js`)

Each function read `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` itself and answered its
"sync not configured" 501 when either was missing. That is the correct degrade (sync is opt-in,
ADR-0022) and it looks the same as a deploy with no store on purpose. Connecting an Upstash database
through Vercel's **KV** integration injects the same REST credentials under
`KV_REST_API_URL` / `KV_REST_API_TOKEN`, so a project could be linked to a running store and still
501 on every request, with nothing in the logs.

So `redisConfigFromEnv` reads a list of name pairs, with two rules:

1. **A pair is atomic.** A URL from one integration is never joined to a token from another; that
   fails at request time instead of startup, which is worse than the 501.
2. **Only read-write REST credentials.** `KV_URL` / `REDIS_URL` are `rediss://` strings for a TCP
   client, and `KV_REST_API_READ_ONLY_TOKEN` cannot write. All three stay off the list.

The Upstash-native names win when both pairs are set (`docs/development.md`). Values are trimmed; an
all-whitespace value is "not set". `getRedis` passes `responseEncoding: 'base64'`, the wire format
every caller and `test/api-copy-handler.test.js` were written against (`@upstash/redis` 1.40 changed
the default to plain JSON).

### 2. `hgetall` answered an array, so every override vanished (`hashFromReply`)

`automaticDeserialization: false` does two things in `@upstash/redis`. It stops the JSON.parse the
copy store wants gone (an admin string like `"42"`, `"true"` or `"null"` would come back as a number,
boolean or null and be dropped as "not a string"). It also replaces the whole deserializer with the
identity function, and for HGETALL that deserializer is what pairs Redis's flat
`[field, value, ...]` reply into an object. So `redis.hgetall()` answered an array;
`sanitizeOverrides` walked it with `Object.entries`, saw ids `"0"`, `"1"`…, matched none of them, and
returned `{}`. Writes landed the whole time; every read, on every surface, saw nothing. An empty
override map is exactly what a deploy with no store looks like, so nothing reported a failure.

The two are a matched pair: `automaticDeserialization: false` at the call site, `readHash` /
`hashFromReply` on every read. Removing either alone brings the bug back. The same read is needed
before a write: an unpaired reply made `staleKeys` always empty (clearing a field never deleted it)
and every history snapshot record an empty `prev` (undo had nothing to restore). An object reply is
passed through, so a future client that pairs the hash itself widens what the endpoint reads instead
of breaking it. `test/api-copy-handler.test.js` pins the shape the real client produces.

### 3. Every authenticated request answered `401` for four different reasons (`_lib/auth.js`)

Each function had its own `authenticate()` that collapsed every problem to `return null`, and every
caller made that a bare `401 unauthorized`. These were indistinguishable from outside:

1. `CLERK_SECRET_KEY` is not set on this deploy.
2. The request carried no token.
3. The token is real but this deploy cannot verify it (usually a secret key from a different Clerk
   instance than the publishable key).
4. The token is expired or forged.

(1) and (3) need a human; (2) and (4) are the system working. So now:

- `501 sync not configured`: no Redis credentials reach the function.
- `501 auth not configured`: no `CLERK_SECRET_KEY`.
- `401 no token`: auth is configured; this request was anonymous.
- `401 invalid token`: a token arrived and could not be verified.

None of these leak anything: which env vars a deploy has is not a secret, and no response says
anything about a user.

**The server logs what the response will not say.** Production once rejected every genuine token as
`invalid token` while the publishable key, the issuer and the secret key were each verified to belong
to one Clerk instance. Clerk's reason (`token-invalid-signature` vs `token-expired` vs
`jwk-remote-failed-to-load`, three unrelated faults) was being caught and thrown away. It now goes to
the log; the response is unchanged. The token is never logged (a live credential). The secret key is
logged as its 8-character prefix only (`sk_live_` / `sk_test_`), which says live vs test and whether
a publishable key (`pk_…`) was pasted into the wrong variable. That mix-up is easy to make and
impossible to see once Vercel marks the variable Sensitive.

**The return shape.** `verifyToken` in `@clerk/backend` 3.x **resolves to the JWT payload itself**
and **throws** when a token does not verify. It does not resolve to `{ data, errors }`. The file once
destructured that, so `data` was `undefined` for a valid token, `!data?.sub` was always true, and
every authenticated request in production was `401 invalid token` since the day Clerk was added. It
hid because it failed in the direction of a misconfiguration (a good token rejected looks like a
wrong secret key), and several rounds of re-issuing correct keys followed. What named it was logging
the reason: "no `sub` on a token that verified" only makes sense if verification succeeded and the
result was discarded. If a bump changes this again, the symptom is a 100% auth failure rate with
valid credentials: check this contract first.

`CLERK_AUTHORIZED_PARTIES` (comma-separated origins) is an optional hardening applied to every
authenticated endpoint, user and admin; unset, `verifyToken` skips the check and the allowlist still
bounds writes to enumerated user ids. `authPreflight`, `authorizedParties`, `keyShape` and the
injectable `log` / `verify` of `authenticateUser` exist so the unit suite pins all of this without a
live Clerk instance.

### 4. Every Node function threw `Invalid URL` on its first line (`_lib/nodeHandler.js`)

`api/reveal.js`, `api/copy.js` and a day-consent endpoint (removed in ADR-0116) were written for the
Web fetch shape: `new URL(req.url)`, `req.headers.get(...)`, `await req.json()`, `return new
Response(...)`. That is the edge runtime. Under `runtime: 'nodejs'` Vercel hands the handler Node's
`(req, res)`, where `req.url` is a bare path:

```
TypeError: Invalid URL
    at handler (file:///var/task/api/reveal.js:101:28)
    { code: 'ERR_INVALID_URL', input: '/api/reveal?gamePk=1' }
```

Every request threw. Nothing visibly broke, because the client treats these endpoints as optional
(`CopyProvider` falls back to shipped defaults, both sync components stay local-only), so a 500
looked like "this deploy's optional functions are not configured", a supported state. The module
smoke test imported the file and called it with a Web `Request`, a shape production never passes,
which is how it shipped. The fix is the adapter plus `test/node-handler.test.js` and
`test/api-handlers.test.js`, which drive handlers with the Node shape.

`readRawBody` enforces `maxBytes` **while reading**, not after: a `content-length` header is a number
the caller supplies, and checking the total after buffering would hold a 500 MB body in a function's
memory first. It counts as chunks arrive and abandons the read over the cap, so nothing larger than
the cap is resident. Vercel's Node runtime hands a Buffer on `req.body` for a content-type its parser
does not own (every image type).

## Decision

- The three files keep a three-line header pointing here; the stories live here.
- Every `_lib` helper keeps its test against the shape production produces, not the shape that is
  convenient.
- Since #2847 every non-edge function runs on the Node runtime, and the adapter reads only the Node
  shape: the `Headers.get`, `req.json()`, `arrayBuffer()` and `Response`-return branches were removed
  (the edge functions never imported this file).

## Consequences

- The code carries the "what", this record the "why"; deleting a branch in these files means reading
  the matching incident first.
- If Vercel's runtime contract shifts again, `test/node-handler.test.js` is where the new shape goes.
