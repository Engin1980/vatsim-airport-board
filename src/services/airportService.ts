import type { Airport } from "../models/airport";

const CSV_NORMALIZATION_REPLACEMENTS: Array<[string, string]> = [
  ["–—", "-"],
  ["–", "-"],
  ["—", "-"],
  ["ł", "l"],
  ["Ł", "L"],
  ["æ", "ae"],
  ["Æ", "AE"],
  ["ç", "c"],
  ["đ", "d"],
];

function parseLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result.map((s) => s.replace(/^"|"$/g, ""));
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  const headerLine = lines[0];
  const headers = parseLine(headerLine);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j] ?? `col_${j}`;
      obj[key] = values[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

function toNumber(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadAirports(): Promise<Map<string, Airport>> {
  const url = "/data/airports.csv";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  let text = await res.text();
  // Normalize characters using the reusable replacements list
  for (const [find, replace] of CSV_NORMALIZATION_REPLACEMENTS) {
    if (!find) continue;
    text = text.split(find).join(replace);
  }

  const rows = parseCSV(text);
  // Try to dynamically import tz-lookup to determine airport timezones.
  let tzlookup: ((lat: number, lon: number) => string) | null = null;
  try {
    const mod = await import("tz-lookup");
    tzlookup = (mod as any).default ?? (mod as any);
  } catch (e) {
    // tz-lookup not available; timezone will remain null
    tzlookup = null;
  }
  const map = new Map<string, Airport>();
  for (const r of rows) {
    const icao = (r["icao_code"] ?? "").trim();
    if (!icao) continue;
    const airport: Airport = {
      id: toNumber((r["id"] ?? "").replace(/"/g, "")),
      ident: (r["ident"] ?? "").trim(),
      type: (r["type"] ?? "") || null,
      name: (r["name"] ?? "") || null,
      latitude_deg: toNumber(r["latitude_deg"] ?? ""),
      longitude_deg: toNumber(r["longitude_deg"] ?? ""),
      elevation_ft: toNumber(r["elevation_ft"] ?? ""),
      continent: (r["continent"] ?? "") || null,
      iso_country: (r["iso_country"] ?? "") || null,
      iso_region: (r["iso_region"] ?? "") || null,
      municipality: (r["municipality"] ?? "") || null,
      scheduled_service: (r["scheduled_service"] ?? "") || null,
      icao_code: icao,
      iata_code: (r["iata_code"] ?? "") || null,
      gps_code: (r["gps_code"] ?? "") || null,
      local_code: (r["local_code"] ?? "") || null,
      home_link: (r["home_link"] ?? "") || null,
      wikipedia_link: (r["wikipedia_link"] ?? "") || null,
      keywords: (r["keywords"] ?? "") || null,
    };
    // Attempt to determine timezone if tz-lookup was imported and coords exist
    try {
      if (
        tzlookup &&
        airport.latitude_deg != null &&
        airport.longitude_deg != null
      ) {
        airport.timezone = tzlookup(
          airport.latitude_deg,
          airport.longitude_deg,
        );
      } else {
        airport.timezone = null;
      }
    } catch (e) {
      airport.timezone = null;
    }
    map.set(icao, airport);
  }
  return map;
}

export function airportsToArray(map: Map<string, Airport>): Airport[] {
  return Array.from(map.values());
}
