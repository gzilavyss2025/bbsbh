import { lazy } from 'react'

// React.lazy for a named export: lazyNamed(() => import('./Screen.jsx'), 'Screen').
// scripts/check-dead-exports.mjs reads this exact call shape to see the export is used.
export function lazyNamed(loader, name) {
  return lazy(() => loader().then((module) => ({ default: module[name] })))
}
