# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ----------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Kind labels

Every new issue also gets a **kind** label, so Gary can pick work by type. Apply it
with the triage label, at filing time.

| Label    | Use when the work is mostly…                                                  |
| -------- | ----------------------------------------------------------------------------- |
| `data`   | feeds, `src/api/`, stores, generators, crons, stats logic, field paths         |
| `design` | layout, CSS, tokens, copy, visual or interaction changes to a screen           |

If an issue needs real work on both sides (a new store or field *and* a new screen or wireframe), give it both labels. Tooling, CI, and docs work gets
neither label.
