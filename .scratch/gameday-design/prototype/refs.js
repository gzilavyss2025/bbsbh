// What MVP Baseball 2003–05 and MLB The Show 07–16 put on screen. Seen = in the still. For Gameday = inference.
window.GD_REFS = [
  {
    title: 'The batting view',
    items: [
      ['The field fills the screen. Info floats at the corners and the top edge; nothing sits in a side panel.', 'MVP 04, MVP 05, Show 09 to 16', 'For Gameday: direction A.'],
      ['MVP 04 scorebug: two rows (runs, club, an inning arrow on the batting row) and "0-0-1" (balls-strikes-outs) at the right.', 'MVP 04', ''],
      ['The Show 09 to 12: one strip across the top, "TB 3 | BOS 1 | ▼1ST | 1-2 | 2 OUT".', 'Show 09, 11, 12', 'For Gameday: the band on a wide screen.'],
      ['The Show 16: a compact block at the top left with logos, score, a base diamond, out dots, "PITCHES 31", inning and count.', 'Show 16', 'For Gameday: the band on a phone, with the pitch count.'],
      ['A diamond inset hangs under the scorebug with a live picture of each runner on base.', 'MVP 03, 04, 05', 'For Gameday: tap the bases in the band for the runners sheet.'],
      ['The zone is light: four corner brackets (MVP) or a thin outline (The Show).', 'MVP 04, Show 09', ''],
    ],
  },
  {
    title: 'After the pitch',
    items: [
      ['"81 MPH / SLIDER" sits over the zone brackets as the pitch arrives.', 'MVP 03, 04', ''],
      ['A small "90 mph CUT" tag beside the pitch-location crosshair, with a "K" badge.', 'Show 10', 'For Gameday: the decision-pitch tag on the stage.'],
      ['A corner panel: "Swing timing: Good / Contact result: Line drive, Hit speed 107 mph / 4SFB 97 mph" and a mini zone with the pitch dot.', 'Show 16', 'For Gameday: the pitch panel and contact readout.'],
      ['After contact: a high wide shot from behind home with every fielder in view; then an overhead fielding view with a diamond mini-map and the ball as a red dot.', 'Show 15', 'For Gameday: the broadcast concept\'s cuts and the mini-map.'],
      ['A low side camera at first base on a play there. No HUD on screen.', 'MVP 04', ''],
    ],
  },
  {
    title: 'Cards and pauses',
    items: [
      ['"Now batting" lower third: logo, number, name, position, one row of season stats, a headshot box at the right.', 'MVP 04, Show 09', 'For Gameday: the hero strip.'],
      ['Pitcher cards at the right: "Starting pitcher" with a season table (MVP 04); "Last start" with that game\'s line (Show 12).', 'MVP 04, Show 12', 'For Gameday: the pitcher intro on a fresh arm.'],
      ['Between halves: a full-screen line score and "Due up" with three bars (slot, position, name, number, headshot) and today\'s line, "1 FOR 1 / 1B".', 'Show 07', 'For Gameday: checkpoint page 4, and the day lines (#2606).'],
      ['"Mid 1st" R H E box in a corner over a crowd shot.', 'Show 09, 16', ''],
      ['Defensive alignment: an overhead field with headshot and name tags at each position.', 'Show 10', 'For Gameday: the Field reference.'],
      ['Final score: two club panels, the save, both pitchers\' lines side by side with W and L, a Box score tab, an Advance prompt.', 'MVP 05', 'For Gameday: the end-of-game checkpoint, then the box score.'],
      ['Not borrowed: the other-scores ticker along the bottom (Show 12). Other games are not this page\'s job.', 'Show 12', ''],
    ],
  },
]
window.GD_REF_SOURCES = [
  ['MVP 04 batting, Fenway', 'https://www.youtube.com/watch?v=gzZG4JAE9kM'],
  ['MVP 04 batting, Philadelphia', 'https://www.youtube.com/watch?v=qo9n4ebkWDY'],
  ['MVP 04 batting and first base, Yankee Stadium', 'https://www.youtube.com/watch?v=perChHVuFiA'],
  ['MVP 04 now batting (PS2)', 'https://www.youtube.com/watch?v=QJ1PaTVNj3M'],
  ['MVP 04 now batting (PC)', 'https://www.youtube.com/watch?v=Uit169QzuM4'],
  ['MVP 04 starting pitcher', 'https://www.youtube.com/watch?v=yexHNTWmhxk'],
  ['MVP 05 pitching view', 'https://www.youtube.com/watch?v=4MET3nlzzys'],
  ['MVP 05 final score', 'https://www.youtube.com/watch?v=GanCEnNi23U'],
  ['MVP 03 batting', 'https://www.youtube.com/watch?v=IUcSvbZiM34'],
  ['MLB 07 The Show due up', 'https://www.youtube.com/watch?v=SGAxyfO4AbE'],
  ['MLB 09 The Show batting', 'https://www.youtube.com/watch?v=PWjWjDkJ1EY'],
  ['MLB 09 The Show now batting, mid 1st', 'https://www.youtube.com/watch?v=AwHMx0VFor0'],
  ['MLB 10 The Show pitch tag, alignment', 'https://www.youtube.com/watch?v=9F1Tf_oONVQ'],
  ['MLB 11 The Show batting', 'https://www.youtube.com/watch?v=hEfhzN9bbEU'],
  ['MLB 12 The Show pitching, last start', 'https://www.youtube.com/watch?v=tTdbLj8mJ4M'],
  ['MLB 15 The Show high home, fielding', 'https://www.youtube.com/watch?v=uRGAepFI73c'],
  ['MLB The Show 16 batting, contact panel', 'https://www.youtube.com/watch?v=m2EXYeFrXUs'],
]
// Menus: pause, quick and sub-menus, and the end of a game.
window.GD_REF_MENUS = [
  ['MVP 05 pause: the list covers the top half only. The bottom third keeps the game: the pitcher strip (ERA, stamina), the batter and three due-up rows with averages, and a small diamond with the runner and his speed. The field shows through.', 'MVP 05', 'For Gameday: an open menu never hides the never-fold items.'],
  ['MVP 05 sub-menus keep the same frame: Roster options, then Pitching/Defense (mound visit, pitcher substitution, alignment, warm up), then a bullpen list beside a card for the picked pitcher.', 'MVP 05', 'For Gameday: one sheet whose header stays put while its list changes.'],
  ['The Show 15 pause: a menu list at the left and a 2 × 2 grid of live panels (Bullpen, Defense positioning, Substitutions with the batter\'s spray and "Today: 0 for 2", Batting order), under a line score with a big B-S-O readout.', 'Show 15', 'For Gameday: on a wide screen the menu can open as a grid of the reference tabs, all at once.'],
  ['The Show 15 quick menu: a small box at the bottom centre (Substitution, Bullpen, Mound visit, Opponent\'s bullpen) that opens without pausing. The scorebug, a pitcher comparison and the due-up panel stay on screen.', 'Show 15', 'For Gameday: the phone menu as a short sheet over the bottom of the stage, not a full page.'],
  ['The Show 13 pause: the field is the menu. The pitcher\'s card sits on the mound, the batter\'s at home, the runner\'s on his base, the wind in a corner, and "Due up" at the bottom right.', 'Show 13', 'For Gameday: a candidate for the waiting state and the Field tab: cards placed on a diamond.'],
  ['MVP 04 Manager Challenge (from the manual): decisions down the left; a game status box (outs, inning, a diamond with runner names, the score); three lines of recent plays; the pitcher and batter cards side by side with "1 for 3"; a "Cycle display" button and Advance.', 'MVP 04 manual', 'For Gameday: the closest thing to a turn-based screen in these games. It is direction B with an event log.'],
  ['The Show 08 and 10 pause pages hide the field and show the at-bat, three due-up rows, the pitcher with his pitch count, the umpires and the wind.', 'Show 08, 10', ''],
  ['Game over (MVP 05): the menu at the top (Box score, Quit), the winning and losing pitchers, and the full line score at the bottom, over the field.', 'MVP 05', 'For Gameday: the end-of-game checkpoint, then the box score.'],
  ['Post-game (The Show 13): a list of every play in order, with a star on each scoring play.', 'Show 13', 'For Gameday: a candidate to replace "See the whole half": one line per play, no cards, no scroll for a normal half.'],
  ['Not found: an MVP 2004 pause menu (the manual names it but shows no picture), any in-game camera menu, and the MLB 09, 11 and 16 pause menus.', '', ''],
]
window.GD_REF_MENU_SOURCES = [
  ['MVP 05 dynasty game (pause, sub-menus, bullpen, game over)', 'https://archive.org/details/nl-all-stars-vs-al-all-stars-ea-sports-mvp-baseball-2005-dynasty-mode-uploaded-2019'],
  ['MVP 04 PS2 manual (Manager Challenge, Dynasty hub)', 'https://archive.org/details/ps2_MVP_Baseball_2004_USA'],
  ['MLB 08 The Show review (pause, status)', 'https://archive.org/details/31936-t-mlb-08theshow-vr-gt'],
  ['MLB 10 The Show Quick Look (pause)', 'https://archive.org/details/gb-2300-2187-ID9SXQO'],
  ['MLB 12 The Show (pause, bullpen)', 'https://www.youtube.com/watch?v=ZbHQjvp320U'],
  ['MLB 13 The Show Quick Look (pause, bullpen, post game)', 'https://archive.org/details/gb-2300-7243-IDHP63V'],
  ['MLB 15 The Show Quick Look (pause, quick menu, shifts)', 'https://archive.org/details/gb-2300-10077-IDYM7XE'],
]
