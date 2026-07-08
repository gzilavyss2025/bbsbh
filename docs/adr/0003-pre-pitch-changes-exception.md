# Pre-pitch changes render above the seal, but only for the next half to reveal

`selectPrePitchChanges` is the one deliberate exception to "reveal-only
modules are only called inside a SealBox": subs, pitching changes, and
pinch-hitters logged before a half-inning's own first pitch are the same
information a broadcast announces before the half starts, so they aren't
actually score-revealing the way a run total is. `InningViewer` renders them
above the seal — but only when `halfIndex === revealedThrough + 1`, i.e. only
for the half the user is about to reveal next. A half further out stays fully
sealed, so this exception can't be used to peek ahead.
