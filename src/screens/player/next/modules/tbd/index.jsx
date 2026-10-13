import { useCallback, useEffect, useState } from 'react'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { CARDS } from './Cards.jsx'
import { tbdCards } from './tbdView.js'
import '../../../../../styles/player-next/both/tbd.css'

// The tbd module's slots (the contract is in ../../CLAUDE.md, #1896): Season, Career and
// History each draw today's cards for their section, unchanged. Each card loads its own data
// and hides alone; when all of a slot's cards have, the slot reports empty. Career has no
// card left (Prospect rankings is #1927), so it renders nothing on its first render.
export default function TbdModule({ bio, role, asOf, season, section, onEmpty }) {
  const keys = tbdCards(section, role, bio)
  const [gone, setGone] = useState({})
  const hide = useCallback((k) => setGone((g) => (g[k] ? g : { ...g, [k]: true })), [])
  const allGone = keys.length > 0 && keys.every((k) => gone[k])
  useEffect(() => {
    if (allGone) onEmpty()
  }, [allGone, onEmpty])
  if (!keys.length) return null
  const p = { bio, role, asOf, season, hide }
  return (
    <Stack gap="section" className="tbd">
      {keys.map((k) => {
        const Card = CARDS[k]
        return <Card key={k} p={p} />
      })}
    </Stack>
  )
}
