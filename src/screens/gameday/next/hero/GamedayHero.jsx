import { createElement } from 'react'
import '../../../../styles/gameday-next/hero.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { heroMarkup } from './heroMarkup.js'

// Gameday's hero (markup and rules: heroMarkup.js).
export const GamedayHero = (props) => heroMarkup(createElement, { SealBox, ...props })
