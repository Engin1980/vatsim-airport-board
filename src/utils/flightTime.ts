export function parseDepTime(fp: any): Date | null {
  if (!fp) return null
  const candidates = [
    'departure_time', 'dep_time', 'departuretime', 'departureTime', 'departure_time_utc', 'dep_time_utc', 'depdatetime',
    'planned_departure_time', 'planned_dep_time', 'planned_departure', 'planned_departure_time_utc', 'departuretime_utc'
  ]
  for (const k of candidates) {
    const v = fp[k]
    if (!v) continue
    const d = tryParseDateValue(v)
    if (d) return d
  }

  // Fallback: scan all fields for any value that looks like a time/date
  for (const key of Object.keys(fp)) {
    const v = fp[key]
    const d = tryParseDateValue(v)
    if (d) return d
  }

  return null
}

function tryParseDateValue(v: any): Date | null {
  if (v === undefined || v === null) return null
  // ISO timestamp
  if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  // HHMM or HMM
  if (typeof v === 'string' && /^\d{3,4}$/.test(v)) {
    const s = v.padStart(4, '0')
    const hh = parseInt(s.slice(0,2), 10)
    const mm = parseInt(s.slice(2), 10)
    const now = new Date()
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm, 0,0))
    return d
  }
  // number interpreted as unix epoch seconds or milliseconds
  if (typeof v === 'number') {
    if (v > 1e12) return new Date(v) // ms
    if (v > 1e9) return new Date(v * 1000) // seconds
  }
  // fallback, try Date parse
  const p = Date.parse(String(v))
  if (!isNaN(p)) return new Date(p)
  return null
}

export function parseEnrouteMinutes(fp: any): number | null {
  if (!fp) return null
  const candidates = ['enroute_time','enroute_minutes','enroute','estimated_enroute','estimated_time_enroute','enroutetime','enroute_mins','air_time','airtime','estimated_time']
  for (const k of candidates) {
    const v = fp[k]
    if (v === undefined || v === null) continue
    const n = tryParseEnroute(v)
    if (n !== null) return n
  }

  // fallback: scan all fields for values that look like durations
  for (const key of Object.keys(fp)) {
    const v = fp[key]
    const n = tryParseEnroute(v)
    if (n !== null) return n
  }

  return null
}

function tryParseEnroute(v: any): number | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'number') return Math.round(v)
  if (typeof v === 'string') {
    const m = v.match(/^(\d+):(\d{2})$/)
    if (m) return parseInt(m[1],10)*60 + parseInt(m[2],10)
    const n = Number(v)
    if (!isNaN(n)) return Math.round(n)
  }
  return null
}

export function formatTime(d: Date | null): string {
  if (!d) return '—'
  try {
    // Local HH:MM (24h)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return '—'
  }
}

export function formatFullTime(d: Date | null): string {
  if (!d) return '—'
  try {
    return d.toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return d.toISOString()
  }
}

export function computeArrival(fp: any): Date | null {
  const dep = parseDepTime(fp)
  const en = parseEnrouteMinutes(fp)
  if (!dep || en === null) return null
  return new Date(dep.getTime() + en*60000)
}
