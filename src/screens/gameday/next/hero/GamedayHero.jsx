import { createElement } from 'react'
import '../../../../styles/gameday-next/hero.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { eventCardMarkup } from '../steps/eventCardMarkup.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { heroMarkup } from './heroMarkup.js'

// Gameday's hero (markup and rules: heroMarkup.js), and the stage's event card that shares its box.
export const GamedayHero = (props) => heroMarkup(createElement, { SealBox, PlayerLink, ...props })
export const GamedayEventCard = (props) => eventCardMarkup(createElement, { SealBox, ...props })
