// Month names, spelled once. en-US on purpose: the app is English-only, so one locale
// everywhere. A bad index gives '' (an array lookup used to give undefined; Intl would throw
// on NaN or wrap 12 round to January).
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
const valid = (i) => Number.isInteger(i) && i >= 0 && i < 12

// "Jan".."Dec" from a 0-based month index.
export const monthAbbr = (i) => (valid(i) ? SHORT.format(Date.UTC(2000, i, 1)) : '')

// "January".."December" from a 0-based month index.
export const monthName = (i) => (valid(i) ? LONG.format(Date.UTC(2000, i, 1)) : '')
