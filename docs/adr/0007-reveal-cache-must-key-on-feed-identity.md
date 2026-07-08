# Manual caches of reveal-only derivations must key on feed identity

Reveal-only per-inning derivations (`computeDerivedByInning`) are expensive
enough over a full game's play-by-play that `InningViewer` caches them in a
`useRef` rather than recomputing every render — but caching across
live-refresh polls is only correct if the cache key is the `feed` object
itself, rebuilt whenever `feed` changes. Caching without keying on `feed`
froze the live inning's pitch/whiff stats after a Refresh (the cache kept
serving the pre-refresh feed's derivation instead of picking up newly arrived
plays). Any future manual cache of a reveal-only derivation must follow the
same rule.
