// Indexes and presentation flags only; no play values or scoring frontier.
export const emptyCheckpointGate = () => ({ key: null, eligible: false, dismissed: false })
export function recordCheckpoint(gate, key, eligible) {
  return gate.key === key && gate.eligible === eligible ? gate : { key, eligible, dismissed: false }
}
export function dismissCheckpoint(gate) { return { ...gate, dismissed: true } }
export function checkpointPhase(covered, key, gate, armed = false) {
  if (!covered) return 'stage'
  if (armed) return 'pending'
  if (key == null) return 'checkpoint'
  if (gate.key !== key) return 'pending'
  return gate.eligible && !gate.dismissed ? 'celebration' : 'checkpoint'
}
