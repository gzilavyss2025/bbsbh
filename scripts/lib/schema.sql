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

-- Available for future generation-time features that want a Quality+Surprise
-- pair without hand-rolling the lookup. Deliberately NOT wired in to replace
-- src/api/teamScore.js's leagueSeasonGradesFor: that function computes the
-- grade at a dynamic, PER-PAGE spoiler-safe cutoff (whichever game a reader
-- is viewing), and seasonGradeFormula.js's seasonGradeFromScores also runs
-- live for the Team Page's interactive "how this is calculated" explainer —
-- both need the raw dated snapshots and the pure formula in the browser, so
-- a build-time-precomputed grade would either miss historical cutoffs or
-- break the explainer. See docs/adr/0021.
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
