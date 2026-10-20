// Which scouting cards had a load fail (#2316). Pure. A failed load is not an empty one:
// an empty season drops its card quietly, a failed read gets one plain line.
//
// Input: [{ label, error?, failed? }]. `error` is a useAsync error; `failed` marks a
// static file that fell back. -> the labels, in input order, once each.
export function failedCards(results) {
  const labels = results.filter((r) => r.error || r.failed).map((r) => r.label)
  return [...new Set(labels)]
}

// '' when nothing failed, so the caller draws nothing.
export function failedLine(labels) {
  return labels.length ? `Some cards could not load: ${labels.join(', ')}.` : ''
}
