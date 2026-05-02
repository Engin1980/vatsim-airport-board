import type { Airport } from '../../models/airport'
import './AirportList.css'

export interface AirportListProps {
  airports: Map<string, Airport> | null
}

export default function AirportList({ airports }: AirportListProps) {
  if (!airports) return <div className="airport-list">Loading airports...</div>
  const codes = Array.from(airports.keys()).sort()
  return (
    <div className="airport-list">
      <h2>Airports (by ICAO)</h2>
      <ul>
        {codes.map(code => {
          const a = airports.get(code) as Airport
          return (
            <li key={code} className="airport-item">
              <strong>{code}</strong>
              <span className="airport-name">{a.name ?? '—'}</span>
              <span className="airport-muni">{a.municipality ?? ''}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
