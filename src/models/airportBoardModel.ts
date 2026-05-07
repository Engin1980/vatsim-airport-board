import type { VatsimPilot, VatsimFlightPlan } from './vatsim'
import type { Airport } from './airport'
import { parseDepTime, computeArrival, formatTime } from '../utils/flightTime'
import { splitCallsign } from '../utils/callsign'

export type BoardArrival = {
  p: VatsimPilot
  time: Date | null
  state: string
  speed: number | null
  dist: number | null
  expected: Date | null
  delayText: string
  originLabel: string
  local: string
  callsignSplit: string
}

export type BoardDeparture = {
  p: any
  time: Date | null
  state: string
  speed: number | null
  dist: number | null
  expected: Date | null
  delayText: string
  destLabel: string
  local: string
  callsignSplit: string
}

const DIST_ENROUTE_NM = 40
const DIST_ARRIVING_NM = 10
const SPEED_THRESHOLD = 40
const DIST_THRESHOLD_NM = 5
const NOT_MOVING_THRESHOLD = 0.5

function deg2rad(d: number) {
  return (d * Math.PI) / 180
}

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const Rkm = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const km = Rkm * c
  return km / 1.852
}

export function roundToNearest5(date: Date): Date {
  const d = new Date(date)
  const mins = d.getMinutes()
  const rounded = Math.round(mins / 5) * 5
  if (rounded === 60) {
    d.setMinutes(0)
    d.setHours(d.getHours() + 1)
  } else {
    d.setMinutes(rounded)
  }
  d.setSeconds(0)
  d.setMilliseconds(0)
  return d
}

function getPilotPos(p: any) {
  const lat = p.latitude ?? p.latitude_deg ?? p.lat
  const lon = p.longitude ?? p.longitude_deg ?? p.lon
  if (lat === undefined || lon === undefined || lat === null || lon === null)
    return null
  const nLat = Number(lat)
  const nLon = Number(lon)
  if (Number.isFinite(nLat) && Number.isFinite(nLon)) return { lat: nLat, lon: nLon }
  return null
}

// delay formatting helper removed (unused)

export function buildBoardData(opts: {
  pilots: VatsimPilot[]
  profiles?: VatsimFlightPlan[]
  airportsMap: Map<string, Airport> | null
  icao: string
  rowsCount: number
  showAllDepartures?: boolean
  // optional map of previous departure states keyed by callsign (persist across polls)
  prevDepartureStates?: Map<string, string>
}) {
  const { pilots, profiles = [], airportsMap, icao, rowsCount, showAllDepartures = false, prevDepartureStates } = opts
  const ICAO = icao.toUpperCase()

  const arrivals = pilots.filter(
    (p) => (p.flight_plan?.arrival ?? '').toUpperCase() === ICAO,
  )
  const departures = pilots.filter(
    (p) => (p.flight_plan?.departure ?? '').toUpperCase() === ICAO,
  )

  const prefilePilots = (profiles ?? [])
    .filter((fp) => ((fp.departure ?? '') as string).toUpperCase() === ICAO)
    .map((fp) => ({ callsign: fp.callsign ?? '', flight_plan: fp, __is_prefile: true }))

  const departuresSource: any[] = [...departures, ...prefilePilots]

  const airport = airportsMap ? airportsMap.get(ICAO) || null : null

  const arrivalsWithTime: BoardArrival[] = arrivals
    .map((p) => {
      const time = computeArrival(p.flight_plan)
      const pos = getPilotPos(p)
      let dist: number | null = null
      if (
        pos &&
        airport &&
        airport.latitude_deg !== null &&
        airport.longitude_deg !== null
      ) {
        dist = distanceNm(pos.lat, pos.lon, Number(airport.latitude_deg), Number(airport.longitude_deg))
      }
      const speedRaw = (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs
      const speed: number | null = speedRaw === undefined || speedRaw === null ? null : Number(speedRaw)
      let state = 'Unknown'
      if (dist === null) state = 'Unknown'
      else if (speed === null) {
        if (dist > DIST_ENROUTE_NM) state = 'Enroute'
        else if (dist > DIST_ARRIVING_NM) state = 'Arriving'
        else state = 'Arriving'
      } else {
        // If the aircraft is farther than the 'arriving' threshold, and it
        // hasn't taken off (speed <= 40 kt), show 'Scheduled'. If it's
        // within the arriving threshold, use the close-in states (Landing,
        // Landed, At the gate) based on speed.
        if (dist > DIST_ENROUTE_NM) {
          state = 'Enroute'
        } else if (dist > DIST_ARRIVING_NM) {
          // Mid-range: if still very slow, likely hasn't departed yet
          state = speed <= 40 ? 'Scheduled' : 'Arriving'
        } else {
          // Close to airport: use landing/landed/gate heuristics
          if (speed > 40) state = 'Landing'
          else if (speed > 0 && speed <= 40) state = 'Landed'
          else if (speed === 0) state = 'At the gate'
          else state = 'Unknown'
        }
      }

      let expected: Date | null = null
      // Only compute ETA if we have position, speed and the aircraft is
      // reasonably high (>= 10000 ft). Accept common altitude fields and
      // convert meters->feet when necessary.
      try {
        const altMRaw = (p as any).altitude_m ?? (p as any).alt_m ?? null
        const altFtRaw = (p as any).altitude_ft ?? (p as any).alt_ft ?? (p as any).altitude ?? (p as any).alt ?? null
        let altitudeFt: number | null = null
        if (altMRaw != null) {
          const n = Number(altMRaw)
          if (!isNaN(n)) altitudeFt = n * 3.28084
        } else if (altFtRaw != null) {
          const n = Number(altFtRaw)
          if (!isNaN(n)) altitudeFt = n
        }

        if (
          dist !== null &&
          speed !== null &&
          speed > 0 &&
          altitudeFt !== null &&
          !isNaN(altitudeFt) &&
          altitudeFt >= 10000
        ) {
          const minutesToGo = (dist / speed) * 60
          expected = new Date(Date.now() + Math.round((minutesToGo + 10) * 60000))
        }
      } catch (e) {
        // ignore altitude parsing errors and leave expected as null
      }

      let delayText = ''
      if (expected && time) {
        const diffMin = Math.round((expected.getTime() - time.getTime()) / 60000)
        if (diffMin > 10) {
          const rounded = Math.round(diffMin / 10) * 10
          const hh = Math.floor(rounded / 60)
          const mm = rounded % 60
          const hhStr = hh.toString().padStart(2, '0')
          const mmStr = mm.toString().padStart(2, '0')
          delayText = `+${hhStr}:${mmStr}`
        } else {
          delayText = ''
        }
      } else if (expected) {
        delayText = `Exp ${formatTime(expected)}`
      } else {
        delayText = ''
      }

      const originIcao = p.flight_plan?.departure ?? null
      const originAirport = originIcao && airportsMap ? airportsMap.get(originIcao) : null
      let originName = originAirport?.name ?? originAirport?.municipality ?? null
      if (originName && originName.endsWith(' Airport')) originName = originName.slice(0, -' Airport'.length)
      const originLabel = originName ?? originIcao ?? '—'

      const local = time ? formatTime(roundToNearest5(time)) : '—'
      const cs = splitCallsign(p.callsign)

      return { p, time, state, speed, dist, expected, delayText, originLabel, local, callsignSplit: cs }
    })
    .sort((a, b) => {
      if (a.time === null && b.time === null) return a.p.callsign.localeCompare(b.p.callsign)
      if (a.time === null) return 1
      if (b.time === null) return -1
      return a.time.getTime() - b.time.getTime()
    })

  const displayedArrivals = arrivalsWithTime.slice(0, rowsCount)

  const departuresWithTime: BoardDeparture[] = departuresSource
    .map((p) => {
      const time = parseDepTime(p.flight_plan)
      const pos = getPilotPos(p)
      const speedRaw = (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs
      const speed: number | null = speedRaw === undefined || speedRaw === null ? null : Number(speedRaw)
      const isPrefile = Boolean((p as any).__is_prefile)

      let dist: number | null = null
      if (isPrefile) dist = 0
      else if (
        pos &&
        airport &&
        airport.latitude_deg !== null &&
        airport.longitude_deg !== null
      ) {
        dist = distanceNm(pos.lat, pos.lon, Number(airport.latitude_deg), Number(airport.longitude_deg))
      }

      let state = ''
      if (isPrefile) state = ''
      else {
        const sp = Number(p.groundspeed ?? p.ground_speed ?? p.gs ?? 0) || 0
        if (sp > SPEED_THRESHOLD) state = 'Departed'
        else if (dist !== null && dist <= DIST_THRESHOLD_NM) {
          if (sp <= NOT_MOVING_THRESHOLD) state = 'Gate Open'
          else if (sp <= SPEED_THRESHOLD) state = 'Gate Closed'
        } else if (dist !== null && dist > DIST_THRESHOLD_NM) {
          if (sp < SPEED_THRESHOLD) state = 'Arrived Dest'
          else state = 'Departed'
        } else if (sp <= NOT_MOVING_THRESHOLD) state = 'Gate Open'
        else if (sp <= SPEED_THRESHOLD) state = 'Gate Closed'
        else state = 'Departed'
      }

      // If we have a previous state recorded for this callsign, ensure we do not
      // regress from 'Gate Closed' back to 'Gate Open'. This preserves the
      // 'Gate Closed' sticky behavior across polls for the same callsign.
      try {
        const key = (p.callsign ?? '').toString()
        if (prevDepartureStates && key) {
          const prev = prevDepartureStates.get(key)
          if (prev === 'Gate Closed' && state === 'Gate Open') {
            state = 'Gate Closed'
          }
        }
      } catch (e) {
        // ignore any errors reading the previous map
      }

      let delayText = ''
      if (isPrefile && time) {
        const now = new Date()
        if (now.getTime() > time.getTime()) {
          const diffMin = Math.ceil((now.getTime() - time.getTime()) / 60000)
          const rounded = Math.ceil(diffMin / 10) * 10
          const hh = Math.floor(rounded / 60)
          const mm = rounded % 60
          const hhStr = hh.toString().padStart(2, '0')
          const mmStr = mm.toString().padStart(2, '0')
          // show numeric delay like +HH:MM (not the word 'Delayed')
          delayText = `+${hhStr}:${mmStr}`
        }
      } else if (state === 'Gate Open' && time) {
        const now = new Date()
        if (now.getTime() > time.getTime()) {
          const diffMin = Math.ceil((now.getTime() - time.getTime()) / 60000)
          const rounded = Math.ceil(diffMin / 10) * 10
          const hh = Math.floor(rounded / 60)
          const mm = rounded % 60
          const hhStr = hh.toString().padStart(2, '0')
          const mmStr = mm.toString().padStart(2, '0')
          // show numeric delay like +HH:MM (not the word 'Delayed')
          delayText = `+${hhStr}:${mmStr}`
        }
      }

      let expected: Date | null = null
      try {
        const destIcao = p.flight_plan?.arrival ?? null
        const destAirport = destIcao && airportsMap ? airportsMap.get(destIcao) : null
        if (
          pos &&
          destAirport &&
          destAirport.latitude_deg !== null &&
          destAirport.longitude_deg !== null &&
          speed !== null &&
          speed > 0
        ) {
          const distToDest = distanceNm(pos.lat, pos.lon, Number(destAirport.latitude_deg), Number(destAirport.longitude_deg))
          if (distToDest !== null && !isNaN(Number(distToDest))) {
            const minutesToGo = (distToDest / speed) * 60
            expected = new Date(Date.now() + Math.round(minutesToGo * 60000))
          }
        }
      } catch (e) {
        // ignore
      }

      const destIcao = p.flight_plan?.arrival ?? null
      const destAirport = destIcao && airportsMap ? airportsMap.get(destIcao) : null
      let destName = destAirport?.name ?? destAirport?.municipality ?? null
      if (destName && destName.endsWith(' Airport')) destName = destName.slice(0, -' Airport'.length)
      const destLabel = destName ?? '—'

      const local = time ? formatTime(roundToNearest5(time)) : '—'
      const cs = splitCallsign(p.callsign)

      // Persist Gate Closed states into the provided map so subsequent calls
      // will honor the sticky behavior.
      try {
        const key = (p.callsign ?? '').toString()
        if (prevDepartureStates && key && state === 'Gate Closed') {
          prevDepartureStates.set(key, 'Gate Closed')
        }
      } catch (e) {
        // ignore
      }

      return { p, time, state, speed, dist, delayText, expected, destLabel, local, callsignSplit: cs }
    })
    .sort((a, b) => {
      if (a.time === null && b.time === null) return a.p.callsign.localeCompare(b.p.callsign)
      if (a.time === null) return 1
      if (b.time === null) return -1
      return a.time.getTime() - b.time.getTime()
    })

  const displayedDepartures = departuresWithTime.filter((d) => showAllDepartures || (d.dist !== null && d.dist <= 50))

  return { arrivals: displayedArrivals, departures: displayedDepartures }
}
