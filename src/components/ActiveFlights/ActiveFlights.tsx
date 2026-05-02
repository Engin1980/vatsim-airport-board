import { useEffect, useState } from 'react'
import type { VatsimData, VatsimPilot } from '../../models/vatsim'
import { loadVatsimData, extractActiveFlightsPilots } from '../../services/vatsimService'
import './ActiveFlights.css'

export interface ActiveFlightsProps {
  refreshIntervalMs?: number
}

export default function ActiveFlights({ refreshIntervalMs = 0 }: ActiveFlightsProps) {
  const [data, setData] = useState<VatsimData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const d = await loadVatsimData()
        if (!mounted) return
        setData(d)
      } catch (err: any) {
        console.error('Failed to load VATSIM data', err)
        if (!mounted) return
        setError(String(err))
      }
    }
    load()
    let id: number | undefined
    if (refreshIntervalMs && refreshIntervalMs > 0) {
      id = window.setInterval(load, refreshIntervalMs)
    }
    return () => {
      mounted = false
      if (id) clearInterval(id)
    }
  }, [refreshIntervalMs])

  if (error) return <div className="active-flights error">Error loading active flights: {error}</div>
  if (!data) return <div className="active-flights">Loading active flights...</div>

  const activePilots: VatsimPilot[] = extractActiveFlightsPilots(data)

  return (
    <div className="active-flights">
      <h2>Active Flights (pilots)</h2>
      <div className="meta">Last update: {String(data.general?.update ?? 'unknown')}</div>
      <table>
        <thead>
          <tr>
            <th>Callsign</th>
            <th>Departure (ICAO)</th>
            <th>Arrival (ICAO)</th>
          </tr>
        </thead>
        <tbody>
          {activePilots.map((p, idx) => {
            const dep = p.flight_plan?.departure ?? '—'
            const arr = p.flight_plan?.arrival ?? '—'
            return (
              <tr key={`${p.callsign}-${idx}`}>
                <td>{p.callsign}</td>
                <td>{dep}</td>
                <td>{arr}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
