# Contact replay prototype

`prototype.html` is a copy of Gary's design study for #1771 (a private
claude.ai page, copied 2026-10-19). Open it in a browser to see the replay.

- It uses invented sample data, not real games.
- Its math (`pitchModel`, `swingModel`, `build`, `battedFlight`) is the
  reference for the swing, the contact and the beat timing. Port it into
  `src/lib/pitcherCard/`; do not import this file.
- It is one page with one loop. The app splits the work across `PitchScene`,
  `SideView` and `QualityLine`. Use the clock design in the run plan's prompts.
- When this file and `docs/contact-replay.md` do not agree, the spec wins.
