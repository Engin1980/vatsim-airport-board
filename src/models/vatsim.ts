export interface VatsimGeneral {
  update?: string | number | null
  timestamp?: string | number | null
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
  // common telemetry fields included as optional
  latitude?: number | null
  longitude?: number | null
  groundspeed?: number | null
  ground_speed?: number | null
  gs?: number | null
  // other fields are allowed
  [key: string]: any
}

export interface VatsimData {
  general?: VatsimGeneral | null
  // some feeds may expose a top-level `update` timestamp
  update?: string | number | null
  pilots: VatsimPilot[]
  profiles: VatsimFlightPlan[]
}
