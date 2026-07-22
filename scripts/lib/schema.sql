-- Phase 1 schema for the SQLite data layer (docs/adr/0021-sqlite-data-layer.md).
-- CREATE ... IF NOT EXISTS everywhere: this file is re-applied to a fresh
-- in-memory database on every generator run, before the committed dump
-- (scripts/data/bbsbh.sql) replays its INSERT statements on top.

CREATE TABLE IF NOT EXISTS game_scores (
  game_pk    INTEGER PRIMARY KEY,
  score      REAL NOT NULL,
  sport_id   INTEGER,
  home_id    INTEGER,
  away_id    INTEGER,
  updated_at TEXT NOT NULL
);

-- Collapses team-score.json's and season-score.json's parallel
-- season -> team -> date structures into one table. `metric` distinguishes
-- the three snapshot kinds that used to live in two separate files:
--   'quality'      - gen-team-score.mjs's season-to-date Quality summary
--   'current_form' - gen-team-score.mjs's last-10-games diagnostic
--   'surprise'     - gen-season-score.mjs's Season Surprise Score
-- `payload_json` carries each generator's existing snapshot shape verbatim
-- (see teamScoreFormula.js / buildSnapshots) rather than exploding every
-- field into its own column, so a formula tweak doesn't require a migration.
CREATE TABLE IF NOT EXISTS team_snapshots (
  season       INTEGER NOT NULL,
  team_id      INTEGER NOT NULL,
  date         TEXT NOT NULL,
  metric       TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (season, team_id, date, metric)
);

-- One dated row per (player, board) on an external prospect/scouting board —
-- currently Fever Baseball's breakout/fade radar (gen-fever-radar.mjs).
-- `payload_json` carries that source's own fields verbatim (rank, metrics)
-- so a source's schema tweak never needs a migration here, same convention
-- as team_snapshots. Its own group (not folded into team_snapshots) because
-- it's keyed by PLAYER, not team, and `source` leaves room for a second
-- outside board later without a new table.
CREATE TABLE IF NOT EXISTS player_snapshots (
  date         TEXT NOT NULL,
  player_id    INTEGER NOT NULL,
  board        TEXT NOT NULL,
  source       TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (date, player_id, board, source)
);

-- Career-since-2000 postseason batting/pitching totals, powering the
-- Postseason Leaders page's leaderboards. This is the genuine cross-game
-- aggregation case docs/adr/0021 calls out as the reason to add a new group
-- here: gen-postseason-history.mjs only stores series/game RESULTS, never
-- individual stat lines, so a leaderboard needs its own sweep
-- (gen-postseason-leaders.mjs) over every postseason game's boxscore.
--
-- Stores CAREER TOTALS directly (accumulated via an incrementing upsert as
-- each game is ingested), not one row per game — a per-game grain would be
-- ~30x more rows for value this page never needs (no single-postseason
-- slicing today), and a full re-sweep of every game since 2000 takes well
-- under a minute, so there's no real cost to re-deriving it fresh rather
-- than keeping a bulky per-game ledger in git (this project already prunes/
-- chunks other data for the same reason — see gen-callouts.mjs's retention
-- window and gen-team-transactions.mjs's season-chunking).
-- postseason_ingested_games is the (tiny) idempotency guard: which gamePks
-- have already been folded into the totals below, so a resumed or re-run
-- sweep never double-counts a game.
CREATE TABLE IF NOT EXISTS postseason_ingested_games (
  game_pk INTEGER PRIMARY KEY
);

-- `latest_team_id`/`latest_season` track whichever club a player most
-- recently played postseason ball for (for the leaderboard's team logo) —
-- updated only when an ingested game's season is >= the stored one, so
-- games folded in out of order (concurrent fetches) still converge on the
-- true most-recent team regardless of ingestion order.
CREATE TABLE IF NOT EXISTS postseason_batting_totals (
  player_id       INTEGER PRIMARY KEY,
  player_name     TEXT NOT NULL,
  latest_team_id  INTEGER NOT NULL,
  latest_season   INTEGER NOT NULL,
  at_bats         INTEGER NOT NULL DEFAULT 0,
  runs            INTEGER NOT NULL DEFAULT 0,
  hits            INTEGER NOT NULL DEFAULT 0,
  doubles         INTEGER NOT NULL DEFAULT 0,
  triples         INTEGER NOT NULL DEFAULT 0,
  home_runs       INTEGER NOT NULL DEFAULT 0,
  rbi             INTEGER NOT NULL DEFAULT 0,
  stolen_bases    INTEGER NOT NULL DEFAULT 0,
  caught_stealing INTEGER NOT NULL DEFAULT 0,
  walks           INTEGER NOT NULL DEFAULT 0,
  strikeouts      INTEGER NOT NULL DEFAULT 0
);

-- `outs` (outs recorded) rather than a fractional-innings string — summing
-- "6.1 IP" + "1.2 IP" as text would need its own thirds-of-an-inning math;
-- outs sum with plain addition and convert to innings (outs / 3) once, at
-- export time.
CREATE TABLE IF NOT EXISTS postseason_pitching_totals (
  player_id      INTEGER PRIMARY KEY,
  player_name    TEXT NOT NULL,
  latest_team_id INTEGER NOT NULL,
  latest_season  INTEGER NOT NULL,
  outs           INTEGER NOT NULL DEFAULT 0,
  wins           INTEGER NOT NULL DEFAULT 0,
  losses         INTEGER NOT NULL DEFAULT 0,
  saves          INTEGER NOT NULL DEFAULT 0,
  hits           INTEGER NOT NULL DEFAULT 0,
  earned_runs    INTEGER NOT NULL DEFAULT 0,
  walks          INTEGER NOT NULL DEFAULT 0,
  strikeouts     INTEGER NOT NULL DEFAULT 0
);

-- Available for future generation-time features that want a Quality+Surprise
-- pair without hand-rolling the lookup. Deliberately NOT wired in to replace
-- src/api/teamScore.js's leagueSeasonGradesFor: that function computes the
-- grade at a dynamic, PER-PAGE spoiler-safe cutoff (whichever game a reader
-- is viewing), and seasonGradeFormula.js's seasonGradeFromScores also runs
-- live for the Team Page's interactive "how this is calculated" explainer —
-- both need the raw dated snapshots and the pure formula in the browser, so
-- a build-time-precomputed grade would either miss historical cutoffs or
-- break the explainer. See docs/adr/0021.
-- Season-long foul-ball aggregates (gen-fouls.mjs, docs/.scratch/metric-engines/
-- foul-tracker.md — engines F1-F5). A completed game's fouls are immutable, so
-- like postseason_* these tables accumulate via incrementing upserts as each
-- game's live feed is swept, guarded by foul_ingested_games so a resumed/re-run
-- sweep never double-counts. Single-season (2026) by construction: the `season`
-- column is informational (overwritten to the latest ingested season); a genuine
-- new-season rebuild clears scripts/data/fouls.sql rather than adding a season
-- key to every primary key. Foul/whiff classification mirrors the live
-- derive.js path exactly via the shared FOUL_CODES/WHIFF_CODES/pitchCallCode in
-- src/api/playbyplay.js, so the precomputed and live tallies can't drift.

-- Fouls seen/hit BY each batter. `pitches_seen` counts every pitch thrown to him
-- (including pitches during a mid-at-bat baserunning play that resumes his AB).
-- `two_strike_fouls` are fouls hit with two strikes already (the AB-extending
-- kind) — the pre-pitch strike count is carried pitch-to-pitch and across a
-- non-PA play, since a pitch event's own `count` is the count AFTER the pitch.
-- `max_game_fouls`/`max_game_pk` track his single-game high, updated only when a
-- game exceeds the stored max (so it converges regardless of ingest order).
-- `max_game_pa`/`max_game_pitches` are that SAME game's PA/pitches-seen totals
-- (not season figures) — cheap to carry along since aggregateGameFouls already
-- computes them per game; `max_game_opp_id` is the opposing team he faced that
-- game (his own team doesn't change mid-game, so it's captured once). Together
-- with a join against foul_ingested_games.date at export time, these let the
-- Single-Game Highs board show "when / against whom / how much work" without a
-- separate lookup.
CREATE TABLE IF NOT EXISTS foul_batter_totals (
  person_id        INTEGER PRIMARY KEY,
  season           INTEGER NOT NULL,
  name             TEXT NOT NULL,
  team_id          INTEGER,
  games            INTEGER NOT NULL DEFAULT 0,
  pa               INTEGER NOT NULL DEFAULT 0,
  pitches_seen     INTEGER NOT NULL DEFAULT 0,
  fouls            INTEGER NOT NULL DEFAULT 0,
  two_strike_fouls INTEGER NOT NULL DEFAULT 0,
  max_game_fouls   INTEGER NOT NULL DEFAULT 0,
  max_game_pk      INTEGER,
  max_game_pa      INTEGER NOT NULL DEFAULT 0,
  max_game_pitches INTEGER NOT NULL DEFAULT 0,
  max_game_opp_id  INTEGER
);

-- Fouls surrendered BY each pitcher, plus whiffs so the app can show the
-- fouls-to-whiffs ratio the literature flags as the informative pitcher cut
-- (Baumann, FanGraphs 2024). `starts` counts games he was his team's first
-- pitcher (the starter); `is_starter` (majority-of-appearances-were-starts) is
-- derived at export as starts*2 > games — stored as `starts` rather than a
-- non-accumulable boolean so the incremental upsert stays correct.
CREATE TABLE IF NOT EXISTS foul_pitcher_totals (
  person_id  INTEGER PRIMARY KEY,
  season     INTEGER NOT NULL,
  name       TEXT NOT NULL,
  team_id    INTEGER,
  games      INTEGER NOT NULL DEFAULT 0,
  starts     INTEGER NOT NULL DEFAULT 0,
  pitches    INTEGER NOT NULL DEFAULT 0,
  fouls      INTEGER NOT NULL DEFAULT 0,
  whiffs     INTEGER NOT NULL DEFAULT 0
);

-- Fouls BY each team's batters (team-level roll-up for the club foul boards).
CREATE TABLE IF NOT EXISTS foul_team_totals (
  team_id          INTEGER PRIMARY KEY,
  season           INTEGER NOT NULL,
  games            INTEGER NOT NULL DEFAULT 0,
  fouls            INTEGER NOT NULL DEFAULT 0,
  two_strike_fouls INTEGER NOT NULL DEFAULT 0
);

-- League-wide foul distribution by inning (innings 10+ folded into inning 10),
-- split by whether the pitcher on the mound was his team's starter or a
-- reliever — a cut that (per the research notes) isn't published anywhere.
CREATE TABLE IF NOT EXISTS foul_league_innings (
  inning              INTEGER PRIMARY KEY,
  season              INTEGER NOT NULL,
  pitches             INTEGER NOT NULL DEFAULT 0,
  fouls               INTEGER NOT NULL DEFAULT 0,
  pitches_vs_starter  INTEGER NOT NULL DEFAULT 0,
  fouls_vs_starter    INTEGER NOT NULL DEFAULT 0,
  pitches_vs_reliever INTEGER NOT NULL DEFAULT 0,
  fouls_vs_reliever   INTEGER NOT NULL DEFAULT 0
);

-- League-wide foul rate by pitch type (details.type.code / .description).
CREATE TABLE IF NOT EXISTS foul_pitch_types (
  code        TEXT PRIMARY KEY,
  season      INTEGER NOT NULL,
  description TEXT NOT NULL,
  pitches     INTEGER NOT NULL DEFAULT 0,
  fouls       INTEGER NOT NULL DEFAULT 0
);

-- Idempotency guard: which gamePks have already been folded into the totals
-- above (with the game's official date, so coverageSince is min(date)).
CREATE TABLE IF NOT EXISTS foul_ingested_games (
  game_pk INTEGER PRIMARY KEY,
  date    TEXT NOT NULL
);

-- Per-team, per-season COMEBACK WIN counts (gen-comeback-wins.mjs): a win in
-- which the team's win probability dropped below 10 / 20 / 30% at some point in
-- the game. Buckets are NESTED (a sub-10 win also counts sub-20 and sub-30, so
-- sub10 <= sub20 <= sub30). Like postseason_*/foul_*, a Final game's win-prob
-- history is immutable, so these accumulate via an incrementing upsert as each
-- newly-Final MLB game is swept, guarded by comeback_ingested_games so a resumed
-- or re-run sweep never double-counts. `wins` is the team's total ingested wins
-- (context for the buckets); the (team_id, season) key lets seasons coexist.
CREATE TABLE IF NOT EXISTS comeback_win_totals (
  team_id INTEGER NOT NULL,
  season  INTEGER NOT NULL,
  wins    INTEGER NOT NULL DEFAULT 0,
  sub10   INTEGER NOT NULL DEFAULT 0,
  sub20   INTEGER NOT NULL DEFAULT 0,
  sub30   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (team_id, season)
);

-- Idempotency guard for comeback_win_totals: which gamePks are already folded in.
CREATE TABLE IF NOT EXISTS comeback_ingested_games (
  game_pk INTEGER PRIMARY KEY,
  season  INTEGER NOT NULL
);

CREATE VIEW IF NOT EXISTS season_grade AS
SELECT
  q.season, q.team_id, q.date,
  q.payload_json AS quality_json,
  (
    SELECT s.payload_json FROM team_snapshots s
    WHERE s.season = q.season AND s.team_id = q.team_id
      AND s.metric = 'surprise' AND s.date <= q.date
    ORDER BY s.date DESC LIMIT 1
  ) AS surprise_json
FROM team_snapshots q
WHERE q.metric = 'quality';
