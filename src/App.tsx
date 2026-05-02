import React, { useEffect, useState } from 'react'
import './App.css'
import AirportList from './components/AirportList/AirportList'
import ActiveFlights from './components/ActiveFlights/ActiveFlights'
import { loadAirports } from './services/airportService'
import type { Airport } from './models/airport'

function App() {
  const [airports, setAirports] = useState<Map<string, Airport> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAirports()
      .then(setAirports)
      .catch(err => {
        console.error('Failed to load airports', err)
        setError(String(err))
      })
  }, [])

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>VATSIM Airport Board</h1>
        <p>Airports loaded from data/airports.csv</p>
      </header>

      {error && <div className="error">Error loading airports: {error}</div>}

      <main>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
          <div>
            <AirportList airports={airports} />
          </div>
          <div>
            <ActiveFlights />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
