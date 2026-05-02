import type { VatsimData, VatsimPilot, VatsimFlightPlan } from '../models/vatsim'

const VATSIM_URL = 'https://data.vatsim.net/v3/vatsim-data.json'

function safeStr(v: any): string | null {
  if (v === undefined || v === null) return null
  return String(v).trim() || null
}

function normalizeFlightPlan(fp: any): VatsimFlightPlan {
  if (!fp) return {}
  return {
    callsign: safeStr(fp.callsign ?? fp.callsign ?? null),
    departure: safeStr(fp.departure ?? fp.departure_airport ?? fp.dep ?? null),
    arrival: safeStr(fp.arrival ?? fp.arrival_airport ?? fp.arr ?? null),
    ...fp,
  }
}

function normalizePilot(p: any): VatsimPilot {
  return {
    callsign: safeStr(p.callsign ?? p.callsign ?? '') || (p.callsign ?? p.callsign ?? ''),
    cid: p.cid ?? p.cid ?? null,
    flight_plan: p.flight_plan ? normalizeFlightPlan(p.flight_plan) : (p.flightplan ? normalizeFlightPlan(p.flightplan) : null),
  }
}

export async function loadVatsimData(): Promise<VatsimData> {
  const res = await fetch(VATSIM_URL)
  if (!res.ok) throw new Error(`Failed to fetch VATSIM data: ${res.status}`)
  const data = await res.json()
  const general = data.general ?? data.update ?? null
  const pilotsRaw = data.pilots ?? []
  const pilots: VatsimPilot[] = pilotsRaw.map(normalizePilot)
  const profilesRaw = data.profiles ?? data.prfiles ?? data.flight_plans ?? []
  const profiles: VatsimFlightPlan[] = profilesRaw.map((p: any) => normalizeFlightPlan(p))
  return {
    general,
    pilots,
    profiles,
  }
}

export function extractActiveFlightsPilots(v: VatsimData) {
  // Returns pilots with at least one of departure/arrival
  return v.pilots.filter(p => !!(p.flight_plan && (p.flight_plan.departure || p.flight_plan.arrival)))
}
