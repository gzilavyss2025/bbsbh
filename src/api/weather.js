// Scorebook weather string generator.
//
// The user hand-writes a compact ~4–6 word weather note per game — before the
// game from a forecast, after it from the actual first-pitch conditions. Two
// hard requirements shape this module:
//
//   1. Roof state (open/closed) for retractable-roof and domed parks.
//   2. OUTDOOR conditions regardless of roof state. For a closed roof the MLB
//      box score reports the climate-controlled *interior* (Chase Field's flat
//      72°/calm), which is exactly what the scorekeeper does NOT want. So the
//      actual sky/temp/wind come from a weather service keyed to the park's
//      lat/lon — never the box-score weather field. The box score is used only
//      to help confirm roof state, and even that is cross-checked.
//
// Data sources, all queried straight from the browser (no backend, matching the
// rest of the app): MLB Stats API for coordinates + roofType, and Open-Meteo
// (free, key-less, CORS-enabled) for the outdoor reading at first pitch.

import { fetchVenue } from './mlb.js'
import {
  parkCfBearing,
  windRelativeToField,
  compassFrom,
} from '../lib/ballparks.js'

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const HOURLY_VARS =
  'temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,is_day'

// ---------------------------------------------------------------------------
// Sky words — WMO weather_code → the single tight word a scorebook wants.
// ---------------------------------------------------------------------------

// One compact sky/precip word per WMO code (day-clear reads "sunny", night-clear
// "clear"). Kept to a single token so it never eats the word budget.
function skyWord(code, isDay) {
  if (code == null) return ''
  if (code <= 1) return isDay ? 'sunny' : 'clear' // 0 clear, 1 mainly clear
  if (code === 2) return 'pt cloudy'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'showers'
  if (code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storms' // 95 thunderstorm, 96/99 with hail
  return ''
}

// ---------------------------------------------------------------------------
// Roof state
// ---------------------------------------------------------------------------

// Resolve roof state to 'open' | 'closed' | 'unknown' | null.
//   • null      → open-air park, no roof to report (no clause at all).
//   • 'unknown' → a retractable park whose state we couldn't confirm.
// A fixed dome is always closed. For a retractable we trust an explicit override
// first, then the box-score condition string as the cross-check ("Roof Closed" /
// "Dome" / "Roof Open"); absent any signal it stays 'unknown' rather than guess.
export function resolveRoofState({ roofType, boxCondition, override } = {}) {
  if (override === 'open' || override === 'closed') return override

  const rt = (roofType ?? '').toLowerCase()
  const cond = (boxCondition ?? '').toLowerCase()

  if (rt === 'dome' || rt === 'indoor' || rt === 'fixed') return 'closed'

  if (/roof closed|dome|indoor/.test(cond)) return 'closed'
  if (/roof open/.test(cond)) return 'open'

  return rt === 'retractable' ? 'unknown' : null
}

// ---------------------------------------------------------------------------
// The compact string
// ---------------------------------------------------------------------------

const CALM_MPH = 4 // below this, wind is "calm" and direction is dropped

// The wind fragment: "calm", a field-relative "wind 12 out to CF" when the park
// orientation is known, or a plain compass "wind 8 SW" otherwise.
function windFragment(windMph, fromDeg, cfBearing) {
  const spd = Math.round(windMph ?? 0)
  if (!Number.isFinite(spd) || spd < CALM_MPH) return 'calm'
  if (fromDeg == null) return `wind ${spd}`
  const dir =
    cfBearing != null
      ? windRelativeToField(fromDeg, cfBearing)
      : compassFrom(fromDeg)
  return `wind ${spd} ${dir}`
}

// Assemble the final handwriting string from a normalized outdoor reading. Keeps
// it tight (~4–6 words) and drops the lowest-priority field rather than overflow:
// temperature and sky always survive; roof state outranks wind on a roofed park
// (it's a hard requirement); on an open-air park wind wins the remaining room.
//
// reading: { tempF, code, isDay, windMph, windFromDeg }
// opts:    { roofState, cfBearing }
export function formatScorebookWeather(reading, { roofState, cfBearing } = {}) {
  if (!reading || reading.tempF == null) return ''

  const temp = `${Math.round(reading.tempF)}°F`
  const sky = skyWord(reading.code, reading.isDay)
  const wind = windFragment(reading.windMph, reading.windFromDeg, cfBearing)

  // Closed roof: lead with the roof, then the OUTDOOR reading tagged "outside"
  // so it's unmistakably not the box score's interior number. Wind is irrelevant
  // to play under a closed roof, so it's dropped to stay tight.
  if (roofState === 'closed') {
    return `Roof closed, ${[temp, sky].filter(Boolean).join(' ')} outside`
  }

  const parts = [sky ? `${temp} ${sky}` : temp, wind]
  let out = parts.filter(Boolean).join(', ')

  // Open roof: append the state (a hard requirement for roofed parks). If that
  // pushes past ~6 words, drop the wind fragment to make room — roof outranks it.
  if (roofState === 'open') {
    const withRoof = `${out}, roof open`
    out =
      wordCount(withRoof) > 6
        ? `${[sky ? `${temp} ${sky}` : temp].join(', ')}, roof open`
        : withRoof
  }

  return out
}

function wordCount(s) {
  return s.trim().split(/\s+/).length
}

// ---------------------------------------------------------------------------
// Open-Meteo fetch
// ---------------------------------------------------------------------------

// Two-digit zero-pad.
function pad(n) {
  return String(n).padStart(2, '0')
}

// The UTC hour key ("YYYY-MM-DDTHH:00") Open-Meteo uses for hourly rows when
// timezone=GMT. We round first pitch to the nearest hour to pick its row.
function utcHourKey(date) {
  const d = new Date(date.getTime())
  if (d.getUTCMinutes() >= 30) d.setUTCHours(d.getUTCHours() + 1)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )}T${pad(d.getUTCHours())}:00`
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  return res.json()
}

// Fetch the outdoor reading for a park at a given time. `whenISO` is first pitch
// (UTC ISO); omit it for a live "right now" reading. Returns the normalized
// shape formatScorebookWeather expects, or null if the service can't answer.
//
// The forecast endpoint spans roughly 90 days back through 16 days ahead, which
// covers every realistic before/after-game lookup; only long-past games fall
// through to the archive endpoint. Times are requested in GMT so the first-pitch
// UTC timestamp maps straight onto an hourly row.
export async function fetchOutdoorWeather({ lat, lon, whenISO } = {}) {
  if (lat == null || lon == null) return null

  const when = whenISO ? new Date(whenISO) : new Date()
  if (Number.isNaN(when.getTime())) return null

  const now = new Date()
  const dayMs = 86_400_000
  const daysAgo = Math.floor((now - when) / dayMs)

  const base = {
    latitude: String(lat),
    longitude: String(lon),
    hourly: HOURLY_VARS,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'GMT',
  }

  let url
  if (daysAgo > 90) {
    // Older than the forecast window — use the historical archive for that date.
    const day = when.toISOString().slice(0, 10)
    url = `${OPEN_METEO_ARCHIVE}?${new URLSearchParams({
      ...base,
      start_date: day,
      end_date: day,
    })}`
  } else {
    url = `${OPEN_METEO}?${new URLSearchParams({
      ...base,
      current: HOURLY_VARS,
      past_days: String(Math.min(92, Math.max(0, daysAgo + 1))),
      forecast_days: String(
        Math.min(16, Math.max(1, Math.ceil((when - now) / dayMs) + 2)),
      ),
    })}`
  }

  let data
  try {
    data = await getJson(url)
  } catch {
    return null
  }

  return pickReading(data, whenISO ? when : null)
}

// Pull one normalized reading out of an Open-Meteo response: the hourly row for
// first pitch when we have a time (falling back to `current` if that hour isn't
// in the payload), or `current` for a live reading.
function pickReading(data, when) {
  const hourly = data?.hourly
  const times = hourly?.time ?? []

  if (when && times.length) {
    const i = times.indexOf(utcHourKey(when))
    if (i !== -1) {
      return {
        tempF: hourly.temperature_2m?.[i],
        code: hourly.weather_code?.[i],
        cloudCover: hourly.cloud_cover?.[i],
        windMph: hourly.wind_speed_10m?.[i],
        windFromDeg: hourly.wind_direction_10m?.[i],
        precip: hourly.precipitation?.[i],
        isDay: hourly.is_day?.[i] === 1,
      }
    }
  }

  const c = data?.current
  if (!c) return null
  return {
    tempF: c.temperature_2m,
    code: c.weather_code,
    cloudCover: c.cloud_cover,
    windMph: c.wind_speed_10m,
    windFromDeg: c.wind_direction_10m,
    precip: c.precipitation,
    isDay: c.is_day === 1,
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

// Read the bits of the live feed the generator needs. Coordinates and roofType
// come embedded in gameData.venue on full feeds; when they're absent we signal
// the caller to hydrate them from the venue endpoint. First pitch prefers the
// actual/among game datetime; boxCondition is the box score's own weather label,
// used only to cross-check roof state.
function readFeedInputs(feed) {
  const v = feed?.gameData?.venue ?? {}
  const coords = v.location?.defaultCoordinates ?? {}
  const dt = feed?.gameData?.datetime ?? {}
  return {
    venueId: v.id ?? null,
    venueName: v.name ?? '',
    lat: coords.latitude ?? null,
    lon: coords.longitude ?? null,
    roofType: v.fieldInfo?.roofType ?? null,
    whenISO: dt.dateTime ?? dt.originalDate ?? null,
    boxCondition: feed?.gameData?.weather?.condition ?? '',
  }
}

// Generate the scorebook weather string for a game. Fetches the outdoor reading
// (and, if the feed lacked them, the park's coordinates + roofType) and formats
// the compact line. Returns { text, reading, roofState, cfBearing, venueName },
// or { text: '' } when the outdoor reading can't be had (MiLB parks with no
// coordinates, a weather-service outage) — the UI then shows a graceful dash.
//
// `override.roofState` ('open'|'closed') lets the user correct roof state when
// they can see the park and the box score is wrong or silent.
export async function generateScorebookWeather(feed, override = {}) {
  let { venueId, venueName, lat, lon, roofType, whenISO, boxCondition } =
    readFeedInputs(feed)

  // Fall back to the dedicated venue endpoint when the feed didn't embed
  // coordinates or roof type.
  if (lat == null || lon == null || roofType == null) {
    const venue = await fetchVenue(venueId)
    if (venue) {
      const c = venue.location?.defaultCoordinates ?? {}
      lat = lat ?? c.latitude ?? null
      lon = lon ?? c.longitude ?? null
      roofType = roofType ?? venue.fieldInfo?.roofType ?? null
      venueName = venueName || venue.name || ''
    }
  }

  const roofState = resolveRoofState({
    roofType,
    boxCondition,
    override: override.roofState,
  })

  const reading = await fetchOutdoorWeather({ lat, lon, whenISO })
  if (!reading) {
    return { text: '', reading: null, roofState, cfBearing: null, venueName }
  }

  const cfBearing = parkCfBearing(venueName)
  const text = formatScorebookWeather(reading, { roofState, cfBearing })
  return { text, reading, roofState, cfBearing, venueName }
}
