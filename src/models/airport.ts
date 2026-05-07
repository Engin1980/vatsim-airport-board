export interface Airport {
  id: number | null
  ident: string
  type: string | null
  name: string | null
  latitude_deg: number | null
  longitude_deg: number | null
  elevation_ft: number | null
  continent: string | null
  iso_country: string | null
  iso_region: string | null
  municipality: string | null
  scheduled_service: string | null
  icao_code: string | null
  iata_code: string | null
  gps_code: string | null
  local_code: string | null
  home_link: string | null
  wikipedia_link: string | null
  keywords: string | null
  timezone?: string | null
}
