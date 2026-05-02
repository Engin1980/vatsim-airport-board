import { useEffect, useState } from 'react'
import type { VatsimData, VatsimPilot } from '../../models/vatsim'
import { loadVatsimData, extractActiveFlightsPilots } from '../../services/vatsimService'
import { parseDepTime, computeArrival, formatTime, formatFullTime } from '../../utils/flightTime'
import { splitCallsign } from '../../utils/callsign'
import { loadAirports } from '../../services/airportService'

export interface AirportBoardProps {
  icao: string
}

const AirportBoardComponent = ({ icao }: AirportBoardProps) => {
  const [data, setData] = useState<VatsimData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [airportsMap, setAirportsMap] = useState<Map<string, any> | null>(null)

  useEffect(() => {
    let mounted = true
    loadVatsimData().then(d => { if (mounted) setData(d) }).catch(e => { if (mounted) setError(String(e)) })
    return () => { mounted = false }
  }, [icao])

  useEffect(() => {
    let mounted = true
    loadAirports().then(m => { if (mounted) setAirportsMap(m) }).catch(e => console.warn('Failed to load airports map', e))
    return () => { mounted = false }
  }, [])

  // Debug: log flight_plan for SHT 8V if present
  useEffect(() => {
    const csTargets = ['SHT 8V', 'SHT8V']
    if (!data) return
    const f = extractActiveFlightsPilots(data).find(p => csTargets.includes((p.callsign ?? '').toString()))
    if (f) {
      // eslint-disable-next-line no-console
      console.log('DEBUG flight_plan for', f.callsign, f.flight_plan, f)
    }
  }, [data])

  if (error) return <div>Error loading VATSIM data: {error}</div>
  if (!data) return <div>Loading flights...</div>

  const pilots: VatsimPilot[] = extractActiveFlightsPilots(data)

  const arrivals = pilots.filter(p => (p.flight_plan?.arrival ?? '').toUpperCase() === icao.toUpperCase())
  const departures = pilots.filter(p => (p.flight_plan?.departure ?? '').toUpperCase() === icao.toUpperCase())

  // compute times and sort ascending (null times last)
  const DIST_ENROUTE_NM = 40
  const DIST_ARRIVING_NM = 10

  function computeArrivalState(p: any): string {
    const pos = getPilotPos(p)
    const airport = getAirportCoords(icao)
    const speedRaw = (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs
    const speed: number | null = (speedRaw === undefined || speedRaw === null) ? null : Number(speedRaw)
    let dist: number | null = null
    if (pos && airport && airport.latitude_deg !== null && airport.longitude_deg !== null) {
      dist = distanceNm(pos.lat, pos.lon, Number(airport.latitude_deg), Number(airport.longitude_deg))
    }
    if (dist === null || speed === null) return 'Unknown'
    if (dist > DIST_ENROUTE_NM) return 'Enroute'
    if (dist > DIST_ARRIVING_NM) return 'Arriving'
    // dist <= 10
    if (speed > 40) return 'Landing'
    if (speed > 0 && speed <= 40) return 'Landed'
    if (speed === 0) return 'At the gate'
    return 'Unknown'
  }

  const arrivalsWithTime = arrivals.map(p => {
    const time = computeArrival(p.flight_plan)
    const pos = getPilotPos(p)
    const airport = getAirportCoords(icao)
    let dist: number | null = null
    if (pos && airport && airport.latitude_deg !== null && airport.longitude_deg !== null) {
      dist = distanceNm(pos.lat, pos.lon, Number(airport.latitude_deg), Number(airport.longitude_deg))
    }
    const speedRaw = (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs
    const speed: number | null = (speedRaw === undefined || speedRaw === null) ? null : Number(speedRaw)
    const state = computeArrivalState(p)
    // expected arrival based on current position + groundspeed, plus fixed 10 minutes
    let expected: Date | null = null
    if (dist !== null && speed !== null && speed > 0) {
      const minutesToGo = dist / speed * 60 // hours->minutes
      expected = new Date(Date.now() + Math.round((minutesToGo + 10) * 60000))
    }
    // compute delay text: compare expected to planned arrival (time)
    let delayText: string = ''
    if (expected && time) {
      const diffMin = Math.round((expected.getTime() - time.getTime()) / 60000)
      if (diffMin > 10) {
        const rounded = Math.round(diffMin / 10) * 10
        const hh = Math.floor(rounded / 60)
        const mm = rounded % 60
        const hhmm = `${hh}:${mm.toString().padStart(2,'0')}`
        delayText = `Delayed (+${hhmm})`
      } else {
        // no meaningful delay
        delayText = ''
      }
    } else if (expected) {
      // no planned arrival to compare, still show expected time
      delayText = `Exp ${formatTime(expected)}`
    } else {
      delayText = ''
    }
    return { p, time, state, speed, dist, expected, delayText }
  }).sort((a,b) => {
    if (a.time === null && b.time === null) return a.p.callsign.localeCompare(b.p.callsign)
    if (a.time === null) return 1
    if (b.time === null) return -1
    return a.time.getTime() - b.time.getTime()
  })

  const SPEED_THRESHOLD = 40 // knots
  const DIST_THRESHOLD_NM = 5 // nautical miles
  const NOT_MOVING_THRESHOLD = 0.5 // knots

  function deg2rad(d: number) { return d * Math.PI / 180 }
  function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const Rkm = 6371
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const km = Rkm * c
    return km / 1.852 // convert km to nautical miles
  }

  function getPilotPos(p: any) {
    const lat = p.latitude ?? p.latitude_deg ?? p.lat
    const lon = p.longitude ?? p.longitude_deg ?? p.lon
    if (lat === undefined || lon === undefined || lat === null || lon === null) return null
    const nLat = Number(lat)
    const nLon = Number(lon)
    if (Number.isFinite(nLat) && Number.isFinite(nLon)) return {lat: nLat, lon: nLon}
    return null
  }

  function getAirportCoords(icao: string) {
    if (!airportsMap) return null
    return airportsMap.get(icao.toUpperCase()) || null
  }

  function computeDepartureState(p: any): string {
    const pos = getPilotPos(p)
    const airport = getAirportCoords(icao)
    const speed = Number(p.groundspeed ?? p.ground_speed ?? p.gs ?? 0) || 0
    let dist = null
    if (pos && airport && airport.latitude_deg !== null && airport.longitude_deg !== null) {
      dist = distanceNm(pos.lat, pos.lon, Number(airport.latitude_deg), Number(airport.longitude_deg))
    }
    // logic
    if (speed > SPEED_THRESHOLD) return 'Departed'
    if (dist !== null && dist <= DIST_THRESHOLD_NM) {
      if (speed <= NOT_MOVING_THRESHOLD) return 'Gate Open'
      if (speed <= SPEED_THRESHOLD) return 'Gate Closed'
    }
    // more than threshold distance
    if (dist !== null && dist > DIST_THRESHOLD_NM) {
      if (speed < SPEED_THRESHOLD) return 'Arrived Dest'
      return 'Departed'
    }
    // fallback based on speed
    if (speed <= NOT_MOVING_THRESHOLD) return 'Gate Open'
    if (speed <= SPEED_THRESHOLD) return 'Gate Closed'
    return 'Departed'
  }

  const departuresWithTime = departures.map(p => {
    const time = parseDepTime(p.flight_plan)
    const pos = getPilotPos(p)
    const airport = getAirportCoords(icao)
    let dist: number | null = null
    if (pos && airport && airport.latitude_deg !== null && airport.longitude_deg !== null) {
      dist = distanceNm(pos.lat, pos.lon, Number(airport.latitude_deg), Number(airport.longitude_deg))
    }
    const speedRaw = (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs
    const speed: number | null = (speedRaw === undefined || speedRaw === null) ? null : Number(speedRaw)
    const state = computeDepartureState(p)
    return { p, time, state, speed, dist }
  }).sort((a,b) => {
    if (a.time === null && b.time === null) return a.p.callsign.localeCompare(b.p.callsign)
    if (a.time === null) return 1
    if (b.time === null) return -1
    return a.time.getTime() - b.time.getTime()
  })


  return (
    <div style={{padding: '1rem'}}>
      <section style={{marginTop: '1rem'}}>
        <h3>Arrivals</h3>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th>LocalTime</th>
              <th>Callsign</th>
              <th>Origin (ICAO)</th>
              <th>State</th>
              <th>Delay</th>
              <th>FullTime</th>
            </tr>
          </thead>
          <tbody>
            {arrivalsWithTime.map(({p, time, state, speed, dist, expected, delayText}, idx) => {
              const origin = p.flight_plan?.departure ?? '—'
              const full = time ? formatFullTime(time) : '—'
              const local = time ? formatTime(time) : '—'
              const cs = splitCallsign(p.callsign)
              return (
                <tr key={`${p.callsign}-arr-${idx}`}>
                  <td>{local}</td>
                  <td>{cs}</td>
                  <td>{origin}</td>
                  <td>{state}</td>
                  <td>{delayText}</td>
                  <td>{full}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section style={{marginTop: '1.5rem'}}>
        <h3>Departures</h3>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th>LocalTime</th>
              <th>Callsign</th>
              <th>Destination (ICAO)</th>
              <th>Speed (kts)</th>
              <th>Dist (NM)</th>
              <th>State</th>
              <th>FullTime</th>
            </tr>
          </thead>
          <tbody>
            {departuresWithTime.map(({p, time, state, speed, dist}, idx) => {
              const dest = p.flight_plan?.arrival ?? '—'
              const full = time ? formatFullTime(time) : '—'
              const local = time ? formatTime(time) : '—'
              const cs = splitCallsign(p.callsign)
              return (
                <tr key={`${p.callsign}-dep-${idx}`}>
                  <td>{local}</td>
                  <td>{cs}</td>
                  <td>{dest}</td>
                  <td>{(speed !== null && Number.isFinite(speed)) ? Math.round(speed) : '—'}</td>
                  <td>{dist !== null ? dist.toFixed(1) : '—'}</td>
                  <td>{state}</td>
                  <td>{full}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default AirportBoardComponent
