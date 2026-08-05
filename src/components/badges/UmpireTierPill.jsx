// Thin alias — see TierPill.jsx (the shared, non-umpire-specific component)
// for the implementation. Kept as its own file/name since "umpire" is what
// every call site here means; TierPill.jsx is the one to extend for tiers.
export { TierPill as UmpireTierPill } from './TierPill.jsx'
