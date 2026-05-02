export interface VatsimGeneral {
  update?: string | number | null
}

export interface VatsimFlightPlan {
  callsign?: string | null
  departure?: string | null
  arrival?: string | null
  // include other fields as optional for future use
  [key: string]: any
}

export interface VatsimPilot {
  callsign: string
  cid?: number | null
  flight_plan?: VatsimFlightPlan | null
  // other fields are ignored for now
}

export interface VatsimData {
  general?: VatsimGeneral | null
  pilots: VatsimPilot[]
  profiles: VatsimFlightPlan[]
}
