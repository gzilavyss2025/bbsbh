import "../../../../styles/gameday-next/panels.css";
import "../../../../styles/lineup-next/field.css";
import { useState } from "react";
import { SealBox } from "../../../../components/SealBox.jsx";
import { BallparkDiagram } from "../../../../components/ballpark/BallparkDiagram.jsx";
import { resolveBallparkLayout } from "../../../../lib/ballpark/layout/resolveLayout.js";
import { DEFENSE_SPOTS } from "../../../../lib/ballpark/layout/defenseWindow.js";
import { parkWindow } from "../../../../lib/ballpark/layout/parkWindow.js";
import { revealInning } from "../../../../api/linescore.js";
import { halfIndex, selectLineup } from "../../../../api/select.js";
import { defenseAt } from "../../../../api/gameday/defense.js";
import {
  visibleAtBatCards,
  battingSideOf,
} from "../../../../api/gameday/stepCut.js";

// Gameday's panels (#2568), one per ladder block. `ctx` is the reader's cursor: the half on
// screen, `step` (the entry count PlayByPlay is capped at; null once the half is committed) and
// the reveal mark. Anything that shows a result reads inside a SealBox, up to the cursor
// (ADR-0016): the box is force-revealed only once something of this half is on screen.
// The navigator's run cells stay the only way to reach a half more than one step away (ADR-0043).

const Sealed = () => <p className="gdp__sealed">Sealed</p>;

// Result-bearing panels draw through here; `key` re-seals on every half, as the page does.
function Sealable({ ctx, children }) {
  const { inning, half, step, revealedThrough } = ctx;
  const shown = halfIndex(inning, half) <= revealedThrough || step > 0;
  return (
    <SealBox key={`${inning}-${half}`} forceRevealed={shown} coverless>
      {() =>
        shown ? (
          children(visibleAtBatCards(ctx.feed, inning, half, step))
        ) : (
          <Sealed />
        )
      }
    </SealBox>
  );
}

function Navigator({ ctx }) {
  const {
    feed,
    regulation,
    unlocked,
    revealedThrough,
    runsInProgress,
    curIdx,
    onSelect,
    disabled,
    meta,
  } = ctx;
  const cols = Array.from(
    { length: Math.max(regulation, unlocked) },
    (_, i) => i + 1,
  );
  const cell = (n, half, side) => {
    const idx = halfIndex(n, half);
    if (idx <= revealedThrough) return revealInning(feed, n, side);
    if (idx === runsInProgress?.idx)
      return { runs: runsInProgress.runs, hits: runsInProgress.hits };
    return null;
  };
  const row = (half, side, m) => (
    <tr key={side}>
      <th scope="row">{m.abbreviation}</th>
      {cols.map((n) => {
        const idx = halfIndex(n, half),
          l = n <= unlocked ? cell(n, half, side) : null;
        return (
          <td key={n}>
            <button
              type="button"
              className="gdp__run"
              aria-current={idx === curIdx || undefined}
              aria-disabled={disabled || undefined}
              disabled={n > unlocked}
              aria-label={`${half === "top" ? "Top" : "Bottom"} ${n}${l ? `, ${l.runs} runs` : ", sealed"}`}
              onClick={() => onSelect(idx)}
            >
              {l ? l.runs : "·"}
            </button>
          </td>
        );
      })}
    </tr>
  );
  return (
    <table className="gdp__line" aria-label="Line score">
      <thead>
        <tr>
          <th />
          {cols.map((n) => (
            <th key={n}>{n}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {row("top", "away", meta.away)}
        {row("bottom", "home", meta.home)}
      </tbody>
    </table>
  );
}

const Trail = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {(cards) => (
      <ol className="gdp__trail" aria-label="At-bats this half">
        {cards.slice(-10).map((c) => (
          <li key={c.atBatIndex} className="gdp__chip">
            <b>{c.code || "···"}</b>
            {c.batter?.last ?? c.batter?.fullName}
          </li>
        ))}
        <li className="gdp__chip gdp__chip--cover">
          <b>Sealed</b>
        </li>
      </ol>
    )}
  </Sealable>
);

const Pitches = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {(cards) => {
      const c = cards.at(-1);
      if (!c) return <Sealed />;
      return (
        <div>
          <span className="gdp__label">
            Pitches · {c.batter?.last ?? c.batter?.fullName}
          </span>
          <ol className="gdp__pitches">
            {c.pitchDetails.map((p) => (
              <li key={p.no}>
                <span className="gdp__pip">
                  {p.cat === "inplay" ? "X" : p.no}
                </span>
                <span>{p.type}</span>
                <span className="gdp__num">
                  {p.mph != null ? `${Math.round(p.mph)} mph` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    }}
  </Sealable>
);

// Names are the lineup's (spoiler-free, as on the lineup page); the codes are results.
function BattingOrder({ ctx }) {
  const { feed, half } = ctx;
  const order = selectLineup(feed, battingSideOf(half));
  return (
    <Sealable ctx={ctx}>
      {(cards) => {
        const codes = {};
        for (const c of cards) (codes[c.batter?.id] ||= []).push(c.code);
        return <Rows order={order} codes={codes} />;
      }}
    </Sealable>
  );
}
const Rows = ({ order, codes }) => (
  <ol className="gdp__order">
    {order.map((p) => (
      <li key={p.order}>
        <em>{p.order}</em>
        <span>
          {p.last} <em>{p.position}</em>
        </span>
        <em>{(codes[p.id] ?? []).join(" ")}</em>
      </li>
    ))}
  </ol>
);

// The Field tab: FieldCard's park with surnames at the spots, the defense as of the cursor.
function Field({ ctx }) {
  const { feed, inning, half, step, revealedThrough } = ctx;
  const v = feed?.gameData?.venue;
  const layout = resolveBallparkLayout({
    venueId: v?.id,
    venueName: v?.name,
    gameDate: feed?.gameData?.datetime?.officialDate,
  });
  if (!layout)
    return <p className="gdp__sealed">No park drawing for this venue.</p>;
  const win = parkWindow(layout);
  return (
    <Sealable ctx={ctx}>
      {() => {
        const by =
          defenseAt(feed, { inning, half, step, revealedThrough }) ?? {};
        return (
          <>
            <div
              className="lfld__field"
              style={{ aspectRatio: win.aspectRatio }}
            >
              <BallparkDiagram
                layout={layout}
                viewBox={win.viewBox}
                className="lfld__park"
                label={`${v?.name} with the defense`}
              />
              {Object.entries(DEFENSE_SPOTS).map(([pos, xy]) => {
                const { left, top } = win.percent(xy);
                return (
                  <span
                    key={pos}
                    className="lfld__node"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    role="group"
                    aria-label={pos}
                  >
                    <span
                      className={`lfld__name${by[pos] ? "" : " lfld__name--tbd"}`}
                    >
                      {by[pos]?.last ?? "—"}
                    </span>
                  </span>
                );
              })}
            </div>
            {by.DH && (
              <p className="lfld__dh">
                <span>DH</span>
                {by.DH.last}
              </p>
            )}
          </>
        );
      }}
    </Sealable>
  );
}

// ponytail: Field is the one tab built (round 2's Arms and Extras tabs are later prompts).
const Reference = ({ ctx }) => {
  const [tab, setTab] = useState("field");
  return (
    <div className="gdp__ref">
      <div className="gdp__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "field"}
          onClick={() => setTab("field")}
        >
          Field
        </button>
      </div>
      <Field ctx={ctx} />
    </div>
  );
};

const EventLog = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {(cards) => (
      <div className="gdp__log">
        <span className="gdp__label">This half</span>
        {cards.map((c) => (
          <p key={c.atBatIndex}>
            <b>{c.batter?.last}</b>{" "}
            {c.descSegments?.map((s) => s.text ?? s).join("")}
          </p>
        ))}
      </div>
    )}
  </Sealable>
);

const PANELS = {
  navigator: Navigator,
  trail: Trail,
  pitches: Pitches,
  battingOrder: BattingOrder,
  reference: Reference,
  eventLog: EventLog,
};

// The panel for a ladder block, or null for the blocks other prompts build.
export function GamedayPanel({ block, ctx }) {
  const P = PANELS[block];
  return P && ctx ? <P ctx={ctx} /> : null;
}
