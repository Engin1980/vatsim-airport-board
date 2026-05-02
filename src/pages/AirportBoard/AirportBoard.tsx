import { useEffect, useState } from 'react'
import type { Airport } from '../../models/airport'
import type { VatsimData, VatsimPilot } from '../../models/vatsim'
import { loadVatsimData, extractActiveFlightsPilots } from '../../services/vatsimService'
import { parseDepTime, computeArrival, formatTime } from '../../utils/flightTime'

export interface AirportBoardProps {
  icao: string
  airports: Map<string, Airport> | null
}

export default function AirportBoard({ icao, airports }: AirportBoardProps) {
  const [data, setData] = useState<VatsimData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    loadVatsimData().then(d => { if (mounted) setData(d) }).catch(e => { if (mounted) setError(String(e)) })
    return () => { mounted = false }
  }, [icao])

  if (error) return <div>Error loading VATSIM data: {error}</div>
  if (!data) return <div>Loading flights...</div>

  const pilots: VatsimPilot[] = extractActiveFlightsPilots(data)

  const arrivals = pilots.filter(p => (p.flight_plan?.arrival ?? '').toUpperCase() === icao.toUpperCase())
  const departures = pilots.filter(p => (p.flight_plan?.departure ?? '').toUpperCase() === icao.toUpperCase())

  const airportName = airports?.get(icao.toUpperCase())?.name ?? ''

  return (
    <div style={{padding: '1rem'}}>
      <h2>Airport board: {icao} {airportName ? `- ${airportName}` : ''}</h2>
      <section style={{marginTop: '1rem'}}>
        <h3>Arrivals</h3>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th>Callsign</th>
              <th>Origin (ICAO)</th>
              <th>Estimated Arrival</th>
            </tr>
          </thead>
          <tbody>
            {arrivals.map((p, idx) => {
              const origin = p.flight_plan?.departure ?? '—'
              const arrivalDate = computeArrival(p.flight_plan)
              const arrivalStr = arrivalDate ? formatTime(arrivalDate) : '—'
              return (
                <tr key={`${p.callsign}-arr-${idx}`}>
                  <td>{p.callsign}</td>
                  <td>{origin}</td>
                  <td>{arrivalStr}</td>
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
              <th>Callsign</th>
              <th>Destination (ICAO)</th>
              <th>Scheduled Departure</th>
            </tr>
          </thead>
          <tbody>
            {departures.map((p, idx) => {
              const dest = p.flight_plan?.arrival ?? '—'
              const depDate = parseDepTime(p.flight_plan)
              const depStr = depDate ? formatTime(depDate) : '—'
              return (
                <tr key={`${p.callsign}-dep-${idx}`}>
                  <td>{p.callsign}</td>
                  <td>{dest}</td>
                  <td>{depStr}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
