#!/bin/bash
# SessionStart hook — a one-line reminder, added to session context every time,
# so any agent that later drives the app while testing remembers the flag.
# stdout from a SessionStart hook is injected as context; keep it to a single
# line so the token cost stays negligible.
set -euo pipefail
echo "bbsbh testing note: when loading the app to test/verify (home slate or any route), append ?nointro to the URL so the first-visit welcome modal doesn't pop and steal focus. Playwright specs get this automatically via e2e/fixtures.js."
