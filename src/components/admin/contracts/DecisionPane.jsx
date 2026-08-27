// The decision pane of the contract identity workbench — region 3, the one
// that changes shape. A single layout with a filter on top of it would ask the
// same question three ways, so this routes on what the selected group actually
// holds: an assignment to confirm, a shortlist to choose from, or nothing at
// all. Each mode gets its own primary action and its own furniture.
//
// Every action is composed here as ONE patch naming the rows it touches and
// handed up to the page, which owns the request and the server-truth overrides
// map. The pane never merges an override locally.
import { useEffect, useMemo, useState } from 'react'
import { teamAbbr } from '../../../lib/teams.js'
import {
  MODE_CHOOSE,
  MODE_COLD,
  MODE_CONFIRM,
  candidatePatch,
  confirmPatch,
  dismissPatch,
  undoPatch,
} from '../../../lib/admin/contractGroups.js'
import { CandidateList } from './CandidateList.jsx'
import { RosterSearch, useSeasonPool } from './RosterSearch.jsx'

const SOURCE_LABEL = {
  extensions: 'Extension',
  arbitration: 'Arbitration',
  free_agency: 'Free agency',
  salaries: 'Salary',
}

// A pool per season is one small static file, but a conflict group can span a
// decade. Read enough to name the ids in front of the reviewer and stop.
const MAX_POOLS = 8

function seasonOf(row) {
  return row?.matchedSeason ?? row?.season ?? null
}

function score(row) {
  const n = Number(row?.matchScore)
  return Number.isFinite(n) ? n.toFixed(3) : '—'
}

function RowMeta({ row }) {
  const team = row.rawTeamCode ? teamAbbr({ id: row.rawTeamCode }) : '—'
  return (
    <span className="cwb__rowmeta caps-exempt">
      {row.season} · club {team} · matched against {seasonOf(row)} · {row.matchedVia} · score{' '}
      {score(row)}
    </span>
  )
}

export function DecisionPane({ group, overrides, saving, onSave }) {
  const groupKey = group?.key ?? null
  // The typed id is scoped to the group it was typed for. Carried in state
  // ALONGSIDE its group rather than cleared by an effect, so switching groups
  // can never render one group's pane holding another group's number.
  const [manual, setManual] = useState({ key: groupKey, value: '' })
  const manualId = manual.key === groupKey ? manual.value : ''
  const { cache, load } = useSeasonPool()

  const seasons = useMemo(() => {
    const out = []
    for (const row of group?.rows ?? []) {
      const s = seasonOf(row)
      if (s != null && !out.includes(s)) out.push(s)
    }
    return out.slice(0, MAX_POOLS)
  }, [group])

  useEffect(() => {
    for (const s of seasons) if (!cache[s]) load(s)
  }, [seasons, cache, load])

  if (!group) {
    return (
      <section className="cwb__pane">
        <p className="cwb__hint caps-exempt">
          Nothing selected. Pick a name on the left, or press the down arrow.
        </p>
      </section>
    )
  }

  const bulk = group.bulk
  const rows = group.rows
  const target = rows.find((row) => !overrides[row.rowKey]) ?? rows[0]
  const resolvedCount = rows.filter((row) => overrides[row.rowKey]).length
  const scope = group.count === 1 ? 'this row' : `all ${group.count}`

  const nameFor = (id, season) => (cache[season] ?? []).find((p) => p.id === id) ?? null

  const save = (patch) => onSave(patch)

  return (
    <section className="cwb__pane">
      <header className="cwb__panehead">
        <p className="cwb__panemeta caps-exempt">
          <span className="cwb__badge">{SOURCE_LABEL[group.sourceFile] ?? group.sourceFile}</span>
          <span className={`cwb__badge cwb__badge--${group.confidence}`}>{group.confidence}</span>
          <span>
            {group.count} {group.count === 1 ? 'row' : 'rows'}
            {group.firstSeason != null &&
              ` · ${group.firstSeason}${group.lastSeason !== group.firstSeason ? `–${group.lastSeason}` : ''}`}
          </span>
          <span>{resolvedCount} reviewed</span>
        </p>
        <h2 className="cwb__panetitle caps-exempt">{group.rawName}</h2>
      </header>

      {group.mode === MODE_CONFIRM && (
        <div className="cwb__block">
          {bulk.offered ? (
            <>
              <p className="cwb__blocklede caps-exempt">
                The matcher already picked somebody for every row here. Confirm it, or replace it.
              </p>
              {(() => {
                // Bulk is only offered when the rows agree, so there is exactly
                // one id here and it is the whole group's.
                const id = group.mlbIds[0]
                const season = seasonOf(target)
                const person = id == null ? null : nameFor(id, season)
                return (
                  <div className="cwb__assigned">
                    <p className="cwb__assignedname caps-exempt">
                      {person ? person.lastFirstName : `id ${id}`}
                    </p>
                    <p className="cwb__hint caps-exempt">
                      {person
                        ? `${person.position ?? '—'} · id ${id} · from the ${season} pool`
                        : cache[season]
                          ? `id ${id} is not in the ${season} pool — the matcher reached it by cross-reference, so nothing here can name it. Check it by hand before you confirm.`
                          : `Reading the ${season} pool…`}
                    </p>
                  </div>
                )
              })()}
              <button
                type="button"
                className="cwb__primary"
                disabled={saving}
                onClick={() => save(confirmPatch(rows))}
              >
                Confirm {scope} — promote to exact
              </button>
            </>
          ) : (
            <p className="cwb__warn caps-exempt">
              These rows do not agree. The matcher sent them to {bulk.conflictIds.length} different
              people — ids {bulk.conflictIds.join(', ')}. That is real information, so there is no
              bulk confirm here. Work the rows one at a time below.
            </p>
          )}
        </div>
      )}

      {group.mode === MODE_CHOOSE && (
        <div className="cwb__block">
          <p className="cwb__blocklede caps-exempt">
            Every candidate any of these {group.count} rows offered, best score first. A shortlist
            that differs row to row is expected — each row was matched against its own season.
          </p>
          <CandidateList
            rawName={group.rawName}
            candidates={bulk.candidates}
            disabled={saving}
            showRowShare
            onPick={(id) => save(candidatePatch(rows, id))}
          />
        </div>
      )}

      {group.mode === MODE_COLD && (
        <div className="cwb__block">
          <p className="cwb__blocklede caps-exempt">
            Nothing to rank. The pipeline had no pool to match against, so the only ways forward are
            the season roster, an id you know, or saying no match exists.
          </p>
        </div>
      )}

      <div className="cwb__block">
        <RosterSearch
          season={seasonOf(target)}
          cache={cache}
          load={load}
          disabled={saving}
          onPick={(id) => save(candidatePatch(rows, id))}
        />
        <p className="cwb__manual caps-exempt">
          Or an MLB id directly:{' '}
          <input
            type="number"
            min="1"
            className="cwb__field cwb__field--id"
            value={manualId}
            onChange={(e) => setManual({ key: groupKey, value: e.target.value })}
            aria-label="MLB id"
          />{' '}
          <button
            type="button"
            className="cwb__mini"
            disabled={saving || !manualId}
            onClick={() => save(candidatePatch(rows, Number(manualId)))}
          >
            Apply to {scope}
          </button>
        </p>
        <button
          type="button"
          className="cwb__danger"
          disabled={saving}
          onClick={() => save(dismissPatch(rows))}
        >
          No match exists — {scope}
        </button>
      </div>

      <ol className="cwb__rows">
        {rows.map((row) => {
          const override = overrides[row.rowKey]
          const own = row.candidates?.[0]
          return (
            <li key={row.rowKey} className={`cwb__row${override ? ' cwb__row--done' : ''}`}>
              <p className="cwb__rowhead caps-exempt">
                <code>{row.rowKey}</code>
                {row === target && <span className="cwb__badge cwb__badge--target">this row</span>}
              </p>
              <RowMeta row={row} />
              {override ? (
                <p className="cwb__rowstate caps-exempt">
                  {override.dismissed ? 'No confident id exists.' : `Set to id ${override.mlbId}.`}{' '}
                  {override.correctedBy ?? 'you'}
                  {override.correctedAt ? `, ${override.correctedAt}` : ''}{' '}
                  <button
                    type="button"
                    className="cwb__mini"
                    disabled={saving}
                    onClick={() => save(undoPatch([row]))}
                  >
                    Undo
                  </button>
                </p>
              ) : (
                <p className="cwb__rowactions">
                  {group.mode === MODE_CONFIRM && row.mlbId != null && (
                    <button
                      type="button"
                      className="cwb__mini"
                      disabled={saving}
                      onClick={() => save(confirmPatch([row]))}
                    >
                      Confirm id {row.mlbId}
                    </button>
                  )}
                  {group.mode === MODE_CHOOSE && own && (
                    <button
                      type="button"
                      className="cwb__mini"
                      disabled={saving}
                      onClick={() => save(candidatePatch([row], own.id))}
                    >
                      Use {own.lastFirstName}
                    </button>
                  )}
                  <button
                    type="button"
                    className="cwb__mini"
                    disabled={saving}
                    onClick={() => save(dismissPatch([row]))}
                  >
                    No match
                  </button>
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
