// Is UI state still held for this list? True only while it was taken from `list`, compared
// by identity like a memo's deps, so a new list (new data, a new season) starts clean
// instead of carrying a pick into rows it was never made for.
export const heldFor = (held, list) => held.list === list
