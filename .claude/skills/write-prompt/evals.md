# write-prompt evals

Run each idea with the skill and again as a plain "write a prompt for this". A draft wins
when it holds the hidden intent: what the author would say if asked.

1. **"The innings viewer sometimes shows the wrong half after I go back an inning."**
   Hidden intent: gamePk 775305, 9th back to 8th, the seal stays shut, a failing test first.
2. **"Rename the Game Log tab to Journal."**
   Hidden intent: UI text only, routes stay, the e2e specs that name the tab change too.
   Two questions at most, a cheap model, one prompt.
3. **"Add a pitch-by-pitch replay view for a finished game."**
   Hidden intent: a decision prompt first (route and data), no score read before a reveal.
   It splits, marks what runs in parallel, and offers `/orchestrate`.

Every draft must stand alone and say what "done" means in a way a test or screenshot shows.
