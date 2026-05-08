import { useMemo, useState, useEffect } from 'react'
import type { Airport } from '../../models/airport'

export interface AirportSelectProps {
  airports: Map<string, Airport> | null
}

export default function AirportSelect({ airports }: AirportSelectProps) {
  if (!airports) return <div>Loading airports...</div>
  const [filter, setFilter] = useState('')
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('airportHistory')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          const normalized = Array.from(new Set(arr.map((s: any) => (typeof s === 'string' ? s.toUpperCase() : String(s)))))
          normalized.sort()
          setHistory(normalized)
        }
      }
    } catch (e) {
      // ignore
    }
  }, [])

  function addToHistory(code: string) {
    try {
      const key = 'airportHistory'
      const raw = localStorage.getItem(key)
      const existing = raw ? JSON.parse(raw) : []
      const s = new Set((existing as any[]).map((x) => String(x).toUpperCase()))
      s.add(code.toUpperCase())
      const arr = Array.from(s).sort()
      localStorage.setItem(key, JSON.stringify(arr))
      setHistory(arr)
    } catch (e) {
      // ignore
    }
  }

  function removeFromHistory(code: string) {
    try {
      const key = 'airportHistory'
      const raw = localStorage.getItem(key)
      const existing = raw ? JSON.parse(raw) : []
      const filtered = (existing as any[]).map((x) => String(x).toUpperCase()).filter((s) => s !== code.toUpperCase())
      const uniq = Array.from(new Set(filtered)).sort()
      localStorage.setItem(key, JSON.stringify(uniq))
      setHistory(uniq)
    } catch (e) {
      // ignore
    }
  }

  const codes = useMemo(() => {
    const all = Array.from(airports.keys()).sort()
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter((code) => {
      const a = airports.get(code) as Airport
      const name = `${a.name ?? ''} ${a.municipality ?? ''}`.toLowerCase()
      return code.toLowerCase().includes(q) || name.includes(q)
    })
  }, [airports, filter])

  return (
    <div style={{padding: '1rem'}}>
      <h2>Select an airport</h2>
      <div style={{ margin: '0.5rem 0 1rem' }}>
        {history.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>Historie</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {history.map((code) => (
                <div key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <a href={`#/airport/${code}`} onClick={() => addToHistory(code)} style={{ textDecoration: 'none', padding: '0.25rem 0.5rem', background: 'var(--code-bg)', borderRadius: 4, color: 'inherit' }}>
                    {code}
                  </a>
                  <button
                    type="button"
                    aria-label={`Odstranit ${code} z historie`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFromHistory(code); }}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', padding: '0 6px', fontSize: '0.95rem' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Filter:</span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="code or name"
              style={{ width: '14rem' }}
            />
          </label>
        </div>
      </div>
      <ul style={{listStyle:'none',padding:0}}>
        {codes.map(code => {
          const a = airports.get(code) as Airport
          return (
            <li key={code} style={{padding:'0.25rem 0'}}>
              <a href={`#/airport/${code}`} style={{textDecoration:'none'}} onClick={() => addToHistory(code)}>
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
