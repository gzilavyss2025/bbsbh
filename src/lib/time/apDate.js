// A date the way AP style and the wire's cutlines write it: "April 4",
// "Aug. 3". Its own module so the transactions list's first load can read it
// without pulling in the notes' templates, which load with the notes.
const AP_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
export function apDate(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${AP_MONTHS[m - 1]} ${d}`
}
