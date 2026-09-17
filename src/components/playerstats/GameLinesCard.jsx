import { useState } from "react";
import { BoxLinesDoor } from "../boxlines/BoxLinesDoor.jsx";
import { SectionTitle } from "../ui/SectionTitle.jsx";
import {
  cardFacetsFor,
  FAMILIES,
  FOLD_FROM,
  SECTIONS,
} from "../../api/boxlines/cardFacets.js";
import {
  DOOR_COLUMNS,
  DOOR_EMPHASIS,
  doorCells,
  doorLine,
  fetchDoorLabels,
} from "../../api/boxlines/careerSplits.js";
import { useAsync } from "../../hooks/useAsync.js";
import "../../styles/boxlines/gamelines.css";

// GAME LINES — the player page's ledger of doors (ADR-0069, issue #997). Each
// row is a career line under one FACET — at home, at night, in July, on a
// Sunday, off the bench — and opens the game-by-game rows that add up to it.
// The card exists so each facet issue is one entry in a registry rather than a
// card and a data path of its own. Twenty-odd of them are lit: Home and Road
// (#1004, #1005), Day and Night (#1000), a pitcher's Started and In relief
// (#1003's pitcher half), the Postseason (#1006), the eight months (#999), the
// seven weekdays (#1001) and a hitter's Pinch hitting (#1002).
//
// THE DOORS ARE A REGISTRY, and it lives in api/boxlines/cardFacets.js — pure
// data, so the suite can check every entry against the same facetPlan the
// sheet uses. Add a door there, not here. This file only draws them.
//
// IT DRAWS THEM AS A TABLE, four sections deep, and the table is the whole of
// this card's design (ADR-0073). Every door prints the SAME five figures, so
// they are named once at the head of each section and each door is five cells
// under them — where the card used to spend a whole sentence per door saying
// "855 G, 3616 PA, .281, 119 HR, .837 OPS" and leave a reader to compare two
// sentences. Nothing lined up, almost every line wrapped, and "See all" was
// said on all twenty-five rows. Down a column, Home reads against Road at a
// glance, which is what a split is for.
//
// The sections come from SECTIONS rather than from the registry's own order,
// so a door added in the wrong place files itself correctly instead of quietly
// reordering the card. A heading with no door under it does not render, so a
// pitcher's card has no "How he got in" until he has both a start and a relief
// outing, and a MiLB player still has no card at all.
//
// A FAMILY FOLDS. Fifteen of a hitter's twenty-five doors are two runs that
// differ in one number — the eight months, the seven weekdays — and folded
// behind a row apiece the card opens at ten lines a reader can take in at once
// instead of a wall. FOLD_FROM keeps a short run loose: a call-up with two
// months played is shown his two months, not a fold over them.
//
// AND TWO KINDS OF FIGURE. Most doors fill all five cells; a hitter's Started
// and Substitution fill only the first, because the source that knows how often
// he was on the card is a FIELDING career and it carries no batting average.
// `doorCells` returns null for the four it cannot answer and the row draws a
// quiet mark, so the column still lines up under its name.
//
// SPOILER FOOTING. The labels are CAREER aggregates, open on this page the way
// the Splits vs team card's are (ADR-0034 — a stat line is not a score). The
// rows behind each door carry final scores and are gated in
// api/boxlines/rows.js, which is handed the page's `?d=` as its cutoff. This
// component holds no date logic; it passes `asOf` through.
//
// "Box Lines" is the internal name for this drilldown and never renders: the
// card is titled "Game lines", and the promise every door used to repeat is
// made once, under that title.

export function GameLinesCard({ personId, playerSurname, group, asOf }) {
  const rows = cardFacetsFor(group);
  // ONE request for every situation door's label, whatever the count, plus one
  // per door whose line is a career under a game type (careerSplits.js). A
  // group with no doors asks nothing.
  const key = rows.map((r) => r.key).join(",");
  const { data } = useAsync(
    () =>
      personId && key
        ? fetchDoorLabels(personId, group, rows)
        : Promise.resolve(null),
    // key IS rows, by value — the array would be a new identity every render.
    [personId, group, key],
  );
  // Which families the reader has opened. Keyed by family, so the months and
  // the weekdays open independently and a two-way player's two cards do not
  // share a bit (each block renders its own GameLinesCard).
  const [open, setOpen] = useState({});
  if (!rows.length || !data) return null;

  // A door with no games behind it does not exist: a hitter who never reached
  // October has no Postseason door, a March call-up no March door, and a MiLB
  // player no doors at all.
  //
  // A LIST DOOR IS THE EXCEPTION, and it has to be (#1048): it names no label
  // source, so there is no figure here to test, and the only way to know
  // whether it has groups behind it would be to make the fetch it exists to
  // defer. It renders whenever the card does — but it cannot vouch for the card
  // on its own, or a MiLB player with no situational splits at all would get a
  // card holding one door.
  const doors = rows
    .map((r) => ({ row: r, stat: data.get(r.key) }))
    .filter(({ row, stat }) => row.list || (stat && Number(stat.gamesPlayed) > 0));
  if (!doors.some(({ row }) => !row.list)) return null;

  const columns = DOOR_COLUMNS[group] ?? DOOR_COLUMNS.hitting;
  const emphasis = DOOR_EMPHASIS[group] ?? DOOR_EMPHASIS.hitting;

  const sheetFor = (row) => ({
    personId,
    playerSurname,
    group,
    facet: row.facet ?? null,
    list: row.list ?? null,
    kicker: row.kicker,
    title: row.title(playerSurname),
    footNote: row.footNote ?? null,
    cutoff: asOf ?? null,
  });

  // One door as a row of the table. `label` is still the whole career as a
  // sentence — the sheet's headline and the button's accessible name — while
  // the face is that same sentence in the columns above it.
  const door = (row, stat, sub) =>
    row.list ? (
      // A LIST DOOR has no five figures to print — its groups do, and they are
      // folded from the rows behind it. So its name takes the whole row and the
      // chevron keeps its track: the reader is promised a list, not a line.
      <li className="gamelines__row" key={row.key}>
        <BoxLinesDoor
          className="gamelines__door gamelines__door--list"
          label={row.label}
          headline={null}
          face={
            <>
              <span className="gamelines__name">{row.label}</span>
              <span className="gamelines__chev" aria-hidden="true">
                ›
              </span>
            </>
          }
          sheet={sheetFor(row)}
        />
      </li>
    ) : (
    <li className="gamelines__row" key={row.key}>
      <BoxLinesDoor
        className="gamelines__door"
        label={`${row.label}: ${doorLine(row, stat, group)}`}
        face={
          <>
            <span
              className={`gamelines__name${sub ? " gamelines__name--sub" : ""}`}
            >
              {row.label}
            </span>
            {(doorCells(row, stat, group) ?? []).map((cell, i) => (
              <span
                key={columns[i]}
                className={`gamelines__fig${cell == null ? " gamelines__fig--nil" : emphasis[i] ? ` gamelines__fig--${emphasis[i]}` : ""}`}
              >
                {cell ?? "·"}
              </span>
            ))}
            <span className="gamelines__chev" aria-hidden="true">
              ›
            </span>
          </>
        }
        sheet={sheetFor(row)}
      />
    </li>
  );

  return (
    <div className={`gamelines gamelines--${group}`}>
      <SectionTitle title="Game lines" note="career" />
      {/* The promise each door used to repeat twenty-five times. */}
      <p className="gamelines__hint">Tap a line for the games behind it</p>
      {/* A wrapper so the four panels can pair up past the wide breakpoint;
          on a phone it is a plain block and costs nothing. */}
      <div className="gamelines__panels">
        {SECTIONS.map((section) => {
          const mine = doors.filter(({ row }) => row.section === section.key);
          if (!mine.length) return null;
          // A family long enough to be worth folding; anything shorter stands
          // loose with the section's own doors, in the registry's order.
          const folded = FAMILIES.map((fam) => ({
            fam,
            members: mine.filter(({ row }) => row.family === fam.key),
          })).filter(({ members }) => members.length >= FOLD_FROM);
          const foldedKeys = new Set(folded.map(({ fam }) => fam.key));
          const loose = mine.filter(
            ({ row }) => !row.family || !foldedKeys.has(row.family),
          );
          return (
            <div className="gamelines__section" key={section.key}>
              <ul className="gamelines__rows">
                <li className="gamelines__head">
                  <h4 className="gamelines__heading">{section.title}</h4>
                  {columns.map((name) => (
                    <span className="gamelines__col" key={name}>
                      {name}
                    </span>
                  ))}
                  <span />
                </li>
                {loose.map(({ row, stat }) => door(row, stat, false))}
                {folded.map(({ fam, members }) => (
                  <Family
                    key={fam.key}
                    family={fam}
                    count={members.length}
                    open={!!open[fam.key]}
                    onToggle={() =>
                      setOpen((was) => ({ ...was, [fam.key]: !was[fam.key] }))
                    }
                  >
                    {members.map(({ row, stat }) => door(row, stat, true))}
                  </Family>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A FOLD over one run of doors. Closed it is a single row naming the run and
// counting it; open it is those doors as ordinary rows of the same table,
// indented so a reader can see where the run starts and stops. A real
// <button> with `aria-expanded`, so the fold is a control and not a div that
// happens to listen — the doors inside it are buttons too and the keyboard has
// to reach both.
function Family({ family, count, open, onToggle, children }) {
  return (
    <>
      <li className="gamelines__famrow">
        <button
          type="button"
          className="gamelines__fam"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="gamelines__famname">
            <span
              className={`gamelines__famchev${open ? " gamelines__famchev--open" : ""}`}
              aria-hidden="true"
            >
              ›
            </span>
            {family.title}
          </span>
          <span className="gamelines__famcount">
            {open ? "Hide" : `${count} splits`}
          </span>
        </button>
      </li>
      {open && children}
    </>
  );
}
