// Cot's and Fever both get named on every surface that renders their contract
// data. This is not a footnote to trim on a narrow screen — it is the term the
// data is used under (reuse permission confirmed with Fever Baseball on
// 2026-08-18; see scripts/fever/gen-player-contracts.mjs), so the component
// renders nothing at all rather than a partial credit when the meta is missing.
export function SourceLine({ meta, note = null }) {
  if (!meta?.source) return null
  return (
    <p className="paysource">
      {note ? `${note} ` : ''}
      Contract data from{' '}
      <a href={meta.sourceUrl} target="_blank" rel="noreferrer noopener">
        {meta.source}
      </a>
      , joined to MLBAM player ids by{' '}
      <a href={meta.attributionUrl} target="_blank" rel="noreferrer noopener">
        {meta.attribution}
      </a>
      {meta.cotsAsOf ? `, as of ${meta.cotsAsOf}` : ''}.
    </p>
  )
}
