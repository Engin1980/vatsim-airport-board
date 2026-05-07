import { useEffect, useState, useMemo, useRef } from 'react'
import type { VatsimData } from '../models/vatsim'
import { loadVatsimData, extractActiveFlightsPilots } from '../services/vatsimService'
import { loadAirports } from '../services/airportService'
import { buildBoardData } from '../models/airportBoardModel'
import type { BoardArrival, BoardDeparture } from '../models/airportBoardModel'
import type { Airport } from '../models/airport'

export default function useAirportBoard(icao: string, opts?: { pollIntervalMs?: number }) {
  const [data, setData] = useState<VatsimData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [airportsMap, setAirportsMap] = useState<Map<string, Airport> | null>(null)
  const [showAllDepartures, setShowAllDepartures] = useState<boolean>(false)
  const [rowsCount, setRowsCount] = useState<number>(7)
  const [lastFetchAttempt, setLastFetchAttempt] = useState<Date | null>(null)
  const [lastDataTimestamp, setLastDataTimestamp] = useState<string | null>(null)

  const pollIntervalMs = opts?.pollIntervalMs ?? 30000

  useEffect(() => {
    let mounted = true
    loadAirports()
      .then((m) => {
        if (mounted) setAirportsMap(m)
      })
      .catch((e) => {
        console.warn('Failed to load airports map', e)
        if (mounted) setError(String(e))
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!airportsMap) return
    let mounted = true
    setData(null)
    setError(null)
    setLastFetchAttempt(new Date())
    loadVatsimData()
      .then((d) => {
        if (mounted) {
          setData(d)
          const ts = d?.general?.update ?? d?.update ?? d?.general?.timestamp ?? new Date().toISOString()
          setLastDataTimestamp(ts == null ? null : String(ts))
        }
      })
      .catch((e) => {
        if (mounted) setError(String(e))
      })
    return () => {
      mounted = false
    }
  }, [icao, airportsMap])

  // Polling with merge to preserve pilot references when unchanged (helps React/children)
  useEffect(() => {
    if (!airportsMap) return
    let mounted = true

    const fetchAndMaybeUpdate = async () => {
      try {
        setLastFetchAttempt(new Date())
        const newData = await loadVatsimData()
        if (!mounted) return
        const ts2 = newData?.general?.update ?? newData?.update ?? newData?.general?.timestamp ?? new Date().toISOString()
        setLastDataTimestamp(ts2 == null ? null : String(ts2))
        setData((prev) => {
          if (!prev) return newData

          try {
            const prevPilots = Array.isArray(prev.pilots) ? prev.pilots : []
            const prevMap = new Map<string, any>()
            prevPilots.forEach((pp: any) => {
              const key = (pp.callsign ?? pp.cid ?? '').toString()
              if (key) prevMap.set(key, pp)
            })

            const mergedPilots = Array.isArray(newData.pilots)
              ? newData.pilots.map((np: any) => {
                  const key = (np.callsign ?? np.cid ?? '').toString()
                  const existing = key ? prevMap.get(key) : null
                  if (existing) {
                    try {
                      if (JSON.stringify(existing) === JSON.stringify(np)) return existing
                    } catch (e) {
                      // ignore stringify errors
                    }
                  }
                  return np
                })
              : []

            const merged = { ...newData, pilots: mergedPilots }
            try {
              if (JSON.stringify(prev) === JSON.stringify(merged)) return prev
            } catch (e) {
              // proceed
            }
            return merged
          } catch (e) {
            return newData
          }
        })
      } catch (e) {
        console.warn('VATSIM poll failed', e)
      }
    }

    fetchAndMaybeUpdate()
    const id = setInterval(fetchAndMaybeUpdate, pollIntervalMs)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [airportsMap, pollIntervalMs])

  const pilots = useMemo(() => (data ? extractActiveFlightsPilots(data) : []), [data])

  // persistent map to remember departure states across polls (sticky 'Gate Closed')
  const prevDepartureStatesRef = useRef<Map<string, string>>(new Map())

  const board = useMemo(() => {
    return buildBoardData({
      pilots,
      profiles: data?.profiles ?? [],
      airportsMap,
      icao,
      rowsCount,
      showAllDepartures,
      prevDepartureStates: prevDepartureStatesRef.current,
    })
  }, [pilots, data?.profiles, airportsMap, icao, rowsCount, showAllDepartures])

  return {
    arrivals: board.arrivals as BoardArrival[],
    departures: board.departures as BoardDeparture[],
    airportsMap,
    loadingAirports: airportsMap === null,
    loadingData: data === null,
    error,
    rowsCount,
    setRowsCount,
    showAllDepartures,
    setShowAllDepartures,
    lastFetchAttempt,
    lastDataTimestamp,
  }
}
