import { lazy } from 'react'
import { isLookNew } from './lookFlag.js'

// The lineup pages: the new look behind `?look=new`, else the live page
// (docs/lineup-redesign.md). Both stay lazy, so a game opened to read a lineup never
// downloads the innings viewer or the box score code until a tap goes there.
const TeamInfo = lazy(() => import('../../TeamInfo.jsx').then((m) => ({ default: m.TeamInfo })))
const LineupNextPage = lazy(() => import('./LineupNextPage.jsx').then((m) => ({ default: m.LineupNextPage })))

export function LineupPage(props) {
  const Page = isLookNew() ? LineupNextPage : TeamInfo
  return <Page {...props} />
}
