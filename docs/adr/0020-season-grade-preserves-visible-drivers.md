# Season Grade preserves Quality and Vs. expectation as visible drivers

The Team Page previously gave equal headline weight to Season Quality and
Current Form, while Season Surprise appeared only as a wins-above-expectation
detail. That arrangement answered how strong a team was but under-described why
an above-average season could be extraordinary for that particular club.

The headline is now **Season Grade**: a headroom-aware composite of Quality and
Vs. expectation. Quality remains the foundation. Over- or under-performance
adjusts only the remaining distance to the corresponding end of the 0–10 scale,
which prevents surprise alone from casually outranking elite play.

Both drivers must remain visible immediately beneath the Grade and separately
expandable. Current Form is a subordinate diagnostic and cannot modify the
Grade. This is a transparency constraint: a composite verdict is acceptable
only while a reader can see whether it came from dominant play, an exceptional
assignment, or both.

The composite is computed client-side from the two existing dated snapshots.
League comparison includes only clubs with both inputs available at the Team
Page cutoff. This preserves ADR-0018's no-fall-forward contract without adding a
third generated data file or coupling the two nightly jobs.
