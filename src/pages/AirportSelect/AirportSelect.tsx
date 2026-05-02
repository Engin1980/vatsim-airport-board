import type { Airport } from '../../models/airport'

export interface AirportSelectProps {
  airports: Map<string, Airport> | null
}

export default function AirportSelect({ airports }: AirportSelectProps) {
  if (!airports) return <div>Loading airports...</div>
  const codes = Array.from(airports.keys()).sort()
  return (
    <div style={{padding: '1rem'}}>
      <h2>Select an airport</h2>
      <ul style={{listStyle:'none',padding:0}}>
        {codes.map(code => {
          const a = airports.get(code) as Airport
          return (
            <li key={code} style={{padding:'0.25rem 0'}}>
              <a href={`#/airport/${code}`} style={{textDecoration:'none'}}>
                <strong>{code}</strong>
                <span style={{marginLeft:8}}>{a.name ?? ''} {a.municipality ? `(${a.municipality})` : ''}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
