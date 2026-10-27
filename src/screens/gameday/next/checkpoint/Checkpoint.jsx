import { createElement, useState } from 'react'
import '../../../../styles/gameday-next/checkpoint.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { checkpointMarkup } from './checkpointMarkup.js'

// Gameday's checkpoint in the stage's slot (markup and rules: checkpointMarkup.js). The phone's page
// is the one state here; the mount keys this on the half, so a new half opens on the tally.
export function Checkpoint(props) {
  const [page, setPage] = useState(null)
  return checkpointMarkup(createElement, { SealBox, ...props, page, onPage: setPage })
}
